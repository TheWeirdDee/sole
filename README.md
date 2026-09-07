# Sole

**A financial right, claimed privately, authorizes one real financing action — then is spent for good, everywhere.**

Sole turns a right (a receivable, a licence, an allocation, a collateral claim) into a single-use execution right on Starknet's STRK20 privacy pool. An active right gates one financing action against a money market. Once that financing settles, the right is consumed permanently — for every venue, every lender, every future moment. The public chain enforces this without ever learning who holds the right, how much they financed, or who the counterparty is.

```
canonical right
   | claim (private, via anonymizer)             a second claimant, same right
   v                                                | claim()
RightsRegistry  -- mints -->  ExecAuth (single-use) v
   |                              |               REVERT RIGHT_ALREADY_ACTIVE
   | shielded STRK20 funding      v               (no auth minted -> venue never runs)
   v                     ExecutionAdapter.finance()   [gate: right must be ACTIVE]
   |                              |
   |                              v
   |                        money market executes
   v                              |
settle_and_repay  <-- repay + spend auth --+   -> right CONSUMED (global)
                                            |
              a DIFFERENT venue, later      |
                    finance(same right) ----+--> REVERT: right is spent
                                                  (venue learns only that it is taken)
```

Live demo: [sole-web-app.vercel.app](https://sole-web-app.vercel.app/) · Demo video: pending · Mainnet manifest: [`strk20.json`](./strk20.json)

## Mainnet deployments

| Contract | Address |
| --- | --- |
| RightsRegistry | [`0x057a...e6f4c`](https://voyager.online/contract/0x057a4c75612430dae3a79485c41a53f986c42526df59af4f73485cde56be6f4c) |
| ClaimAnonymizer | [`0x01dd...5c74`](https://voyager.online/contract/0x01ddb10db13096b973a9a63d02f5e9a6370d3b592cd6ca02a91f5729ca685c74) |
| FirstRegistrationRoot | [`0x0368...1aae5`](https://voyager.online/contract/0x0368203c991cfcc239560bbfe2dfa52a84bbf950f0603010229180d08341aae5) |
| FallbackMarket (venue 1) | [`0x0788...6cf28`](https://voyager.online/contract/0x0788f8439042f8750ec90638bc764dd36f766930770238c630df70e667e6cf28) |
| FallbackMarket (venue 2) | [`0x01db...6d27c`](https://voyager.online/contract/0x01dbf93d533f9b1d4aff959cfd10cd53136663db81f101d74db8008825b6d27c) |

Full addresses, the STRK20 pool address, and deployment transaction hashes in [`evidence/deployment.json`](./evidence/deployment.json).

## Why this needs to exist

An economic right often must be *exclusive* — held by exactly one party at a time. Today that's enforced by a registry everyone can read, or by no registry at all. A public registry stops double-claiming but exposes the financing relationship: who is borrowing, from whom, how much, how often. No registry means the same right can be pledged twice — in trade finance, duplicate financing, a persistent and expensive fraud.

Sole asks a different question: **can a party prove a right is available for exclusive claim, and finance it, without exposing the private relationship around it?**

## What only Sole enforces

Refusing a bad fill inside one settlement is a solved problem — a market checks the amount and rolls its own transaction back. That guarantee lives inside a single deal, at a single venue, in a single moment.

Sole's guarantee holds across parties and venues that don't trust or observe each other. A right, once consumed, is spent everywhere. Two lenders who have never met, at two markets sharing no ledger, cannot both finance the same underlying right — the first financing consumes it; the second is refused on-chain, at a different venue, with the holder still hidden. That's the property a per-settlement rollback can't reach, and the reason Sole is a rail rather than a check that belongs inside one market.

## Architecture

Three separate primitives, deliberately not one:

- **STRK20** provides the private money — shielded notes, private transfer, the pool's `privacy_invoke` seam.
- **The money market** (Vesu, or the in-repo `FallbackMarket`) provides liquidity.
- **Sole provides the scarce, single-use execution right** that gates the market.

The venue is causally downstream of Sole: a duplicate claim reverts at the registry before any authorization exists, so the market is never called. Remove the anonymizer and the claiming wallet becomes `msg.sender` on the public transition, defeating the thesis; remove Sole and the market can finance the same right twice.

Contracts (`contracts/src/`):

| Contract | Role |
| --- | --- |
| `RightsRegistry` | The state machine: UNCLAIMED → ACTIVE → CONSUMED, the double-claim revert, the deployer-gated anonymizer wiring |
| `ClaimAnonymizer` | The mandatory privacy boundary — one `privacy_invoke` entry point, the same calling convention as every STRK20 helper |
| `RightRoot` (`FirstRegistrationRoot` for the MVP) | Who is trusted to say a canonical right exists, kept independent of exclusivity logic |
| `ExecutionAdapter` (`FallbackMarket` / `VesuAdapter`) | The venue gate: a financing action executes only against an `ACTIVE` right's single-use authorization |

Design rationale for each of these lives in [`DECISIONS.md`](./DECISIONS.md).

## The privacy boundary

**The enforcement state is public. The economic relationship behind it is private.** Stated once, plainly, because a vague privacy claim is worse than none.

| Data | Public | Private |
| --- | :---: | :---: |
| Right state (UNCLAIMED/ACTIVE/CONSUMED) | yes | |
| Slot identifier | yes* | |
| Claimant identity | | yes |
| Funding amount | | yes |
| Claimant wallet | | yes |
| Counterparty relationship | | yes |

*Anyone holding the canonical id can query a right's state — that's the enforcement fact, not a leak. Full scoped-disclosure table (public / holder / counterparty / auditor) and what each reduces to in practice: [`docs/PRIVACY_BOUNDARY.md`](./docs/PRIVACY_BOUNDARY.md).

## Threat model

The exclusivity guarantee rests on stated assumptions, not hidden ones — full detail in [`THREAT_MODEL.md`](./THREAT_MODEL.md).

1. **Canonical identity (T-1, the central one).** Sole proves one active claimant per `slot_key`; it does **not** prove a `slot_key` corresponds to a unique real-world right. First-registration-wins for the MVP; production swaps in an attester-signed root (`DECISIONS.md` D-006) behind the same `RightRoot` trait, no change to the registry.
2. **State-query leakage (T-2).** Low-entropy canonical ids are enumerable. Mitigation: high-entropy ids; the claimant, amount, and counterparty stay private regardless.
3. **Timing correlation (T-3).** Public shield/withdraw legs plus timing can correlate a shielding event to a later claim. Mitigation: shield ahead of time, not shield-then-immediately-claim.
4. **Ownerless, unaudited contracts (T-6).** No admin, no upgrade path. A finding means a redeploy, not a patch. Adversarial coverage is not an audit.

## Evidence

Nothing here is self-reported. Each claim maps to an artifact that can be independently re-checked — full list in [`evidence/claims.json`](./evidence/claims.json), regenerated by `verify-mainnet.ts`. The verifier is written to be able to disagree with this document: it re-reads receipts from chain, decodes events, and fails loudly if what it finds doesn't match the claim.

| Claim | Status | Evidence |
| --- | --- | --- |
| One active claimant per right | Proven (tests) + Proven (mainnet) | `tests/adversarial`: `full_lifecycle_unclaimed_active_consumed`, `second_claim_on_active_right_reverts`; live on mainnet, see below |
| Claiming wallet unlinked from the right | Proven | `direct_registry_call_reverts` + 4 mainnet claims routed through the real `ClaimAnonymizer`, reconciled against receipts directly (not just app logs) |
| Claimant/amount/counterparty never public | Proven | privacy boundary table above + no identity in registry events |
| Duplicate claim refused on-chain | Pending | proven in tests (`second_claim_on_active_right_reverts`); a live attempt timed out at the wallet without a conclusive on-chain result — not yet exercised live |
| Settlement consumes the right once | Proven (tests) + Proven (mainnet) | `replayed_settlement_reverts` + live `settleAndRepay()`, see below |
| The venue executes only when Sole authorizes | Proven (tests) + Proven (mainnet, affirmative case) | `test_venue_gating.cairo` + live `finance()`, see below; the rejection cases (duplicate right, post-consumption) are proven in tests only, not yet exercised live |
| A consumed right is refused at a *different* venue too | Pending | proven in tests (`second_venue_refuses_a_consumed_right`); not yet exercised live |
| An execution auth is bound to the real on-chain commitment, not a caller-supplied value | Proven (tests) | `venue_rejects_a_tampered_nonce` |
| A right can be financed at most once while ACTIVE | Proven (tests) | `venue_refuses_to_finance_the_same_active_right_twice` |

**What's real on mainnet today, verified independently — not just from app logs, but by fetching each receipt directly from an RPC and checking it against the deployed contracts:**
- All five contracts are deployed and correctly wired (`registry.anonymizer()` returns the live `ClaimAnonymizer` address).
- `register()` proven end to end — [tx `0x7797bdee...ad7b7`](https://voyager.online/tx/0x7797bdeed0c7a852f0ed025e3f3dafa2fd77417b00937081b443eb00b9ad7b7).
- `claim()` proven on mainnet **four times, across two independent accounts**: [`0x3029e23d...`](https://voyager.online/tx/0x3029e23d3eaa0ee82a18b81b828ff49188cb1d8495529248b26e658e53714e0), [`0x1d17afaa...`](https://voyager.online/tx/0x1d17afaa5c31d35a4465796f9e88248e8b440d5121972b88a601b2ec1abe8c3), [`0x1990b99a...`](https://voyager.online/tx/0x1990b99a16dc10c8427f8be3942f9568946867d8d24b37e5109e0ad2e19128), [`0x1b015f46...`](https://voyager.online/tx/0x1b015f46fc8bccd11ea303e15c6bd5bb9543f3a0fc44c3e7496678c5136aa4b) — each independently reconciled: `SUCCEEDED`, emits `RightClaimed` from the real registry address, routes through the real `ClaimAnonymizer` address, and `registry.state_of()` reads `Active` live for the resulting slot. These are the pool-touching transactions in [`strk20.json`](./strk20.json). Some explorer UIs (Voyager's per-contract "Transactions" tab, at least) don't list paymaster-sponsored calls under the contract page — the transactions are real on the real contracts regardless; that's a UI indexing gap, checked directly against RPC receipts here, not assumed.
- `finance()` proven end to end — [tx `0x62c80fd0...`](https://voyager.online/tx/0x62c80fd0e2d782b827e33c1128088c72ba1bdc13eff99b461287bc84e108202): `SUCCEEDED`, routes through the real `ClaimAnonymizer`, and the deployed `ExecutionAdapter` emits `Financed` — financing executed against the ACTIVE right.
- `settleAndRepay()` proven end to end — [tx `0x31e76890...`](https://voyager.online/tx/0x31e7689cb1e267d80909157c094796c864ba6b606a036f07695414ca5292d85): `SUCCEEDED`, the registry emits `RightConsumed` and the adapter emits `Repaid` in the same atomic transaction — the venue repaid and the right consumed together.

**What was blocking `finance`/`settleAndRepay`, and what actually fixed it:** the earlier read that every live `finance()` attempt was failing at wallet-side paymaster simulation was itself unreliable — `SoleClient`'s own `state_of()` decoder treated the registry's Cairo enum return (a `CairoCustomEnum` like `{variant: {Active: {}}}`) as a plain number, which is `NaN`, and silently fell back to `UNCLAIMED` regardless of the real on-chain state. Combined with submitting dependent private actions back to back before the prior one's state was old enough to be included in the wallet's own proof base, this made working claims look like silent failures and made it impossible to tell a genuine paymaster refusal from a misread state. Both are fixed: `decodeRightState()` now decodes the actual enum variant (covered by tests in `client.test.ts`), the SDK verifies the exact expected event on every transition instead of trusting decoded state (`hasExactRightClaim`/`hasExactRightRegistration`), and the app now waits for 11 L2 blocks between dependent private actions before enabling the next one. `finance()` and `settleAndRepay()` both succeeded on the first live attempt after that fix. Duplicate-claim and cross-venue refusal remain proven in tests only — a live duplicate-claim attempt timed out at the wallet without a conclusive on-chain result, so it is not yet exercised live.

## Verification

```
cd contracts && snforge test          # invariant + adversarial suite, CI-checked on every push
npm run test:sdk                      # cross-language derivation parity
node --experimental-strip-types scripts/verify-mainnet.ts --all
```

`snforge test` passes clean — 18/18 adversarial and lifecycle cases, plus 4 cross-language derivation-parity cases (22 total), including the venue-gating, tampered-nonce, double-financing, and cross-venue-refusal cases. Getting there surfaced a real upstream problem worth recording honestly: `snforge` 0.63.0's Cairo test plugin fails to build on any platform (confirmed on native Windows and on a clean Ubuntu CI runner) because of a transitive dependency declaring unsupported `extern` ABIs. `snforge_std` pinned to `0.62.1` avoids the broken dependency entirely; `contracts/Scarb.toml` and the CI workflow both reflect that pin.

The adversarial suite proves, each with the exact panic it must produce:

```
duplicate claim            -> RIGHT_ALREADY_ACTIVE
claim after consumption    -> RIGHT_ALREADY_ACTIVE
second registration        -> RIGHT_ALREADY_REGISTERED
claim before registration  -> RIGHT_NOT_REGISTERED
settle when not active     -> RIGHT_NOT_ACTIVE
replayed settlement        -> NULLIFIER_ALREADY_SPENT
direct registry call       -> CALLER_NOT_ANONYMIZER
venue call without an ACTIVE right   -> AUTH_RIGHT_NOT_ACTIVE
venue call after consumption         -> AUTH_RIGHT_NOT_ACTIVE
second venue on a consumed right     -> AUTH_RIGHT_NOT_ACTIVE
tampered execution-auth nonce        -> AUTH_NONCE_MISMATCH
double-financing the same right      -> RIGHT_ALREADY_FINANCED
```

Plus 4 tests asserting the SDK's Poseidon derivation output matches Cairo's byte-for-byte (`contracts/tests/adversarial/test_parity_check.cairo` and `packages/sole-sdk/src/derive.test.ts`), since the auth-nonce check above depends on that match exactly.

`verify-mainnet.ts` re-reads each mainnet receipt from chain, confirms the emitting contract, checks the transaction routed through the anonymizer, and decodes the event to the transition it must represent — treating a refusal as a first-class artifact that must have moved no state.

## Getting started

```
cd contracts && scarb build && snforge test    # Cairo
cd packages/sole-sdk && npm install && npm test # SDK
cd apps/web && npm install && npm run dev        # web app, http://localhost:3000
```

Full prerequisites and the deploy sequence: [`SETUP.md`](./SETUP.md). First time connecting a wallet: [`docs/WALLET_SETUP.md`](./docs/WALLET_SETUP.md) covers the one-time STRK20 registration step, exactly where to find it, and the one to avoid. Integrating Sole into another app without cloning this repo: [`docs/INTEGRATING.md`](./docs/INTEGRATING.md). What Sole explicitly does not claim: [`docs/NON_CLAIMS.md`](./docs/NON_CLAIMS.md). Every real problem hit building this, and how each was actually resolved: [`docs/FRICTION_LOG.md`](./docs/FRICTION_LOG.md). The same three plus a live evidence ledger, on the deployed site: `/docs`.

## Repository

```
contracts/          RightsRegistry, ClaimAnonymizer, RightRoot, ExecutionAdapter (Cairo)
contracts/tests/    every claim mapped to an adversarial test
packages/sole-sdk/  derivation (parity with Cairo) + integration client
apps/web/           the demo product: a human drives the full lifecycle
evidence/           claims.json (claim -> artifact), deployment.json, verification
scripts/            verify-mainnet.ts, probe-mainnet.ts
docs/               PRIVACY_BOUNDARY, STATE_MACHINE, INTEGRATING, DEMO, WALLET_SETUP, NON_CLAIMS, FRICTION_LOG
```

Companion documents: [DECISIONS](./DECISIONS.md) · [THREAT_MODEL](./THREAT_MODEL.md) · [SECURITY](./SECURITY.md) · [CO_DESIGN](./CO_DESIGN.md) · [BUILD_LOG](./BUILD_LOG.md)

## Status and honest limitations

Thesis-MVP, ships `UNCLAIMED → ACTIVE → CONSUMED` plus the venue-gated financing and cross-venue refusal, on Starknet mainnet today.

1. **First-registration-wins does not prove a real-world right exists.** It enforces exclusivity over the commitment. An attested root is the production input-trust layer (THREAT_MODEL T-1, DECISIONS D-006).
2. **Anyone with the canonical id can read a right's lifecycle state.** By design — the enforcement state is public. Low-entropy ids narrow this; the economic relationship stays private regardless.
3. **The claim/settle/finance path is browser-only by construction.** It routes through the STRK20 pool's `privacy_invoke` via `WalletAccountV6`, which requires a real connected wallet's injected provider — not something a headless script or backend can call, by design of the Wallet API route.
4. **Not audited.** The invariant is covered adversarially; that is not an audit. Contracts are ownerless with no upgrade path, so a finding means a redeploy, not a patch.
5. **Extensions not shipped:** EXPIRED, CANCELLED, PARTIALLY_SETTLED. Documented in `docs/STATE_MACHINE.md`, deliberately not implemented before the core is proven on mainnet.

Apache-2.0.
