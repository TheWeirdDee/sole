// SPDX-License-Identifier: Apache-2.0
//
// Sole SDK - client
// How another application integrates Sole WITHOUT cloning this repo. A private
// rights app constructs a SoleClient with the deployed registry/anonymizer/pool
// addresses and drives the lifecycle. All privacy-bearing calls route through
// the STRK20 pool's privacy_invoke so the caller wallet never links to the
// claim (see docs/INTEGRATING.md for the exact wiring).

import { Contract, RpcProvider, type AccountInterface, type WalletAccountV6 } from "starknet";
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

// STRK's mainnet ERC-20 address (verified live: symbol() -> "STRK",
// decimals() -> 18). Every documented privacy_invoke example - Swap, Vesu,
// Escrow, and even the lower-level starknet-privacy-sdk builder - pairs the
// invoke action with a real value-moving action (withdraw/deposit/transfer)
// in the same STRK20 transaction; none show invoke used completely alone.
// A bare invoke-only actions array is rejected by the wallet as
// INVALID_REQUEST_PAYLOAD before it ever reaches proving. This deposits the
// flat per-action fee (see SETUP.md/README) from the caller's own public
// balance into their own private balance - never sent elsewhere, and rolled
// back atomically with the rest of the transaction if the invoke reverts.
const STRK_MAINNET: Felt = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const PRIVACY_ACTION_FEE: Felt = "0x3782dace9d900000"; // 4 STRK (18 decimals)

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
  adapter: string; // ExecutionAdapter (Vesu or FallbackMarket)
}

// What a given viewer is permitted to learn. The registry only ever holds the
// PUBLIC projection; the richer projections are reconstructed by a party that
// holds the relevant secret or a scoped viewing key (docs/PRIVACY_BOUNDARY.md).
export interface PublicView { slotKey: Felt; state: RightState }
export interface ClaimantView extends PublicView { claimCommitment: Felt; claimedAt?: number }
export interface CounterpartyView { slotKey: Felt; satisfied: boolean }
export interface AuditorView extends ClaimantView { nullifier?: Felt; consumedAt?: number }

export class SoleClient {
  // Explicit fields, not constructor parameter properties: the shorthand
  // generates real assignment code, which - like `enum` - strip-only mode
  // cannot transform.
  private provider: RpcProvider;
  private addrs: SoleAddresses;
  private registryAbi: any;

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

  /** Availability check without revealing who holds it. The core question Sole
   *  answers: "can I safely claim this?" - not "who has this?" */
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

  /** Acquire the exclusive claim, binding shielded funding. The claimantSecret
   *  and fundingNote stay client-side; only the commitment reaches chain. */
  async claim(
    account: SoleAccount, reference: string, claimantSecret: Felt, fundingNote: Felt,
  ): Promise<{ tx: string; claimCommitment: Felt }> {
    const slotKey = this.slotKeyFor(reference);
    const claimCommitment = deriveClaimCommitment(slotKey, claimantSecret, fundingNote);
    const tx = await this.privacyInvoke(account, ClaimOperation.Claim, { slotKey, claimCommitment });
    return { tx, claimCommitment };
  }

  /** Consume the right. Reveals the nullifier; only the holder can produce it. */
  async settle(account: SoleAccount, reference: string, claimantSecret: Felt): Promise<string> {
    const slotKey = this.slotKeyFor(reference);
    const nullifier = deriveNullifier(claimantSecret, slotKey);
    return this.privacyInvoke(account, ClaimOperation.Settle, { slotKey, nullifier });
  }

  /** Authorize + execute one financing action against the venue. Only runs
   *  because A holds an ACTIVE right; the adapter re-checks Sole's state. */
  async finance(
    account: SoleAccount, reference: string, claimCommitment: Felt, amountCommitment: Felt,
  ): Promise<string> {
    const slotKey = this.slotKeyFor(reference);
    const nonce = deriveExecNonce(slotKey, claimCommitment);
    return this.privacyInvoke(account, ClaimOperation.Finance,
      { adapter: this.addrs.adapter, authSlotKey: slotKey, authNonce: nonce, amountCommitment });
  }

  /** Settle: repay the venue position and consume the right, atomically. */
  async settleAndRepay(
    account: SoleAccount, reference: string, claimantSecret: Felt, claimCommitment: Felt,
  ): Promise<string> {
    const slotKey = this.slotKeyFor(reference);
    const nullifier = deriveNullifier(claimantSecret, slotKey);
    const nonce = deriveExecNonce(slotKey, claimCommitment);
    return this.privacyInvoke(account, ClaimOperation.SettleAndRepay,
      { slotKey, nullifier, adapter: this.addrs.adapter, authSlotKey: slotKey, authNonce: nonce });
  }

  // ----- scoped disclosure projections -----
  counterpartyView(v: PublicView): CounterpartyView {
    return { slotKey: v.slotKey, satisfied: v.state === RightState.Consumed };
  }

  /**
   * Route a state transition through the STRK20 pool's privacy_invoke, which
   * dispatches into ClaimAnonymizer::privacy_invoke - one entry point, the
   * same calling convention as every STRK20 anonymizer helper (Swap, Vesu,
   * Escrow). Builds the full flat positional calldata the Cairo side expects
   * (operation, slot_key, claim_commitment, nullifier, adapter, auth.slot_key,
   * auth.nonce, amount_commitment), zero-filling whatever this operation
   * doesn't use. Sole's privacy_invoke always returns an empty
   * Span<OpenNoteDeposit> (it moves no value through the pool), but the
   * transaction still needs a real value-moving action alongside the invoke -
   * every documented anonymizer helper (Swap, Vesu, Escrow) pairs invoke with
   * a withdraw/deposit/transfer, and a bare invoke-only actions array is
   * rejected by the wallet as INVALID_REQUEST_PAYLOAD before it ever reaches
   * proving. A `deposit` of the flat per-action fee into the caller's own
   * private balance satisfies that without moving value anywhere but back to
   * them, and rolls back atomically if the invoke reverts. The wallet proves
   * a shielded funding note in ZK before dispatching, so the anonymizer - not
   * the raw wallet - is the caller the registry records (docs/INTEGRATING.md,
   * strk20-wallet-api/private-defi).
   */
  private async privacyInvoke(
    account: SoleAccount, operation: ClaimOperation, args: PrivacyInvokeArgs,
  ): Promise<string> {
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
    const { transaction_hash } = await account.strk20InvokeTransaction([
      { type: "deposit", token: normalizeFelt(STRK_MAINNET), amount: PRIVACY_ACTION_FEE },
      { type: "invoke", contract: normalizeFelt(this.addrs.anonymizer), calldata },
    ]);
    return transaction_hash;
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
    const n = typeof raw === "bigint" ? Number(raw) : Number(raw?.toString?.() ?? raw);
    return [RightState.Unclaimed, RightState.Active, RightState.Consumed][n] ?? RightState.Unclaimed;
  }
}
