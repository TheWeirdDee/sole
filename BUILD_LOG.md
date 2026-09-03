# Build Log

Engineering receipts, not diary entries.

## Day 1
- RightsRegistry invariant implemented: UNCLAIMED -> ACTIVE -> CONSUMED.
- First-registration root chosen (DECISIONS D-001); RightRoot trait defined so AttestedRoot swaps in later.
- Deterministic slot_key locked (D-002); salt moved into the claim commitment.
- Adversarial suite: duplicate-claim, replay, direct-call, zero-commitment cases added.

## Day 2  (planned)
- ClaimAnonymizer wired to STRK20 pool privacy_invoke.
- Deploy RightsRegistry + ClaimAnonymizer + FirstRegistrationRoot to mainnet.
- First successful private claim on mainnet (TX3).

## Day 3  (planned)
- Bank B duplicate-claim revert captured on mainnet (TX4).
- Settlement consumption verified (TX5).
- Web app lifecycle complete; privacy-boundary view wired.

## Day 4  (planned)
- Mainnet evidence regenerated via verify-mainnet.ts --all.
- CO_DESIGN.md filled with real practitioner input.
- 3-minute demo recorded, opening on the rejection.
- README + strk20.json finalized.
