# Privacy Boundary

The one-line claim: **the enforcement state is public; the economic
relationship behind that state is private.**

## Becomes public
- Whether a given canonical right is UNCLAIMED / ACTIVE / CONSUMED.
- That some commitment occupies an ACTIVE slot (an opaque felt).
- That a state transition occurred, and when.

## Stays private
- The claimant's identity.
- The funding amount (STRK20 shielded note).
- The claimant's wallet (anonymizer boundary — never the registry caller).
- The counterparty relationship.
- Every other right the claimant holds.

## Reduces privacy anyway (stated, not hidden)
- Anyone holding the canonical id can query state (D-002/D-008). Low-entropy ids are enumerable (T-2).
- Public shield/unshield legs plus timing can correlate a shielding event to a later claim (T-3). Shield ahead of time.

## What Sole does NOT claim
- It does not hide whether a *known* right is active.
- It does not prove a real-world receivable exists (T-1).
- It is not identity anonymity for the underlying business; it is relationship privacy for the claim.

## Scoped disclosure projections
| Viewer | Learns |
|---|---|
| Public | right state only |
| Holder | own claim, amount, settlement status |
| Counterparty | whether the obligation was satisfied |
| Auditor (scoped viewing key) | canonical right, claimant, funding note, timestamps, full lifecycle |
