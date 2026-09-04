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

  // ----- transitions (routed through privacy_invoke on the pool) -----

  /** Register a canonical right (UNCLAIMED). Carries no value. */
  async register(account: Account, reference: string): Promise<string> {
    const slotKey = this.slotKeyFor(reference);
    return this.privacyInvoke(account, "register", [slotKey]);
  }

  /** Acquire the exclusive claim, binding shielded funding. The claimantSecret
   *  and fundingNote stay client-side; only the commitment reaches chain. */
  async claim(
    account: Account, reference: string, claimantSecret: Felt, fundingNote: Felt,
  ): Promise<{ tx: string; claimCommitment: Felt }> {
    const slotKey = this.slotKeyFor(reference);
    const claimCommitment = deriveClaimCommitment(slotKey, claimantSecret, fundingNote);
    const tx = await this.privacyInvoke(account, "claim_through", [slotKey, claimCommitment]);
    return { tx, claimCommitment };
  }

  /** Consume the right. Reveals the nullifier; only the holder can produce it. */
  async settle(account: Account, reference: string, claimantSecret: Felt): Promise<string> {
    const slotKey = this.slotKeyFor(reference);
    const nullifier = deriveNullifier(claimantSecret, slotKey);
    return this.privacyInvoke(account, "settle_through", [slotKey, nullifier]);
  }

  /** Authorize + execute one financing action against the venue. Only runs
   *  because A holds an ACTIVE right; the adapter re-checks Sole's state. */
  async finance(
    account: Account, reference: string, claimCommitment: Felt, amountCommitment: Felt,
  ): Promise<string> {
    const slotKey = this.slotKeyFor(reference);
    const nonce = deriveExecNonce(slotKey, claimCommitment);
    return this.privacyInvoke(account, "finance_through",
      [this.addrs.adapter, slotKey, nonce, amountCommitment]);
  }

  /** Settle: repay the venue position and consume the right, atomically. */
  async settleAndRepay(
    account: Account, reference: string, claimantSecret: Felt, claimCommitment: Felt,
  ): Promise<string> {
    const slotKey = this.slotKeyFor(reference);
    const nullifier = deriveNullifier(claimantSecret, slotKey);
    const nonce = deriveExecNonce(slotKey, claimCommitment);
    return this.privacyInvoke(account, "settle_and_repay",
      [this.addrs.adapter, slotKey, nullifier, slotKey, nonce]);
  }

  // ----- scoped disclosure projections -----
  counterpartyView(v: PublicView): CounterpartyView {
    return { slotKey: v.slotKey, satisfied: v.state === RightState.Consumed };
  }

  /**
   * Route an application call through the STRK20 pool's privacy_invoke so the
   * anonymizer - not the raw wallet - is the caller the registry records.
   * The pool proves a shielded funding note in ZK before dispatching. The
   * concrete construction lives in docs/INTEGRATING.md; kept as one seam here
   * so integrators swap in the pool SDK call without touching Sole logic.
   */
  private async privacyInvoke(
    account: Account, method: string, calldata: Felt[],
  ): Promise<string> {
    // Placeholder seam - wired to the STRK20 pool SDK (starknet.js v10.4.0 +
    // Ready wallet) in the web app. Documented as a DEMO seam, not a hidden
    // guarantee (see SECURITY.md and the starter-kit "replace DEMO markers"
    // note honored in apps/web).
    throw new Error(
      `privacyInvoke(${method}) must be bound to the STRK20 pool SDK - see docs/INTEGRATING.md`,
    );
  }

  private decodeState(raw: any): RightState {
    const n = typeof raw === "bigint" ? Number(raw) : Number(raw?.toString?.() ?? raw);
    return [RightState.Unclaimed, RightState.Active, RightState.Consumed][n] ?? RightState.Unclaimed;
  }
}
