# Non-Claims

What Sole does not do, stated plainly rather than left implicit. Read
[`PRIVACY_BOUNDARY.md`](./PRIVACY_BOUNDARY.md) for the authoritative privacy
boundary; this list does not broaden it.

1. **Sole does not prove a real-world right exists.** A canonical id is an
   arbitrary reference string. The registry enforces exclusivity over that
   string; it cannot validate the underlying receivable, licence, allocation,
   or collateral claim.
2. **Sole does not hide whether a known right is active.** Anyone holding a
   canonical id can derive its slot and query `UNCLAIMED`, `ACTIVE`, or
   `CONSUMED`.
3. **Sole does not provide transaction-level wallet unlinkability in the
   recorded bundled flow.** Each recorded private receipt publicly joins an
   indexed 12 STRK pool deposit, the anonymizer invocation, and the Sole slot.
   The registry caller is the anonymizer; the depositing wallet can still be
   correlated with that slot. Timing, contracts called, and transaction fees
   are public too.
4. **Sole does not prove a named claimant, raw amount, or counterparty can
   never be inferred from all available data.** Registry events omit those
   fields, but wallet, provider, timing, calldata, and off-chain correlation
   are outside that narrow event-field fact.
5. **Sole does not demonstrate real financing, credit issuance, asset
   transfer, external-market integration, or economic repayment.** The
   deployed `FallbackMarket` records an opaque position commitment and clears
   it on consume. Its `Financed` and `Repaid` events prove that bookkeeping,
   not a loan.
6. **Sole does not have a recorded mainnet duplicate-claim or cross-venue
   rejection receipt.** `RIGHT_ALREADY_ACTIVE` and
   `AUTH_RIGHT_NOT_ACTIVE` are covered by the adversarial tests. The sponsored
   wallet path avoids funding calls it predicts will revert. The deployed
   second adapter also does not currently prove an independent venue
   configuration.
7. **Sole does not implement scoped disclosure, counterparty access control,
   or auditor keys.** The UI projections are illustrative local views, not
   deployed access-control features.
8. **The canonical-id-to-right mapping is first-registration-wins, not
   attested.** Production use needs a trusted attester or equivalent root;
   the shipped `FirstRegistrationRoot` does not establish entitlement.
9. **Sole does not implement `EXPIRED`, `CANCELLED`, or
   `PARTIALLY_SETTLED`.** Only `UNCLAIMED -> ACTIVE -> CONSUMED` ships.
10. **The contracts are unaudited, ownerless, and not upgradeable.** A
    finding means a redeploy to a new address, not a patch.
11. **This is experimental software, not production-ready infrastructure.**
    No real financial right should rely on it.
