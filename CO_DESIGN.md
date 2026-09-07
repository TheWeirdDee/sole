# Co-design & Operational Analysis

The duplicate-receivable scenario is a fixture for evaluating a narrow
technical property: whether a known reference can move only once through a
public state machine. It is not evidence of a deployed trade-finance product,
of the frequency or cost of duplicate financing, or of institutional adoption.

## The Design Question

A registry can expose whether a known reference is `UNCLAIMED`, `ACTIVE`, or
`CONSUMED` while keeping the registry's claim payload to an opaque commitment.
That creates a useful technical tension, but it does not establish the
existence, ownership, or enforceability of the underlying receivable.

## What the Shipped System Demonstrates

1. **Public state gating:** The registry records `slot_key -> state -> opaque
   commitment`. A fresh claim against an ACTIVE slot is rejected by source and
   adversarial tests with `RIGHT_ALREADY_ACTIVE`.
2. **Narrow event-field privacy:** Registry events do not contain named
   claimant, raw position amount, or counterparty fields. That is not an
   anonymity guarantee: the recorded bundled receipts correlate the depositing
   wallet, a public pool deposit, the anonymizer invocation, and the slot.
3. **Fallback position bookkeeping:** The deployed `FallbackMarket` records
   and later clears an opaque position commitment after an active `ExecAuth`.
   It does not transfer assets, issue credit, connect to an external market, or
   prove economic repayment.

## Boundaries of the Demonstration

- The single-use gate is demonstrated on the deployed registry and in
  adversarial tests. There is no recorded mainnet duplicate-claim rejection.
- `(shared-registry adapter, non-ACTIVE) --finance--> REVERT
  AUTH_RIGHT_NOT_ACTIVE` is a source-and-test property. The deployed second
  adapter does not currently prove an independent venue configuration, and
  there is no recorded mainnet cross-venue rejection.
- The canonical id is first-registration-wins. A production workflow would
  require a trusted attester or another entitlement root before treating a
  reference as a real-world right.

Read [`docs/PRIVACY_BOUNDARY.md`](./docs/PRIVACY_BOUNDARY.md) and
[`docs/NON_CLAIMS.md`](./docs/NON_CLAIMS.md) before using the demo as evidence
for any commercial claim.
