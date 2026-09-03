# Threat Model

The exclusivity guarantee rests on assumptions. They are first-class here, not footnotes.

## T-1 — Canonical identity (the central assumption)
Sole enforces "one active claimant per `slot_key`". It does **not** prove that a `slot_key` corresponds to a real, unique economic right. Under first-registration-wins, two parties who canonicalize the same real receivable to two different ids create two different slots, and both can be claimed.
- **MVP stance.** Out of scope; exclusivity is over the commitment.
- **Production mitigation.** `AttestedRoot`: the obligor (e.g. the buyer on an invoice) signs the canonical id once, so a single real right maps to a single slot. Documented in DECISIONS D-006.

## T-2 — State-query leakage
Anyone holding a canonical id can read a right's lifecycle state (D-002, D-008). Low-entropy ids (raw invoice numbers) are enumerable.
- **Mitigation.** High-entropy canonical ids. The claimant, amount, and counterparty stay private regardless of state leakage.

## T-3 — Timing / entry-exit correlation
STRK20 shields the funding path, but public deposit/withdrawal legs and transaction timing can correlate a shielding event with a later claim.
- **Mitigation.** Shield ahead of time; do not shield-then-immediately-claim. Same boundary Limen documents.

## T-4 — Anonymizer bypass
If the registry accepted direct calls, the claiming wallet would leak.
- **Mitigation.** `assert_anonymizer` / `assert_pool`; covered by `direct_registry_call_reverts`.

## T-5 — Settlement replay
- **Mitigation.** Nullifier burned on settle; `replayed_settlement_reverts`.

## T-6 — Ownerless, unaudited contracts
No admin, no upgrade path. A finding means a redeploy, not a patch. Adversarial coverage is not an audit.
