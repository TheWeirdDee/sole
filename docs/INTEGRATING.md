# Integrating Sole

Build a private-rights application without cloning this repo.

## Install
```
npm install @sole/sdk starknet
```

## Wire the client
```ts
import { SoleClient } from "@sole/sdk";
import { RpcProvider } from "starknet";

const sole = new SoleClient(
  new RpcProvider({ nodeUrl: STARKNET_RPC }),
  { registry: REGISTRY_ADDR, anonymizer: ANONYMIZER_ADDR, pool: STRK20_POOL_ADDR },
  registryAbi,
);
```

## Lifecycle
```ts
const ref = "RCV-4821";                          // your app's asset reference
if (await sole.isClaimable(ref)) {               // "can I safely claim this?"
  await sole.register(account, ref);             // -> UNCLAIMED
  const { claimCommitment } = await sole.claim(  // -> ACTIVE (via privacy_invoke)
    account, ref, claimantSecret, fundingNote);
}
// later:
await sole.settle(account, ref, claimantSecret); // -> CONSUMED
```

## The privacy_invoke seam (the one thing you must bind)
`SoleClient.privacyInvoke` is intentionally a single seam. Bind it to the
STRK20 pool SDK (starknet.js v10.4.0 + Ready wallet) so the pool proves a
shielded funding note and dispatches into `ClaimAnonymizer` — the registry then
records the anonymizer, never the caller wallet. Do NOT call the registry
directly: it reverts `CALLER_NOT_ANONYMIZER`, by design.

## What you get
- `isClaimable(ref)` — availability without learning the holder.
- `publicView / counterpartyView` — scoped projections.
- Derivation helpers (`deriveSlotKey`, `deriveClaimCommitment`, `deriveNullifier`) with Cairo parity.
