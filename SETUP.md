# Setup

## Prerequisites
- Scarb + Starknet Foundry (snforge) for contracts
- Node 20+ for the SDK, scripts, and web app
- A Starknet mainnet account with STRK for fees. Each STRK20 privacy action
  (claim/finance/settle) pays the pool's flat per-action fee - read live from
  `get_fee_amount()` in the SDK, never hardcoded, since it's admin-settable
  and has already changed once (4 STRK when the STRK20 docs were first
  written, 6 STRK as verified live on mainnet in this repo).
- A privacy-enabled wallet (Ready extension) + starknet.js v10.4.0
- **The connected account must register with the STRK20 pool first, once.**
  In Ready, this is not the "Smart Account activation" toggle (a different,
  unrelated feature) - it's a separate **"Enable private tokens"** flow
  (found on the main wallet view, not Settings), which publishes a viewing
  key on-chain. Every `claim`/`finance`/`settle`/`settleAndRepay` call
  reverts with `NOT_REGISTERED` until this is done. Do this before running
  the demo, or the first private action will stall on a wallet error that
  has nothing to do with the dapp.

## Contracts
```
cd contracts
scarb build
snforge test
```

## SDK
```
cd packages/sole-sdk
npm install && npm test        # cross-language derivation parity
```

## Web app
```
cd apps/web
npm install
npm run dev                    # http://localhost:3000
```

## Deploy + evidence
```
# deploy RightsRegistry, ClaimAnonymizer, FirstRegistrationRoot
# record addresses in evidence/deployment.json and strk20.json
node --experimental-strip-types scripts/verify-mainnet.ts --all
```
