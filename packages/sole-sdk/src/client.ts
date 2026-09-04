// SPDX-License-Identifier: Apache-2.0
//
// Sole SDK - client
// How another application integrates Sole WITHOUT cloning this repo. A private
// rights app constructs a SoleClient with the deployed registry/anonymizer/pool
// addresses and drives the lifecycle. All privacy-bearing calls route through
// the STRK20 pool's privacy_invoke so the caller wallet never links to the
// claim (see docs/INTEGRATING.md for the exact wiring).

import { Account, Contract, RpcProvider } from "starknet";
import {
  canonicalAssetId, deriveClaimCommitment, deriveNullifier, deriveExecNonce, deriveSlotKey, Felt,
} from "./derive";

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
  adapter?: string;
  authSlotKey?: Felt;
  authNonce?: Felt;
  amountCommitment?: Felt;
}

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
    return new Contract(this.registryAbi, this.addrs.registry, this.provider);
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
  async register(account: Account, reference: string): Promise<string> {
    const slotKey = this.slotKeyFor(reference);
    return this.anonymizerCall(account, "register", [slotKey]);
  }

  /** Acquire the exclusive claim, binding shielded funding. The claimantSecret
   *  and fundingNote stay client-side; only the commitment reaches chain. */
  async claim(
    account: Account, reference: string, claimantSecret: Felt, fundingNote: Felt,
  ): Promise<{ tx: string; claimCommitment: Felt }> {
    const slotKey = this.slotKeyFor(reference);
    const claimCommitment = deriveClaimCommitment(slotKey, claimantSecret, fundingNote);
    const tx = await this.privacyInvoke(account, ClaimOperation.Claim, { slotKey, claimCommitment });
    return { tx, claimCommitment };
  }

  /** Consume the right. Reveals the nullifier; only the holder can produce it. */
  async settle(account: Account, reference: string, claimantSecret: Felt): Promise<string> {
    const slotKey = this.slotKeyFor(reference);
    const nullifier = deriveNullifier(claimantSecret, slotKey);
    return this.privacyInvoke(account, ClaimOperation.Settle, { slotKey, nullifier });
  }

  /** Authorize + execute one financing action against the venue. Only runs
   *  because A holds an ACTIVE right; the adapter re-checks Sole's state. */
  async finance(
    account: Account, reference: string, claimCommitment: Felt, amountCommitment: Felt,
  ): Promise<string> {
    const slotKey = this.slotKeyFor(reference);
    const nonce = deriveExecNonce(slotKey, claimCommitment);
    return this.privacyInvoke(account, ClaimOperation.Finance,
      { adapter: this.addrs.adapter, authSlotKey: slotKey, authNonce: nonce, amountCommitment });
  }

  /** Settle: repay the venue position and consume the right, atomically. */
  async settleAndRepay(
    account: Account, reference: string, claimantSecret: Felt, claimCommitment: Felt,
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
   * doesn't use. The pool proves a shielded funding note in ZK before
   * dispatching, so the anonymizer - not the raw wallet - is the caller the
   * registry records. The concrete pool-SDK construction lives in
   * docs/INTEGRATING.md; kept as one seam here so integrators swap in the
   * pool SDK call without touching Sole logic.
   */
  private async privacyInvoke(
    account: Account, operation: ClaimOperation, args: PrivacyInvokeArgs,
  ): Promise<string> {
    const calldata: Felt[] = [
      BigInt(operation),
      args.slotKey ?? 0n,
      args.claimCommitment ?? 0n,
      args.nullifier ?? 0n,
      BigInt(args.adapter ?? "0x0"),
      args.authSlotKey ?? 0n,
      args.authNonce ?? 0n,
      args.amountCommitment ?? 0n,
    ];
    // Placeholder seam - wired to the STRK20 pool SDK (starknet.js v10.4.0 +
    // Ready wallet) in the web app. Documented as a DEMO seam, not a hidden
    // guarantee (see SECURITY.md and the starter-kit "replace DEMO markers"
    // note honored in apps/web).
    throw new Error(
      `privacyInvoke(privacy_invoke, op=${ClaimOperation[operation]}, calldata=[${calldata}]) ` +
      `must be bound to the STRK20 pool SDK - see docs/INTEGRATING.md`,
    );
  }

  /** Direct (non-pool) call into the anonymizer, for operations that carry
   *  no value - currently just register(). */
  private async anonymizerCall(
    account: Account, method: string, calldata: Felt[],
  ): Promise<string> {
    // Placeholder seam - see privacyInvoke above; this path skips the pool
    // entirely and calls the anonymizer directly with the user's wallet.
    throw new Error(
      `anonymizerCall(${method}) must be bound to a real Account.execute call`,
    );
  }

  private decodeState(raw: any): RightState {
    const n = typeof raw === "bigint" ? Number(raw) : Number(raw?.toString?.() ?? raw);
    return [RightState.Unclaimed, RightState.Active, RightState.Consumed][n] ?? RightState.Unclaimed;
  }
}
