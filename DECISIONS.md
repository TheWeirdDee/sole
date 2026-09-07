# Decision Records

Each: context, decision, alternatives, why rejected, security consequence, production implication.

## D-001 — First-registration-wins for the MVP root
**Context.** Exclusivity requires a canonical identity for a right. Who establishes it?
**Decision.** MVP: the first party to register a `slot_key` owns the slot; collisions revert.
**Alternatives.** Attester-signed root (issuer signs the right into existence).
**Why rejected (for MVP).** Attestation adds issuer identity, key registration/rotation/revocation, replay protection, and dispute handling — none of which strengthens the thesis we are proving, and all of which gives a judge a surface to attack.
**Security consequence.** Exclusivity holds over the *commitment*, not over a proven real-world asset (THREAT_MODEL T-1).
**Production implication.** Swap in `AttestedRoot` behind the same `RightRoot` trait; the registry does not change.

## D-002 — `slot_key` is deterministic, with no secret salt
**Context.** A second claimant must independently derive the same key to collide.
**Decision.** `slot_key = Poseidon(TAG_SLOT, canonical_asset_id)`. No blinding in the key.
**Alternatives.** Salt the slot key for state privacy.
**Why rejected.** A secret salt only the holder knows makes the collision impossible — exclusivity breaks. The blinding belongs in the claim, not the key.
**Security consequence.** Right *state* is publicly queryable by anyone with the canonical id. The registry does not store a named holder or a claim-record preimage; that narrow registry-data fact is not a claim of wallet unlinkability across a bundled transaction receipt (see `docs/PRIVACY_BOUNDARY.md`).
**Production implication.** State-privacy, if ever needed, is a private-set-membership problem layered above, not a change to this key.

## D-003 — Separate right identity, ownership, and consumption
**Context.** Conflating "what the right is" with "who owns it" leaks the owner.
**Decision.** Three independent values: `slot_key` (identity), `claim_record` (opaque claim commitment), `nullifier` (consumption).
**Security consequence.** The registry can enforce exclusivity without storing a named claimant. That does not erase the public pool and helper events that surround a registry transition in the same receipt.

## D-004 — Settlement consumes the right via a nullifier
**Decision.** `settle()` burns `Poseidon(TAG_NULL, claimant_secret, slot_key)`; only the holder can produce it; replay is rejected.
**Security consequence.** Consumption is single-use and secret-gated at the registry state machine. The registry event does not name a holder, but that does not imply wallet unlinkability for the surrounding receipt.

## D-005 — The anonymizer is mandatory, not optional
**Context.** If a raw wallet calls the registry, that wallet is `msg.sender` on the public transition.
**Decision.** The deployed claim path routes through `ClaimAnonymizer` via the STRK20 pool's privacy_invoke; the registry rejects any non-anonymizer caller.
**Security consequence.** The registry sees the anonymizer as its caller. That is a registry-caller boundary, not wallet unlinkability: the bundled mainnet receipts publicly contain the pool `Deposit` depositor, token, and amount, the withdrawal and helper invocation, and the registry transition in one transaction. See `docs/PRIVACY_BOUNDARY.md`.

## D-006 — Attester-signed roots deferred to production
**Decision.** Ship first-registration; document attested root as the production input-trust layer.
**Production implication.** Canonicalization of real documents is a real-world-trust problem, orthogonal to the exclusivity primitive.

## D-007 — Duplicate financing is the sole demo use case
**Context.** The registry is use-case agnostic; the demo must not be.
**Decision.** One vertical: duplicate-financing rejection, one receivable, two banks. Generality lives in the README, never in the demo.
**Why.** One use case nailed beats many demonstrated (Dami's rule).
**Evidence boundary.** The duplicate-rejection path is proven in source and tests. A sponsored live rejected receipt has not been captured, so the demo must not represent one as mainnet evidence.

## D-008 — ACTIVE is publicly queryable
**Decision.** State is public; the registry mapping and events omit named claimant, funding amount, and counterparty fields.
**Why.** This is the narrow, defensible claim. "The existence of the right is invisible" would be false given D-002, and "the economic relationship is private" would overstate what the bundled public receipt can reveal. See `docs/PRIVACY_BOUNDARY.md`.

## D-009 — Adapter gating is downstream of Sole; deployed behavior is fallback bookkeeping
**Context.** The intended architecture was for a right to authorize a financial action through an `ExecutionAdapter`, rather than make the registry itself a market. Current deployed behavior must be described from the code and receipts, not from that design target.
**Historical decision.** The original design intended an external financial adapter gated by ACTIVE state. That intended architecture is retained as a future direction only; it is not a description of the deployed fallback adapter.
**Alternatives.** (a) Self-contained settlement inside Sole — safer, but Sole "does too much" and the economic consequence is weaker. (b) Build a full lending market inside Sole — the primitive disappears behind an application.
**Security consequence.** In the source and test state machine, a duplicate claim cannot make the slot ACTIVE, so an authorized adapter action cannot proceed. This proves authorization gating and fallback bookkeeping; it does not prove an economic outcome or a live rejected transaction.
**Production implication.** Any right-gated execution venue needs its own implementation, audit, deployment validation, and receipt evidence before it can be described as a financial action.
**Current-evidence correction.** The deployed fallback adapter only writes an opaque amount commitment for a slot, then clears that record and consumes the right. Its finance and settle receipts show no loan, asset transfer, repayment, or external-market call. The earlier wording above records the intended architecture, not current deployed behavior; see `docs/NON_CLAIMS.md`.
**Risk accepted.** External-venue integration is deferred. `FallbackMarket` is a mainnet demonstration loop, not economic settlement; see `docs/NON_CLAIMS.md`.
