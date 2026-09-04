// SPDX-License-Identifier: Apache-2.0
//
// Sole SDK - client
// How another application integrates Sole WITHOUT cloning this repo. A private
// rights app constructs a SoleClient with the deployed registry/anonymizer/pool
// addresses and drives the lifecycle. All privacy-bearing calls route through
// the STRK20 pool's privacy_invoke so the caller wallet never links to the
// claim (see docs/INTEGRATING.md for the exact wiring).

import { Contract, RpcProvider, type WalletAccountV6 } from "starknet";
import {
  canonicalAssetId, deriveClaimCommitment, deriveNullifier, deriveExecNonce, deriveSlotKey, Felt,
} from "./derive";

// The Wallet API route (docs/INTEGRATING.md): Sole talks to the user's
// privacy-enabled wallet, never to a viewing key. WalletAccountV6 is the
// starknet.js >=10.4.0 type exposing strk20InvokeTransaction/strk20Balances.
export type SoleAccount = WalletAccountV6;

export enum RightState {
  Unclaimed = "UNCLAIMED",
  Active = "ACTIVE",
  Consumed = "CONSUMED",
}

// Mirrors the Cairo enum's declaration order in claim_anonymizer.cairo -
// Starknet encodes an enum as its variant index, so this order is load-bearing.
enum ClaimOperation { Claim = 0, Settle = 1, Finance = 2, SettleAndRepay = 3 }

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
  constructor(
    private provider: RpcProvider,
    private addrs: SoleAddresses,
    private registryAbi: any,
  ) {}

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
  async register(account: SoleAccount, reference: string): Promise<string> {
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
   * doesn't use. No open-note transfer action is needed alongside it: unlike
   * Swap/Vesu, privacy_invoke always returns an empty Span<OpenNoteDeposit>
   * (Sole moves no value through the pool), so the transaction is the single
   * invoke action alone. The wallet proves a shielded funding note in ZK
   * before dispatching, so the anonymizer - not the raw wallet - is the
   * caller the registry records (docs/INTEGRATING.md,
   * strk20-wallet-api/private-defi).
   */
  private async privacyInvoke(
    account: SoleAccount, operation: ClaimOperation, args: PrivacyInvokeArgs,
  ): Promise<string> {
    // Wallet-api FELT is a hex string, not a bigint - every field here must
    // already be (or become) "0x...".
    const calldata: Felt[] = [
      toFelt(operation),
      args.slotKey ?? ZERO,
      args.claimCommitment ?? ZERO,
      args.nullifier ?? ZERO,
      args.adapter ?? ZERO,
      args.authSlotKey ?? ZERO,
      args.authNonce ?? ZERO,
      args.amountCommitment ?? ZERO,
    ];
    const { transaction_hash } = await account.strk20InvokeTransaction([
      { type: "invoke", contract: this.addrs.anonymizer, calldata },
    ]);
    return transaction_hash;
  }

  /** Direct (non-pool) call into the anonymizer, for operations that carry
   *  no value - currently just register(). A normal Starknet call: no
   *  privacy_invoke wrapping, since nothing here needs the wallet's viewing
   *  key or proving path. */
  private async anonymizerCall(
    account: SoleAccount, method: string, calldata: Felt[],
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
