# Sole

**A right can be privately held, publicly enforceable, and consumed exactly once.**

Sole is a privacy-preserving exclusivity protocol for economic rights, built on Starknet's STRK20 privacy pool. It answers one question that transparent registries cannot: *can this right be claimed, without revealing who already holds it?*

```
UNCLAIMED  --claim()-->  ACTIVE  --settle()-->  CONSUMED
                           |
              second claim() on the same right
                           |
                           v
                RIGHT_ALREADY_ACTIVE  (reverts, moves nothing)
```

The enforcement state is public. The economic relationship behind it is private.

Live demo: `FILL` · Video: `FILL` · Mainnet manifest: [`strk20.json`](./strk20.json)

## Why this needs to exist

An economic right — a receivable, a licence, an allocation, a collateral claim — often must be *exclusive*: it can be held by exactly one party at a time. Today exclusivity is enforced by a registry everyone can read, or by no registry at all.

- A public registry prevents double-claiming but exposes the financing relationship: who is borrowing, from whom, how much, how often. Competitors and counterparties read it.
- No registry means the same right can be pledged twice. In trade finance this is duplicate financing, a persistent, expensive fraud.

Existing duplicate-financing systems (for example MonetaGo) close the gap by making claims globally queryable or by sharing document fingerprints between participating institutions. Sole asks a different question: **can a party prove a right is available for exclusive claim without learning the private financing relationships around it?**

## What Sole actually does

A right is identified by a canonical id. From it, anyone can derive a deterministic `slot_key`. That determinism is the point: a second claimant computes the same key and collides with the first. But the *ownership* of the right lives in a separate private commitment that the registry never opens.

```
slot_key     = Poseidon(TAG_SLOT, canonical_asset_id)                       // shared, public
claim_record = Poseidon(TAG_CLAIM, slot_key, claimant_secret, funding_note) // private
nullifier    = Poseidon(TAG_NULL, claimant_secret, slot_key)                // consumes once
```

The public chain only ever holds `slot_key -> state -> commitment`. It never holds the claimant, the amount, or the counterparty.

## The invariant

```
for every slot_key:
    state in {UNCLAIMED, ACTIVE, CONSUMED}
    state == ACTIVE    =>  exactly one valid claim commitment is recorded
    state == CONSUMED  =>  no new claim may become ACTIVE
and:
    claimant identity  not in public registry state
    claim amount       not in public registry state
    counterparty       not in public registry state
```

## What only Sole enforces

Preventing a bad fill inside one settlement is a solved thing: a market can check the amount and roll its own transaction back. That guarantee lives inside a single deal, at a single venue, in a single moment.

Sole's guarantee is different in kind. A right, once consumed, is spent **everywhere** — for every venue, every lender, every future moment — and no venue that refuses it learns who held it first. Two lenders who have never met, at two markets that do not share a ledger, cannot both finance the same underlying right. The first financing consumes it; the second is refused on-chain, at a different venue, with the holder still hidden.

```
right R  --financed at venue 1-->  CONSUMED (global)
                                       |
   later, venue 2, a different lender  |
                     finance(R)  ------+--->  REVERT: right is spent
                                              (venue 2 learns only that R is taken,
                                               never who took it)
```

That is the property a per-settlement rollback cannot reach: single-use across parties and venues that do not trust or observe each other, with ownership private throughout. It is the reason Sole is a rail and not a check that belongs inside one market.

## The privacy boundary

Stated honestly, because a vague privacy claim is worse than none.

| Data | Public | Private | Note |
|---|:---:|:---:|---|
| Right state (UNCLAIMED/ACTIVE/CONSUMED) | yes | | the enforcement fact |
| Slot identifier | yes* | | *anyone with the canonical id can query a right's state |
| Claimant identity | | yes | never stored in clear; anonymizer-mediated |
| Funding amount | | yes | STRK20 shielded note |
| Claimant wallet | | yes | anonymizer boundary; wallet is never the registry caller |
| Counterparty relationship | | yes | not encoded in public registry state |
| Consumption | yes | | public lifecycle transition |
| Disclosure artifact | scoped | | only the intended recipient learns the permitted fact |

**Sole does not hide whether a known right is active. It hides the economic relationship behind that state.** If you hold the canonical id you can read the lifecycle; you still cannot learn who owns it, for how much, or with whom. See [`docs/PRIVACY_BOUNDARY.md`](./docs/PRIVACY_BOUNDARY.md).

## Why STRK20 is causally necessary, not decorative

