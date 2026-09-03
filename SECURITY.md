# Security

## Trust boundaries
- **RightsRegistry** accepts transitions only from the **ClaimAnonymizer** (`assert_anonymizer`).
- **ClaimAnonymizer** accepts value-bearing transitions only from the **STRK20 pool** via privacy_invoke (`assert_pool`), so a shielded funding note is proven before any claim.
- Contracts are **ownerless**: no admin, no upgrade, no pause.

## What is proven vs assumed
- **Proven (tests + chain):** exclusivity, single-use consumption, replay rejection, caller gating. See tests/adversarial and scripts/verify-mainnet.ts.
- **Assumed (THREAT_MODEL):** canonical id corresponds to a real unique right (T-1); high-entropy ids (T-2); shield-ahead to avoid timing correlation (T-3).

## Demo vs guarantee
The web app uses a **DEMO fixture** (Bank A / Bank B / RCV-4821) over a generic registry. Fixture data is labelled; it is never a protocol guarantee. The `privacyInvoke` seam in the SDK is explicitly a binding point to the STRK20 pool SDK, not a stubbed guarantee.

## Not audited
Adversarial coverage is thorough but is not an audit.
