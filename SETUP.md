# Setup

## Prerequisites
- Scarb + Starknet Foundry (snforge) for contracts
- Node 20+ for the SDK, scripts, and web app
- A Starknet mainnet account with STRK for fees (each STRK20 privacy action is a flat 4 STRK)
- A privacy-enabled wallet (Ready extension) + starknet.js v10.4.0

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