```
canonical right
   | claim (private, via anonymizer)          Bank B: same right
   v                                             | claim()
RightsRegistry -- mints --> ExecAuth (single-use) v
   |                              |            REVERT RIGHT_ALREADY_ACTIVE
   | shielded funding             v            (no auth -> venue never runs)
   v                     ExecutionAdapter.finance()  [gated: right must be ACTIVE]
   |                              |
   |                              v
   |                        money market executes (Vesu, or FallbackMarket)
   v                              |
settle_and_repay <---- repay + consume auth ----+   -> right CONSUMED
```

STRK20 provides the private money; the money market provides the liquidity; **Sole provides the scarce, single-use execution right** that gates the market. Three separate primitives. The venue is causally downstream of Sole: Bank B's duplicate claim reverts before any authorization exists, so the market is never called. Remove the anonymizer and the claiming wallet leaks onto the public transition; remove Sole and the market can finance the same right twice.

Remove the anonymizer and the claiming wallet becomes `msg.sender` on the public transition, linking a real identity to the right and defeating the thesis. The nullifier that consumes a claim is STRK20's own double-spend primitive, reused for consumption semantics rather than reinvented. Integration depth: shielded notes, private transfer, anonymizer boundary, nullifier, scoped viewing keys, the SDK, and a custom Cairo state machine.

## Verification

Nothing here is self-reported.

```
cd contracts && snforge test          # invariant + adversarial suite
npm run test:sdk                      # cross-language derivation parity
node --experimental-strip-types scripts/verify-mainnet.ts --all
```

The adversarial suite proves, each with the exact panic it must produce:

```
duplicate claim            -> RIGHT_ALREADY_ACTIVE
claim after consumption    -> RIGHT_ALREADY_ACTIVE
second registration        -> RIGHT_ALREADY_REGISTERED
claim before registration  -> RIGHT_NOT_REGISTERED
settle when not active     -> RIGHT_NOT_ACTIVE
replayed settlement        -> NULLIFIER_ALREADY_SPENT
direct registry call       -> CALLER_NOT_ANONYMIZER
```

`verify-mainnet.ts` re-reads each receipt from chain, confirms the emitting contract, checks the claim routed through the anonymizer, and decodes the event to the transition it must represent — and treats the Bank B revert as a first-class evidence artifact that must have moved no state.

## Repository

```
contracts/        RightsRegistry, ClaimAnonymizer, RightRoot (Cairo)
packages/sole-sdk/ derivation (parity with Cairo) + integration client
apps/web/         the demo product: a human drives the full lifecycle
tests/adversarial/ every claim mapped to a test
evidence/         claims.json (claim -> artifact), deployment, verification
scripts/          verify-mainnet, verify-privacy
docs/             ARCHITECTURE, PRIVACY_BOUNDARY, STATE_MACHINE, INTEGRATING, DEMO
```

Companion documents: [ARCHITECTURE](./ARCHITECTURE.md) · [THREAT_MODEL](./THREAT_MODEL.md) · [DECISIONS](./DECISIONS.md) · [SECURITY](./SECURITY.md) · [CO_DESIGN](./CO_DESIGN.md) · [BUILD_LOG](./BUILD_LOG.md) · [docs/INTEGRATING](./docs/INTEGRATING.md)

## Status and honest limitations

Live on Starknet mainnet (`FILL` after deploy). This is a thesis-MVP: it ships `UNCLAIMED -> ACTIVE -> CONSUMED` and documents the rest as a roadmap rather than pretending it shipped.

1. **First-registration-wins does not prove a real-world receivable exists.** It enforces exclusivity over the commitment. Establishing that a canonical id maps to a legitimate real right is the job of an *attested root*, deferred to production (see THREAT_MODEL T-1, DECISIONS D-006).
2. **Anyone with the canonical id can read a right's lifecycle state.** By design — the enforcement state is public. Low-entropy ids narrow this; the economic relationship stays private regardless.
3. **The claim/settle compute runs through the pool's privacy path, which the browser wallet cannot fully express today.** The demo binds the user-facing actions to the wallet and routes the compute leg accordingly.
4. **Not audited.** The invariant is covered adversarially; that is not an audit. Contracts are ownerless with no upgrade path, so a finding means a redeploy, not a patch.
5. **Extensions not shipped:** EXPIRED, CANCELLED, PARTIALLY_SETTLED. Documented in STATE_MACHINE, deliberately not implemented before the core is proven on mainnet.

Apache-2.0.
