# Threat Model

The exclusivity guarantee rests on assumptions. They are first-class here, not footnotes.

## T-1 — Canonical identity (the central assumption)
Sole enforces "one active claimant per `slot_key`". It does **not** prove that a `slot_key` corresponds to a real, unique economic right. Under first-registration-wins, two parties who canonicalize the same real receivable to two different ids create two different slots, and both can be claimed.
- **MVP stance.** Out of scope; exclusivity is over the commitment.
- **Production mitigation.** `AttestedRoot`: the obligor (e.g. the buyer on an invoice) signs the canonical id once, so a single real right maps to a single slot. Documented in DECISIONS D-006.

## T-2 — State-query leakage
Anyone holding a canonical id can read a right's lifecycle state (D-002, D-008). Low-entropy ids (raw invoice numbers) are enumerable.
- **Mitigation.** High-entropy canonical ids reduce enumeration. The registry mapping omits named claimant, amount, and counterparty fields, but that does not make those facts universally private: the current bundled receipts expose a depositor, token, amount, timing, helper invocation, and transition together. See `docs/PRIVACY_BOUNDARY.md`.

## T-3 — Receipt-level wallet-to-transition correlation
The current bundled claim, finance, and settle receipts contain the public pool `Deposit` depositor, token, and amount; a withdrawal; the helper invocation; and the registry transition in the same transaction. This is stronger than a general timing risk: a public observer can correlate the depositor with that transition at receipt scope.
- **Mitigation.** Treat the current route as having that public linkage and do not claim wallet unlinkability or broad economic-relationship privacy. Any future privacy design needs separate, evidence-backed analysis; shielding earlier is not a demonstrated cure for an atomic bundled deposit.

## T-4 — Anonymizer bypass
If the registry accepted direct calls, its caller field would directly identify the caller rather than the helper.
- **Mitigation.** `assert_anonymizer` / `assert_pool`; covered by `direct_registry_call_reverts`. This protects the registry-caller boundary only; it does not hide the public pool events in the bundled route.

## T-5 — Settlement replay
- **Mitigation.** Nullifier burned on settle; `replayed_settlement_reverts`.

## T-6 — Ownerless, unaudited contracts
No admin, no upgrade path. A finding means a redeploy, not a patch. Adversarial coverage is not an audit.

## T-7 — Bookkeeping mistaken for financial settlement
The deployed fallback adapter records an opaque position commitment for `finance()` and clears it while consuming the right for `settle()`. Its observed receipts do not establish lending, an asset transfer, repayment, or an external-market execution. Treating those method names or events as financial settlement would create a product and evidence risk.
- **Mitigation.** Keep the distinction explicit in the UI and documentation; see `docs/NON_CLAIMS.md` and `docs/EVIDENCE_LEDGER.md`. Do not make a financial-action claim until a separate adapter and its receipts demonstrate one.
