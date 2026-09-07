// SPDX-License-Identifier: Apache-2.0
//
// Sole SDK - client
// How another application integrates Sole WITHOUT cloning this repo. A private
// rights app constructs a SoleClient with the deployed registry/anonymizer/pool
// addresses and drives the lifecycle. All privacy-bearing calls route through
// the STRK20 pool's privacy_invoke, so the registry sees the configured helper
// as caller. That caller boundary is not transaction-level wallet
// unlinkability; see docs/PRIVACY_BOUNDARY.md.

import { Contract, hash, RpcProvider, type AccountInterface, type WalletAccountV6 } from "starknet";
import {
  canonicalAssetId, deriveClaimCommitment, deriveNullifier, deriveExecNonce, deriveSlotKey, type Felt,
} from "./derive.ts";

// The Wallet API route (docs/INTEGRATING.md): Sole talks to the user's
// privacy-enabled wallet, never to a viewing key. WalletAccountV6 is the
// starknet.js >=10.4.0 type exposing strk20InvokeTransaction/strk20Balances.
// It requires a real connected wallet extension - it cannot be constructed
// headlessly from a private key alone.
export type SoleAccount = WalletAccountV6;

// register() carries no value and never goes through privacy_invoke (see
// IClaimAnonymizer::register), so it only needs plain execute() - any
// Account works here, script-held key included, not just a connected wallet.
export type ExecutableAccount = Pick<AccountInterface, "execute">;

// Plain const objects, not TS `enum`: an enum compiles to real runtime code,
// not just type annotations, which `node --experimental-strip-types` (how
// scripts/*.ts run in this repo) cannot transform - it only strips types.
export const RightState = {
  Unclaimed: "UNCLAIMED",
  Active: "ACTIVE",
  Consumed: "CONSUMED",
} as const;
export type RightState = typeof RightState[keyof typeof RightState];

/** starknet.js decodes a Cairo enum return as a CairoCustomEnum object, e.g.
 * `{ variant: { Unclaimed: undefined, Active: {}, Consumed: undefined } }`.
 * Treating that object as a number produces NaN and silently falls back to
 * UNCLAIMED, which makes a real ACTIVE claim look as if it never landed. Keep
 * the numeric fallback for providers/ABIs that still return enum indices. */
export function decodeRightState(raw: any): RightState {
  const variant = raw != null && typeof raw === "object" ? (raw.variant ?? raw) : null;
  if (variant != null && typeof variant === "object") {
    if (variant.Active !== undefined) return RightState.Active;
    if (variant.Consumed !== undefined) return RightState.Consumed;
    if (variant.Unclaimed !== undefined) return RightState.Unclaimed;
  }
  if (typeof variant === "string") {
    if (variant === "Active") return RightState.Active;
    if (variant === "Consumed") return RightState.Consumed;
    if (variant === "Unclaimed") return RightState.Unclaimed;
  }
  const n = typeof raw === "bigint" ? Number(raw) : Number(raw?.toString?.() ?? raw);
  return [RightState.Unclaimed, RightState.Active, RightState.Consumed][n] ?? RightState.Unclaimed;
}

// Mirrors the Cairo enum's declaration order in claim_anonymizer.cairo -
// Starknet encodes an enum as its variant index, so this order is load-bearing.
const ClaimOperation = { Claim: 0, Settle: 1, Finance: 2, SettleAndRepay: 3 } as const;
type ClaimOperation = typeof ClaimOperation[keyof typeof ClaimOperation];

// Every field ClaimAnonymizer::privacy_invoke's flat positional signature
// accepts. Each call fills in what its operation needs; the rest zero-fill,
// the same convention the Escrow reference helper uses for its ignored
// fields per branch.
interface PrivacyInvokeArgs {
  slotKey?: Felt;
  claimCommitment?: Felt;
  nullifier?: Felt;
  adapter?: Felt;
  authSlotKey?: Felt;
  authNonce?: Felt;
  amountCommitment?: Felt;
}

const ZERO: Felt = "0x0";
const toFelt = (n: number | bigint): Felt => "0x" + n.toString(16);

