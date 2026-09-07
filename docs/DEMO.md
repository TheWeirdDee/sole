# Demo script (3 minutes)

Open on the enforcement proof, not on a dashboard.

1. **0:00 - the refusal.** "The registry is ACTIVE, so a fresh Bank B claim cannot pass `RIGHT_ALREADY_ACTIVE`." Show the live, no-gas registry verification. Ready's sponsor simulates known reverts and does not submit them, so do not claim there is a reverted mainnet transaction.
2. **0:20 - what the receipt shows.** "The registry event has no named claimant, raw position amount, or counterparty field. But this bundled receipt publicly joins the depositing wallet, a 12 STRK pool deposit, the anonymizer invocation, and the slot." Do not call the wallet unlinkable.
3. **0:35 - the narrow privacy boundary.** "The registry is a public state machine over an opaque commitment. STRK20 keeps note data encrypted inside the pool, but deposits, withdrawals, timing, and this receipt-level correlation remain public."
4. **0:55 - rewind and show the lifecycle.** Register RCV-4821 (UNCLAIMED). Bank A sends the pool-routed claim action (ACTIVE) - the wax seal drops. Any shield is a separate, deliberate Ready action, not an automatic Sole top-up. The four scoped views are illustrative local projections, not deployed access control.
5. **1:55 - settlement.** The deployed fallback adapter clears its opaque position record and consumes the right (CONSUMED). This is state bookkeeping, not proof of repayment or an asset transfer.
6. **2:20 - the proof.** Run `verify-mainnet.ts --all`: it reconstructs the recorded affirmative registration, claim, position-record, and consume receipts. Duplicate-claim rejection and the shared-registry adapter's non-ACTIVE gate are source-and-test evidence; there is no recorded rejected mainnet receipt or proven independent second venue.
7. **2:45 - the sentence.** "Sole proves a single-use state transition over a known reference. It does not prove a real receivable, lending, repayment, or wallet unlinkability."
