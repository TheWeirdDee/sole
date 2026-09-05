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
`SoleClient.privacyInvoke` calls `account.strk20InvokeTransaction([{ type:
"deposit", token: STRK, amount: <flat fee> }, { type: "invoke", contract:
anonymizer, calldata }])` — the same call every STRK20 anonymizer helper
uses. The wallet proves a shielded funding note and dispatches into
`ClaimAnonymizer::privacy_invoke`, so the registry records the anonymizer as
caller, never the wallet. The `deposit` action is required alongside the
invoke: every documented anonymizer helper pairs `invoke` with a real
value-moving action, and a bare invoke-only actions array is rejected by the
wallet as `INVALID_REQUEST_PAYLOAD` before it reaches proving. Sole itself
moves no value through the pool - `privacy_invoke` always returns an empty
`Span<OpenNoteDeposit>` here - so the deposit just moves the flat per-action
fee from the caller's own public balance into their own private balance,
rolled back atomically if the invoke reverts. Do NOT call the registry
directly: it reverts `CALLER_NOT_ANONYMIZER`, by design.

## What you get
- `isClaimable(ref)` — availability without learning the holder.
- `publicView / counterpartyView` — scoped projections.
- Derivation helpers (`deriveSlotKey`, `deriveClaimCommitment`, `deriveNullifier`) with Cairo parity.
