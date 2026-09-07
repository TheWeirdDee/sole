# Demo script (3 minutes)

Open on the enforcement proof. Not on a dashboard.

1. **0:00 — the refusal.** "The registry is ACTIVE, so a fresh Bank B claim cannot pass `RIGHT_ALREADY_ACTIVE`." Show the live, no-gas registry verification. Ready's sponsor simulates known reverts and does not submit them, so do not claim there is a reverted mainnet transaction.
2. **0:20 — what B learned.** "Bank B knows the receivable is already claimed. It does not know who claimed it, how much they funded, or who the counterparty is."
3. **0:35 — the strip test, said out loud.** "Without STRK20 this is a public claims database — everyone reads the financing relationship. Privacy is what makes exclusivity commercially usable."
4. **0:55 — rewind and show the lifecycle.** Register RCV-4821 (UNCLAIMED). Bank A claims privately (ACTIVE) — the wax seal drops. Any shield is a separate, deliberate Ready action, not an automatic Sole top-up. Show the four scoped views: public, holder, counterparty, auditor.
5. **1:55 — settlement.** Bank A settles; the nullifier consumes the right (CONSUMED).
6. **2:20 — the proof.** Run `verify-mainnet.ts --all`: each affirmative transition is reconstructed from chain; the duplicate and cross-venue rejection paths are proven by adversarial tests and live public-state preconditions.
7. **2:45 — the sentence.** "We don't make the invoice private. We make the right to claim it private — while double-claiming stays impossible."
