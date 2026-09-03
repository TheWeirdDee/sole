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
**Security consequence.** Right *state* is publicly queryable by anyone with the canonical id; ownership is not.
**Production implication.** State-privacy, if ever needed, is a private-set-membership problem layered above, not a change to this key.

## D-003 — Separate right identity, ownership, and consumption
**Context.** Conflating "what the right is" with "who owns it" leaks the owner.
**Decision.** Three independent values: `slot_key` (identity), `claim_record` (ownership), `nullifier` (consumption).
**Security consequence.** The registry can enforce exclusivity while never holding an identity.

## D-004 — Settlement consumes the right via a nullifier
**Decision.** `settle()` burns `Poseidon(TAG_NULL, claimant_secret, slot_key)`; only the holder can produce it; replay is rejected.
**Security consequence.** Consumption is single-use and holder-authenticated without revealing the holder.

## D-005 — The anonymizer is mandatory, not optional
**Context.** If a raw wallet calls the registry, that wallet is `msg.sender` on the public transition.
**Decision.** All value-bearing transitions route through `ClaimAnonymizer` via the STRK20 pool's privacy_invoke; the registry rejects any non-anonymizer caller.
**Security consequence.** The claiming wallet is never linked to the right. This is the 30% integration point.

## D-006 — Attester-signed roots deferred to production
**Decision.** Ship first-registration; document attested root as the production input-trust layer.
**Production implication.** Canonicalization of real documents is a real-world-trust problem, orthogonal to the exclusivity primitive.

## D-007 — Duplicate financing is the sole demo use case
**Context.** The registry is use-case agnostic; the demo must not be.
**Decision.** One vertical: duplicate-financing rejection, one receivable, two banks. Generality lives in the README, never in the demo.
**Why.** One use case nailed beats many demonstrated (Dami's rule).

## D-008 — ACTIVE is publicly queryable
**Decision.** State is public; only the economic relationship is private.
**Why.** This is the honest, defensible thesis. "The existence of the right is invisible" would be false given D-002.
