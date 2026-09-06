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
  Full walkthrough, with exactly which screen to use and which one to avoid:
  [`docs/WALLET_SETUP.md`](docs/WALLET_SETUP.md). Skipping this makes every
  `claim`/`finance`/`settle`/`settleAndRepay` call revert with
  `NOT_REGISTERED` - a wallet setup step, not a dapp bug.

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
