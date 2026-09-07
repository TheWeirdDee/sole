# Build Log

Engineering receipts, not diary entries.

## Day 1
- RightsRegistry invariant implemented: UNCLAIMED -> ACTIVE -> CONSUMED.
- First-registration root chosen (DECISIONS D-001); RightRoot trait defined so AttestedRoot swaps in later.
- Deterministic slot_key locked (D-002); salt moved into the claim commitment.
- Adversarial suite: duplicate-claim, replay, direct-call, zero-commitment cases added.

## Day 2  (done)
- ClaimAnonymizer wired to STRK20 pool privacy_invoke.
- RightsRegistry + ClaimAnonymizer + FirstRegistrationRoot + both ExecutionAdapter venues deployed to mainnet (`evidence/deployment.json`).
- First successful private claim on mainnet, then three more across two independent accounts (`evidence/claims.json`).
- The root cause behind an extended stretch where claims looked like they were failing was found and fixed:
  `state_of()`'s decoder treated the registry's Cairo enum as a plain number, silently defaulting to
  `UNCLAIMED` regardless of real state (see `docs/FRICTION_LOG.md`).

## Day 3  (partially done)
- Settlement consumption verified on mainnet (`settleAndRepay`, real hash in `evidence/claims.json`).
- Web app lifecycle complete: connect, register, claim, finance, settle all run against real deployed
  contracts through the connected wallet, live.
- `finance()` proven on mainnet too — not originally scheduled for Day 3, landed alongside settlement once
  the state-decoding bug was fixed.
- **Not done:** Bank B's duplicate-claim revert has not been captured as a live mainnet transaction.
  Ready's paymaster refuses to sponsor gas for a call it predicts will revert, which blocks this specific
  artifact through the sponsored wallet path (`docs/FRICTION_LOG.md`, "Still open"). Proven in the
  adversarial test suite only.

## Day 4  (partially done)
- Mainnet evidence regenerated via `verify-mainnet.ts --all` — 6/6 transactions verify clean from chain.
- README + `strk20.json` finalized against the real evidence, including the two most recent hashes.
- **Not done, needs a real practitioner:** `CO_DESIGN.md` is still an unfilled template. It needs an
  actual conversation with a real person who has dealt with duplicate pledging, then the specific design
  change it caused — not something to fabricate.
- **Not done:** no demo video recorded yet (`strk20.json`'s `demo_video` is still empty).