// starknet.js's waitForTransaction only bounds itself by a retry *count*
// (default 200 at 5s each - up to ~16 minutes), which assumes each poll
// eventually settles. A single hung fetch to a public RPC node - no
// response, no error, no built-in HTTP timeout - never lets that counter
// move, so a `{ retries: N }` option alone cannot guarantee the call
// returns. Racing against a real timer is the only thing that does; the
// underlying transaction is unaffected either way, this only bounds how
// long this call waits to find out.
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

const READY_SUBMISSION_TIMEOUT_MS = 180_000;
const READY_PREPARATION_TIMEOUT_MS = 30_000;
const INVALID_REQUEST_PAYLOAD_CODE = 114;
const INSUFFICIENT_PRIVATE_BALANCE_CODE = 119;

/** By default Sole sends only the protocol-valid `invoke` action. Older Ready
 * builds have been observed rejecting that shape with code 114 before any
 * signing or submission. A caller may explicitly opt into the historical
 * deposit+invoke compatibility shape after surfacing its cost to the user;
 * the SDK never selects that value-moving workaround on its own. */
export interface PrivacyInvokeOptions {
  useCompanionDeposit?: boolean;
}

/** Ready owns proof generation and submission. There is no Wallet API abort
 * signal, so timing out only releases the dapp UI: the original request may
 * still resolve with a hash later and must remain observable/reconcilable. */
export class ReadySubmissionTimeoutError extends Error {
  readonly outcomeUnknown = true;
  readonly lateSubmission: Promise<{ transaction_hash: string }>;

  constructor(lateSubmission: Promise<{ transaction_hash: string }>) {
    super("Ready did not return a transaction hash after ~3 minutes");
    this.name = "ReadySubmissionTimeoutError";
    this.lateSubmission = lateSubmission;
  }
}

/** A no-gas Wallet API preparation rejected the standalone action. Code 114
 * is the Wallet API's generic INVALID_REQUEST_PAYLOAD code: it does not prove
 * why Ready rejected the payload or that a deposit will fix it. This is not a
 * transaction outcome: no call was signed, relayed, or sent. An application
 * may expose a separately confirmed legacy action shape as an experiment, but
 * must never silently spend or retry because of this error. */
export class ReadyStandaloneInvokeRejectedError extends Error {
  readonly noSubmission = true;
  readonly mayUseCompanionDeposit = true;
  readonly code: number;
  readonly data: unknown;

  constructor(cause: any) {
    super(
      "Ready rejected the standalone private invoke during a no-gas preparation. " +
      "No transaction was sent. INVALID_REQUEST_PAYLOAD is generic and does not establish that a companion deposit will help.",
    );
    this.name = "ReadyStandaloneInvokeRejectedError";
    this.code = cause?.code ?? INVALID_REQUEST_PAYLOAD_CODE;
    this.data = cause?.data;
  }
}

/** No-gas preparation found that the wallet cannot cover its automatic
 * private-action/relayer fee from shielded STRK. Shield funds deliberately in
 * Ready, then retry as a fresh action; do not make the dapp top up silently. */
export class ReadyPrivateBalanceRequiredError extends Error {
  readonly noSubmission = true;
  readonly requiresPrivateBalance = true;
  readonly code: number;
  readonly data: unknown;

  constructor(cause: any) {
    super(
      "Ready reports insufficient shielded STRK for the private-action fee. " +
      "No transaction was sent. Shield funds deliberately in Ready, then retry.",
    );
    this.name = "ReadyPrivateBalanceRequiredError";
    this.code = cause?.code ?? INSUFFICIENT_PRIVATE_BALANCE_CODE;
    this.data = cause?.data;
  }
}

