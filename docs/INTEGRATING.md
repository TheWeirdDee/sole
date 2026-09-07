# Integrating Sole

Build a private-rights application without cloning this repo.

## Install
```
npm install @sole/sdk starknet@^10.4.0
```
Pin `starknet@^10.4.0` explicitly. A bare `npm install starknet` resolves to
the `latest` dist-tag, which is still 10.0.x and carries none of the STRK20
API (`WalletAccountV6`, `strk20InvokeTransaction`).

## Wire the client
Sole is a Wallet API integration (docs/PRIVACY_BOUNDARY.md): it talks to the
user's privacy-enabled wallet, never to a viewing key. `account` below is a
`WalletAccountV6` connected via get-starknet v6 — see the
[starknet.js WalletAccount guide](https://starknet-js.com/docs/next/guides/account/walletAccount/#with-get-starknet-v6).

```ts
import { SoleClient } from "@sole/sdk";
import { RpcProvider } from "starknet";

const sole = new SoleClient(
  new RpcProvider({ nodeUrl: STARKNET_RPC }),
  { registry: REGISTRY_ADDR, anonymizer: ANONYMIZER_ADDR, pool: STRK20_POOL_ADDR, adapter: ADAPTER_ADDR },
  registryAbi,
);
```

## Lifecycle
```ts
const ref = "RCV-4821";                          // your app's asset reference
if (await sole.isClaimable(ref)) {               // "can I safely claim this?"
  await sole.register(account, ref);             // -> UNCLAIMED (direct call, no privacy_invoke)
  const { claimCommitment } = await sole.claim(  // -> ACTIVE (via privacy_invoke, mints exec auth)
    account, ref, claimantSecret, fundingNote);
}
// later:
await sole.finance(account, ref, claimCommitment, amountCommitment); // venue executes
await sole.settleAndRepay(account, ref, claimantSecret, claimCommitment); // -> CONSUMED
```

## The privacy_invoke seam
By default, `SoleClient.privacyInvoke` calls the wallet with only Sole's
protocol-valid action:

```ts
await account.strk20InvokeTransaction([
  { type: "invoke", contract: ANONYMIZER_ADDR, calldata },
]);
```

The wallet builds the private proof and its own fee action. The user therefore
needs enough shielded STRK for that fee; Sole does not silently top it up from
the user's public balance. The helper dispatches into
`ClaimAnonymizer::privacy_invoke`, so the registry records the anonymizer as
caller, never the wallet. Sole's helper returns an empty
`Span<OpenNoteDeposit>` for these operations. Do **not** call the registry
directly: it reverts `CALLER_NOT_ANONYMIZER`, by design.

### Older Ready compatibility mode

Ready can reject the standalone action with the generic
`INVALID_REQUEST_PAYLOAD` / code 114 during no-gas preparation. That is a
wallet result, not a transaction result: nothing was signed, relayed, or
sent. It does not say why Ready rejected the payload, does not establish that
a deposit is required, and does not predict whether a legacy action shape
will succeed. Catch the SDK's `ReadyStandaloneInvokeRejectedError`, tell the
user this fact, and offer a separate confirmation only if they want to try a
legacy shape. Do **not** automatically retry with a deposit.

Only after an explicit user choice may a caller pass
`{ useCompanionDeposit: true }` to the private operation:

```ts
await sole.claim(
  account, ref, claimantSecret, fundingNote,
  { useCompanionDeposit: true }, // user-reviewed Ready workaround
);
```

That optional legacy mode builds the older `[deposit, invoke]` shape. Its
companion deposit is twice the current live flat fee, not a hard-coded amount
(for example, 12 STRK when the live fee is 6 STRK). It may appear as a gross
public shield in Ready; it is not an automatic or protocol-required extra gas
charge. The wallet controls the exact fee and shielded-balance accounting, so
show the wallet's quoted amount to the user before submission. A code 119
insufficient-private-balance result is also no-submission: ask the user to
shield funds deliberately instead of creating a hidden top-up flow. The
legacy shape may not resolve a code-114 rejection; never turn repeated
compatibility attempts into an automatic paid loop.

## What you get
- `isClaimable(ref)` — availability without learning the holder.
- `publicView / counterpartyView` — scoped projections.
- Derivation helpers (`deriveSlotKey`, `deriveClaimCommitment`, `deriveNullifier`) with Cairo parity.
