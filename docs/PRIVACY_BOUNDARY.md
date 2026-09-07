# Privacy Boundary

This is Sole's single source of truth for privacy claims. Other pages may link
to it, but must not broaden it. Its statements are limited to the deployed
contracts and the recorded receipts rechecked by
`node --experimental-strip-types scripts/verify-mainnet.ts --all`.

## What the registry exposes

- A deterministic `slot_key` for a known canonical reference.
- `UNCLAIMED`, `ACTIVE`, or `CONSUMED` state.
- An opaque active `claim_commitment` while a slot is ACTIVE.
- A `RightRegistered`, `RightClaimed`, or `RightConsumed` event carrying the
  slot and, for a claim, the opaque commitment.
- The configured `ClaimAnonymizer` as the only contract caller permitted to
  drive registry transitions. The wallet is not the registry caller.

The registry event format has no named claimant, raw position amount, or
counterparty field. That narrow event-field fact is proven by source and the
recorded receipts; it is not a broad anonymity claim.

## What the recorded public receipts expose

Every recorded pool-routed claim, position record, and consume transaction
contains all of the following in one atomic receipt:

- a public STRK20 `Deposit` event with an indexed depositor and 12 STRK in the
  recorded flows;
- `ExternalContractInvoked` for the configured anonymizer's
  `privacy_invoke` entrypoint; and
- the corresponding Sole registry or adapter event and its slot.

That receipt-level combination can correlate the depositing wallet to the
slot. The anonymizer separates the registry caller from the wallet; it does
**not** make that wallet unlinkable in these bundled flows. Transaction time,
fee, public contracts invoked, and the fact that a transition occurred are
also public.

The receipt events checked here do not disclose a named claimant, raw funding
amount, raw position amount, or counterparty. The project does not claim that
every other wallet, provider, calldata, timing, or off-chain data source is
free of correlation or disclosure risk.

## What is local or opaque in this implementation

- The claimant secret and funding-note preimages are generated in the client;
  the registry stores only their derived commitment.
- The adapter stores an opaque position commitment, not a raw position amount.
- A local browser tab may retain its own claim secret long enough to reconcile
  an ambiguous wallet result. It is not a general claimant identity system.

These facts do not prove identity anonymity: a wallet address can be linked to
an external identity, and the recorded deposit-to-slot correlation makes that
material.

## Not implemented or not claimed

- No auditor-key, counterparty-disclosure, or scoped-disclosure access-control
  system is deployed. The UI's viewer projections are illustrative only.
- Sole does not hide whether a known right is ACTIVE or CONSUMED.
- Sole does not prove a canonical reference corresponds to a real-world right.
- Sole does not prove an asset transfer, credit issuance, external-market
  integration, or economic repayment. The deployed fallback adapter records
  and clears an opaque position only.
- Sole is unaudited experimental software.

For the broader product limitations, read [`NON_CLAIMS.md`](./NON_CLAIMS.md).