export async function waitForReadySubmission<T extends { transaction_hash: string }>(
  submission: Promise<T>, timeoutMs = READY_SUBMISSION_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Keep a rejection handler attached after the UI has timed out. The wallet
  // request cannot be cancelled, but a later rejection must not become an
  // unhandled promise rejection in the page.
  void submission.catch(() => undefined);
  try {
    return await Promise.race([
      submission,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new ReadySubmissionTimeoutError(submission)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// STRK's mainnet ERC-20 address (verified live: symbol() -> "STRK",
// decimals() -> 18). It is used solely by the explicit legacy companion
// deposit option. A standalone `invoke` is a valid Wallet API action; the
// transfer in most private-DeFi examples opens an output note and is not a
// general requirement for invoke validity.
const STRK_MAINNET: Felt = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

// Wallet API error code for "account has no viewing key registered with the
// STRK20 pool yet" (@starknet-io/starknet-types-0104 wallet-api/errors.d.ts).
const NOT_REGISTERED_CODE = 118;

// The Wallet API's FELT type is spec'd as ^0x(0|[a-fA-F1-9]{1}[a-fA-F0-9]{0,62})$
// - no leading zero digits, unlike sncast/explorer display addresses (this
// repo's deployed addresses, e.g. "0x0788f8...", all carry one). A wallet
// enforcing that pattern on strk20InvokeTransaction's payload rejects a
// zero-padded value outright (INVALID_REQUEST_PAYLOAD), even though the same
// address works fine through a plain account.execute() call, which is far
// more lenient about hex formatting. Every felt reaching the wallet API must
// be re-normalized through this, not just the addresses known to be padded
// today - Poseidon outputs are normalized already, but there's no guarantee
// a future one won't happen to start with a zero nibble.
export const normalizeFelt = (hex: string): Felt => "0x" + BigInt(hex).toString(16);

export interface SoleAddresses {
  registry: string;
  anonymizer: string;
  pool: string; // STRK20 privacy pool
  adapter: string; // configured ExecutionAdapter
}

// Convenience data shapes for local callers. The registry holds only the
// public fields; this SDK does not implement a scoped-disclosure protocol or
// auditor-key access control (docs/PRIVACY_BOUNDARY.md).
export interface PublicView { slotKey: Felt; state: RightState }
export interface ClaimantView extends PublicView { claimCommitment: Felt; claimedAt?: number }
export interface CounterpartyView { slotKey: Felt; satisfied: boolean }
export interface AuditorView extends ClaimantView { nullifier?: Felt; consumedAt?: number }

/** The result of a read-only reconciliation after a wallet did not give the
 * dapp a conclusive result. The commitment is public; its preimage remains
 * only with the claimant. */
export interface ClaimReconciliation extends ClaimantView { matchesExpectedClaim: boolean }

function sameFelt(a: unknown, b: unknown): boolean {
  try { return BigInt(a as string) === BigInt(b as string); } catch { return false; }
}

/** Verify the exact transition this SDK asked the registry to perform. An
 * address-only event match is insufficient: a registry can emit more than one
 * event type, and a stale event must never make a claim look successful. */
export function hasExactRightClaim(
  receipt: any, registry: string, slotKey: string, claimCommitment: string,
): boolean {
  const selector = hash.getSelectorFromName("RightClaimed");
  return (receipt?.events ?? []).some((event: any) =>
    sameFelt(event.from_address, registry)
    && sameFelt(event.keys?.[0], selector)
    && sameFelt(event.keys?.[1], slotKey)
    && sameFelt(event.data?.[0], claimCommitment),
  );
}

/** Same strict event check for the paid, per-right registration step. An
 * UNCLAIMED state alone is not proof a right was registered: it is also the
 * storage default for an unknown slot. */
export function hasExactRightRegistration(receipt: any, registry: string, slotKey: string): boolean {
  const selector = hash.getSelectorFromName("RightRegistered");
  return (receipt?.events ?? []).some((event: any) =>
    sameFelt(event.from_address, registry)
    && sameFelt(event.keys?.[0], selector)
    && sameFelt(event.keys?.[1], slotKey),
  );
}

export class SoleClient {
  // Explicit fields, not constructor parameter properties: the shorthand
  // generates real assignment code, which - like `enum` - strip-only mode
  // cannot transform.
  private provider: RpcProvider;
  private addrs: SoleAddresses;
  private registryAbi: any;
  // Cached result of the pool's get_fee_amount(), fetched live and never
  // hardcoded. It is used only for the user-selected Ready compatibility
  // deposit, not for the default standalone invoke path.
  private feeAmount: bigint | null = null;

  constructor(provider: RpcProvider, addrs: SoleAddresses, registryAbi: any) {
    this.provider = provider;
    this.addrs = addrs;
    this.registryAbi = registryAbi;
  }

  private registry() {
    return new Contract({
      abi: this.registryAbi, address: this.addrs.registry, providerOrAccount: this.provider,
    });
  }

  /** The pool's current flat per-action fee, read live (never hardcoded -
   *  it's admin-settable and has already changed once since first
   *  documented). Cached after the first call. */
  private async getFeeAmount(): Promise<bigint> {
    if (this.feeAmount !== null) return this.feeAmount;
    const cls: any = await this.provider.getClassAt(this.addrs.pool);
    const pool = new Contract({ abi: cls.abi, address: this.addrs.pool, providerOrAccount: this.provider });
    const fee: bigint = await pool.get_fee_amount();
    this.feeAmount = fee;
    return fee;
  }

  /** The explicit legacy Ready compatibility deposit. It is deliberately
   *  twice the current fee because Ready appends its own fee withdrawal; the
   *  resulting gross shield is not an extra gas charge. This is not a
   *  STRK20 protocol requirement and must never be selected automatically. */
  private async privacyActionDeposit(): Promise<Felt> {
    const fee = await this.getFeeAmount();
    return toFelt(fee * 2n);
  }

  // ----- identity -----
  slotKeyFor(reference: string): Felt {
    return deriveSlotKey(canonicalAssetId(reference));
  }

  // ----- public projection: anyone with the reference sees only state -----
  async publicView(reference: string): Promise<PublicView> {
    const slotKey = this.slotKeyFor(reference);
    const raw = await this.registry().state_of(slotKey);
    return { slotKey, state: this.decodeState(raw) };
  }

  /** Read the registry's public claim record. This is deliberately separate
   * from the local claimant secret: the commitment lets a caller determine
   * whether an ambiguous wallet request was *their* claim without exposing
   * that secret. */
  async claimRecord(reference: string): Promise<ClaimantView> {
    const slotKey = this.slotKeyFor(reference);
    const registry = this.registry();
    const [rawState, rawCommitment] = await Promise.all([
      registry.state_of(slotKey),
      registry.commitment_of(slotKey),
    ]);
    return {
      slotKey,
      state: this.decodeState(rawState),
      claimCommitment: normalizeFelt(rawCommitment.toString()),
    };
  }

  /** Read-only recovery for a sponsored-wallet response that timed out or
   * otherwise did not return a transaction hash. No transaction is sent. */
  async reconcileClaim(reference: string, expectedCommitment: Felt): Promise<ClaimReconciliation> {
    const record = await this.claimRecord(reference);
    return {
      ...record,
      matchesExpectedClaim: record.state === RightState.Active
        && sameFelt(record.claimCommitment, expectedCommitment),
    };
  }

  /** Availability check without a holder field in the registry response. */
  async isClaimable(reference: string): Promise<boolean> {
    return (await this.publicView(reference)).state === RightState.Unclaimed;
  }

  // ----- transitions -----

  /** Register a canonical right (UNCLAIMED). Carries no value, so it calls
   *  the anonymizer directly - it is not gated behind the pool's
   *  privacy_invoke (see IClaimAnonymizer::register). */
  async register(account: ExecutableAccount, reference: string): Promise<string> {
    const slotKey = this.slotKeyFor(reference);
    return this.anonymizerCall(account, "register", [slotKey]);
  }

  /** Acquire the exclusive claim. Local preimages derive an opaque commitment;
   *  the registry receives the commitment, not its preimage. */
  async claim(
    account: SoleAccount, reference: string, claimantSecret: Felt, fundingNote: Felt,
    options: PrivacyInvokeOptions = {},
  ): Promise<{ tx: string; claimCommitment: Felt }> {
    const slotKey = this.slotKeyFor(reference);
    const claimCommitment = deriveClaimCommitment(slotKey, claimantSecret, fundingNote);
    const tx = await this.privacyInvoke(
      account, ClaimOperation.Claim, { slotKey, claimCommitment }, this.addrs.registry,
      (receipt) => hasExactRightClaim(receipt, this.addrs.registry, slotKey, claimCommitment),
      options,
    );
    const record = await this.reconcileClaim(reference, claimCommitment);
    if (!record.matchesExpectedClaim) {
      throw Object.assign(
        new Error(
          `claim transaction confirmed but the registry does not contain the expected ACTIVE claim ` +
          `(tx: ${tx}). Do not resubmit until its on-chain state is reconciled.`,
        ),
        { txHash: tx, state: record.state, actualCommitment: record.claimCommitment },
      );
    }
    return { tx, claimCommitment };
  }

  /** Consume the right. Reveals the nullifier; only the holder can produce it. */
  async settle(
    account: SoleAccount, reference: string, claimantSecret: Felt, options: PrivacyInvokeOptions = {},
  ): Promise<string> {
    const slotKey = this.slotKeyFor(reference);
    const nullifier = deriveNullifier(claimantSecret, slotKey);
    return this.privacyInvoke(account, ClaimOperation.Settle, { slotKey, nullifier }, this.addrs.registry, undefined, options);
  }

  /** Record one adapter position action. It runs only while the right is
   *  ACTIVE; the adapter re-checks Sole's state. The deployed fallback adapter
   *  records an opaque commitment and does not transfer assets. */
  async finance(
    account: SoleAccount, reference: string, claimCommitment: Felt, amountCommitment: Felt,
    options: PrivacyInvokeOptions = {},
  ): Promise<string> {
    const slotKey = this.slotKeyFor(reference);
    const nonce = deriveExecNonce(slotKey, claimCommitment);
    return this.privacyInvoke(account, ClaimOperation.Finance,
      { adapter: this.addrs.adapter, authSlotKey: slotKey, authNonce: nonce, amountCommitment },
      this.addrs.adapter, undefined, options);
  }

  /** Clear the adapter position and consume the right, atomically. */
  async settleAndRepay(
    account: SoleAccount, reference: string, claimantSecret: Felt, claimCommitment: Felt,
    options: PrivacyInvokeOptions = {},
  ): Promise<string> {
    const slotKey = this.slotKeyFor(reference);
    const nullifier = deriveNullifier(claimantSecret, slotKey);
    const nonce = deriveExecNonce(slotKey, claimCommitment);
    return this.privacyInvoke(account, ClaimOperation.SettleAndRepay,
      { slotKey, nullifier, adapter: this.addrs.adapter, authSlotKey: slotKey, authNonce: nonce },
      this.addrs.adapter, undefined, options);
  }

  // ----- local projection helper -----
  counterpartyView(v: PublicView): CounterpartyView {
    return { slotKey: v.slotKey, satisfied: v.state === RightState.Consumed };
  }

  /**
   * Route a state transition through the STRK20 pool's privacy_invoke, which
   * dispatches into ClaimAnonymizer::privacy_invoke. Builds the full flat
   * positional calldata the Cairo side expects
   * (operation, slot_key, claim_commitment, nullifier, adapter, auth.slot_key,
   * auth.nonce, amount_commitment), zero-filling whatever this operation
   * doesn't use. Sole's privacy_invoke returns an empty Span<OpenNoteDeposit>
   * because it moves no value through the pool. A bare `invoke` is a valid
   * STRK20 Wallet API action; the output-opening transfer in swap examples is
   * needed by those helpers, not by Sole. The wallet adds its own private fee
   * withdrawal, so the user must have a sufficient shielded STRK balance.
   *
   * `useCompanionDeposit` retains the legacy [deposit, invoke] shape only as
   * an explicit caller choice. It uses twice the live pool fee because Ready
   * adds its own fee withdrawal. It is neither a protocol requirement nor an
   * automatic recovery for INVALID_REQUEST_PAYLOAD, which is a generic wallet
   * error and may have unrelated causes.
   *
   * Before each action, Sole asks Ready for a no-gas, non-submittable
   * preparation. This validates the exact action shape and lets the dapp stop
   * safely on a code 114/119 response before opening a paid wallet request.
   * The pool invokes the configured anonymizer after its private-action proof,
   * so the anonymizer - not the raw wallet - is the caller the registry
   * records. This does not establish transaction-level wallet unlinkability:
   * bundled pool deposits can be publicly correlated with the same slot
   * (docs/PRIVACY_BOUNDARY.md).
   *
   * strk20InvokeTransaction resolving is NOT proof the invoke ran: observed
   * live on mainnet, a combined deposit+invoke can confirm with no revert
   * while the wallet silently omits the invoke from what it actually submits
   * (verified by decoding the raw on-chain calldata - the anonymizer address
   * was simply absent). `expectAddress` is the contract only the invoke's
   * effect can touch (the registry for claim/settle, the adapter for
   * finance/settleAndRepay).
   *
   * waitForTransaction() does NOT throw on a reverted transaction by default
   * (its errorStates option defaults to empty - it only watches finality,
   * not execution outcome), so a real on-chain revert and a silently-dropped
   * invoke both surface the same way if you only check for the expected
   * event: no matching event, empty receipt.events either way. Conflating
   * them was a real bug here - a genuine revert (e.g. AUTH_NONCE_MISMATCH)
   * was being misread as "dropped" and retried automatically. This checks
   * execution_status first: a real revert throws immediately with the actual
   * reason, and a caller can decide what to do after a free reconciliation.
   *
   * No automatic retry on a successful-but-missing-event result either
   * anymore: firing a second strk20InvokeTransaction immediately back to
   * back with the first was itself producing wallet/paymaster-level
   * failures (PaymasterV2Error 156, no transaction ever submitted) with
   * balance ruled out as the cause - the rapid back-to-back pair is the
   * likely trigger, not anything in the calldata. The caller must reconcile
   * the registry state before deciding whether another action is safe; this
   * SDK never retries a privacy invocation inline.
   */
  /** Builds the action list privacyInvoke() submits. The value-moving
   *  companion deposit is constructed only after an explicit opt-in. */
  private async buildActions(
    operation: ClaimOperation, args: PrivacyInvokeArgs, useCompanionDeposit = false,
  ): Promise<Parameters<SoleAccount["strk20InvokeTransaction"]>[0]> {
    // Wallet-api FELT is a hex string, not a bigint - every field here must
    // already be (or become) "0x...", and normalized (see normalizeFelt).
    const calldata: Felt[] = [
      toFelt(operation),
      normalizeFelt(args.slotKey ?? ZERO),
      normalizeFelt(args.claimCommitment ?? ZERO),
      normalizeFelt(args.nullifier ?? ZERO),
      normalizeFelt(args.adapter ?? ZERO),
      normalizeFelt(args.authSlotKey ?? ZERO),
      normalizeFelt(args.authNonce ?? ZERO),
      normalizeFelt(args.amountCommitment ?? ZERO),
    ];
    const invokeAction = {
      type: "invoke" as const, contract: normalizeFelt(this.addrs.anonymizer), calldata,
    };
    if (!useCompanionDeposit) return [invokeAction];

    const depositAmount = await this.privacyActionDeposit();
    const depositAction = {
      type: "deposit" as const, token: normalizeFelt(STRK_MAINNET), amount: depositAmount,
    };
    return [depositAction, invokeAction];
  }

  /** Simulate an action set without proof/submission. The returned result is
   * non-submittable; therefore any error from this method is definitively a
   * no-transaction outcome. Do not give real submission errors this marker. */
  private async prepareInvoke(
    account: SoleAccount,
    actions: Parameters<SoleAccount["strk20InvokeTransaction"]>[0],
    standalone: boolean,
  ): Promise<any> {
    try {
      return await withTimeout(
        account.strk20PrepareInvoke(actions, true),
        READY_PREPARATION_TIMEOUT_MS,
        "Ready did not finish the no-gas private-action preparation after ~30 seconds",
      );
    } catch (e: any) {
      const code = Number(e?.code);
      if (standalone && code === INVALID_REQUEST_PAYLOAD_CODE) {
        throw new ReadyStandaloneInvokeRejectedError(e);
      }
      if (code === INSUFFICIENT_PRIVATE_BALANCE_CODE) {
        throw new ReadyPrivateBalanceRequiredError(e);
      }
      if (code === NOT_REGISTERED_CODE) {
        throw Object.assign(
          new Error(
            "STRK20 is not enabled for this wallet. In Ready, complete 'Enable private tokens' " +
            "on the main wallet view, then return here. No transaction was sent.",
          ),
          { code: e.code, data: e.data, cause: e, noSubmission: true },
        );
      }
      const shape = standalone ? "standalone invoke" : "legacy deposit-plus-invoke action";
      throw Object.assign(
        new Error(
          `Ready could not prepare the ${shape}. No transaction was sent: ${e?.message ?? String(e)}`,
        ),
        { code: e?.code, data: e?.data, cause: e, noSubmission: true },
      );
    }
  }

  /** Zero-cost diagnostic: runs the wallet's own pre-flight simulation
   *  (strk20PrepareInvoke with simulate=true) for the finance() call without
   *  submitting anything - no gas, no confirmation, no deposit moved. Returns
   *  whatever detail the wallet reports, which is typically far more specific
   *  than the generic PaymasterV2Error code a live attempt shows. */
  async dryRunFinance(
    account: SoleAccount, reference: string, claimCommitment: Felt, amountCommitment: Felt,
    options: PrivacyInvokeOptions = {},
  ): Promise<any> {
    const slotKey = this.slotKeyFor(reference);
    const nonce = deriveExecNonce(slotKey, claimCommitment);
    const actions = await this.buildActions(
      ClaimOperation.Finance,
      { adapter: this.addrs.adapter, authSlotKey: slotKey, authNonce: nonce, amountCommitment },
      options.useCompanionDeposit === true,
    );
    return this.prepareInvoke(account, actions, options.useCompanionDeposit !== true);
  }

  /** Same zero-cost pre-flight simulation as dryRunFinance, for claim().
   *  runs the same exact action shape with simulate=true instead of a real
   *  submission, so callers receive wallet diagnostics without sending a
   *  transaction. */
  async dryRunClaim(
    account: SoleAccount, reference: string, claimantSecret: Felt, fundingNote: Felt,
    options: PrivacyInvokeOptions = {},
  ): Promise<any> {
    const slotKey = this.slotKeyFor(reference);
    const claimCommitment = deriveClaimCommitment(slotKey, claimantSecret, fundingNote);
    const actions = await this.buildActions(
      ClaimOperation.Claim, { slotKey, claimCommitment }, options.useCompanionDeposit === true,
    );
    return this.prepareInvoke(account, actions, options.useCompanionDeposit !== true);
  }

  /** Builds the REAL proof for a claim() call - not a dry-run - without
   *  submitting it, for a caller that will submit it separately via a plain
   *  account's own execute() with explicit resource bounds. Used to capture
   *  a genuine on-chain revert (e.g. a duplicate claim) that Ready's own
   *  paymaster refuses to sponsor because its pre-flight predicts the
   *  failure: proof generation proves knowledge of a valid shielded
   *  claimant/funding note, which is independent of whether the eventual
   *  on-chain call succeeds or reverts, so Ready can build this proof even
   *  for a claim destined to fail. This only asks Ready to prepare - it
   *  reaches no network beyond that until the caller submits {call, proof}
   *  itself. */
  async prepareClaimForSelfPaidSubmission(
    account: SoleAccount, reference: string, claimantSecret: Felt, fundingNote: Felt,
    options: PrivacyInvokeOptions = {},
  ): Promise<{ call: any; proof: any; claimCommitment: Felt }> {
    const slotKey = this.slotKeyFor(reference);
    const claimCommitment = deriveClaimCommitment(slotKey, claimantSecret, fundingNote);
    const actions = await this.buildActions(
      ClaimOperation.Claim, { slotKey, claimCommitment }, options.useCompanionDeposit === true,
    );
    const { call, proof } = await withTimeout(
      account.strk20PrepareInvoke(actions, false),
      READY_PREPARATION_TIMEOUT_MS,
      "Ready did not finish building the real proof after ~30 seconds",
    );
    return { call, proof, claimCommitment };
  }

  private async privacyInvoke(
    account: SoleAccount, operation: ClaimOperation, args: PrivacyInvokeArgs, expectAddress: Felt,
    verifyReceipt?: (receipt: any) => boolean,
    options: PrivacyInvokeOptions = {},
  ): Promise<string> {
    const actions = await this.buildActions(operation, args, options.useCompanionDeposit === true);
    await this.prepareInvoke(account, actions, options.useCompanionDeposit !== true);

    const attempt = async (
      actions: Parameters<SoleAccount["strk20InvokeTransaction"]>[0],
    ): Promise<{ hash: string; reverted: boolean; revertReason?: string; ran: boolean }> => {
      let hash: string;
      try {
        // The Wallet API may be proving and relaying for a long time, but a
        // bridge promise that never settles must not pin the dapp in
        // "Claiming…" forever. Timing out here does not cancel the request;
        // ReadySubmissionTimeoutError keeps its original promise available
        // for callers to reconcile without ever retrying automatically.
        const submission = account.strk20InvokeTransaction(actions);
        ({ transaction_hash: hash } = await waitForReadySubmission(submission));
      } catch (e: any) {
        if (e?.code !== NOT_REGISTERED_CODE) throw e;
        // Never hide an additional paid operation behind a claim. Ready's
        // account setup must be completed explicitly by the wallet owner;
        // auto-depositing and immediately retrying can queue requests and
        // leave the dapp unable to correlate the eventual transaction.
        throw Object.assign(
          new Error(
            "STRK20 is not enabled for this wallet. In Ready, complete 'Enable private tokens' " +
            "on the main wallet view, then return here. Sole did not send an extra setup transaction.",
          ),
          { code: e.code, data: e.data, cause: e },
        );
      }
      // retries alone doesn't bound this against a single hung RPC fetch
      // (see withTimeout) - a real timer is what actually guarantees this
      // returns within ~90s.
      let receipt: any;
      try {
        receipt = await withTimeout(
          this.provider.waitForTransaction(hash, { retries: 24 }),
          90_000,
          `still not confirmed after ~90s (tx: ${hash})`,
        );
      } catch (e: any) {
        throw Object.assign(
          new Error(
            `${e?.message ?? "still not confirmed"} (tx: ${hash}). It may still land - check its ` +
            "status before resubmitting, rather than retrying blind.",
          ),
          { txHash: hash, cause: e },
        );
      }
      if (receipt.execution_status === "REVERTED") {
        return { hash, reverted: true, revertReason: receipt.revert_reason, ran: false };
      }
      const expected = BigInt(expectAddress);
      const ran = verifyReceipt
        ? verifyReceipt(receipt)
        : (receipt.events ?? []).some(
          (e: any) => e.from_address != null && BigInt(e.from_address) === expected,
        );
      return { hash, reverted: false, ran };
    };

    const result = await attempt(actions);
    if (result.reverted) {
      throw Object.assign(
        new Error(`privacy_invoke reverted: ${result.revertReason ?? "(no reason reported)"}`),
        { txHash: result.hash, revertReason: result.revertReason },
      );
    }
    if (result.ran) return result.hash;

    throw Object.assign(
      new Error(
        `privacy_invoke did not reach ${expectAddress} (tx: ${result.hash}). The transaction ` +
        "succeeded but the wallet did not execute the invoke action - a known intermittent " +
        "issue. Wait a moment and try this action again as a fresh attempt.",
      ),
      { txHash: result.hash },
    );
  }

  /** Direct (non-pool) call into the anonymizer, for operations that carry
   *  no value - currently just register(). A normal Starknet call: no
   *  privacy_invoke wrapping, since nothing here needs the wallet's viewing
   *  key or proving path. */
  private async anonymizerCall(
    account: ExecutableAccount, method: string, calldata: Felt[],
  ): Promise<string> {
    const { transaction_hash } = await account.execute({
      contractAddress: this.addrs.anonymizer,
      entrypoint: method,
      calldata,
    });
    return transaction_hash;
  }

  private decodeState(raw: any): RightState {
    return decodeRightState(raw);
  }
}
