# Sole — Build Handoff

You are implementing Sole for a Starknet STRK20 privacy hackathon (mainnet, judged on integration depth, working product, innovation, and documentation). Strategy and design are frozen; you own execution. The repo already contains the contracts, SDK, web app, tests, docs, and evidence scaffolds. Your job is to take it to mainnet without weakening the primitive.

## What Sole is

Sole turns a real-world financial right into a single-use execution right: claimed privately, enforced exclusively in public, consumed exactly once. The public chain learns only whether a right is available, active, or consumed. It never learns who holds it, the amount, or the relationship behind it.

The right does real economic work: an active right **authorizes one financing action against a money market**, and that authorization is what is scarce. When the financing settles, the right is consumed — permanently, everywhere.

## The guarantee that defines Sole (build the demo around this)

A right consumed once is spent for **every** venue, every lender, every future moment — and no venue that refuses it learns who held it first. Two lenders who never meet, at two markets that share no ledger, cannot both finance the same underlying right. The first financing consumes it; a second attempt, even at a different venue later, reverts on-chain with the holder still hidden.

This is the property to make unmistakable. Preventing a bad fill inside one settlement is ordinary. Enforcing single-use of a right across distrusting parties and independent venues, with ownership private throughout, is the thing.

## Four invariants = Definition of Done (acceptance criteria, not extras)

1. **Protocol** — one right, one active claimant, one consumption. Enforced by `RightsRegistry`, proven by the adversarial tests.
2. **Privacy / integration** — the claimant enforces the right without exposing identity or funding relationship; the anonymizer boundary is causally necessary, and STRK20 shielded funding is the money leg.
3. **Product** — a real human drives the whole lifecycle in a browser, including the second-venue refusal.
4. **Proof** — the demo visibly proves refusal (same-venue duplicate and cross-venue), and mainnet transactions are reconstructed from chain by the verifier, not self-reported.

## Architecture

```
canonical right
   | claim (private, via anonymizer)              a second claimant, same right
   v                                                 | claim()
RightsRegistry  -- mints --> ExecAuth (single-use)   v
   |                              |               REVERT: already active
   | shielded STRK20 funding      v               (no auth -> venue never runs)
   v                     ExecutionAdapter.finance()   [gate: right must be ACTIVE]
   |                              |
   |                              v
   |                        money market executes
   v                              |
settle_and_repay  <-- repay + spend auth --+   -> right CONSUMED (global)
                                               |
             later, a DIFFERENT venue         |
                    finance(same right) -------+--> REVERT: right is spent
                                                   (venue learns only that it is taken)
```

Three separate layers, and the separation is the point:
- **STRK20** provides private money (shielded notes, private transfer).
- **The money market** provides liquidity.
- **Sole** provides the scarce, single-use execution right that gates the market.

The venue is downstream of Sole. It cannot execute unless Sole authorized the right, and it refuses a consumed right — including a second, independent venue. Do not let the venue look like an arbitrary place money moves; Sole must be the reason the venue can safely execute.

## Contracts (already in `contracts/src/`)

- `rights_registry.cairo` — the state machine: UNCLAIMED -> ACTIVE -> CONSUMED, with the double-claim revert. Transitions accepted only from the anonymizer.
- `right_root.cairo` — `RightRoot` trait; `FirstRegistrationRoot` for the MVP (first registration of a canonical id wins). Production swaps an attested root behind the same trait; the registry is root-agnostic.
- `claim_anonymizer.cairo` — the privacy boundary; drives register / claim / settle and the venue calls (`finance_through`, `settle_and_repay`), pool-gated.
- `execution_adapter.cairo` — `IExecutionAdapter` + single-use `ExecAuth`. Two implementations behind one interface:
  - `FallbackMarket` — a minimal in-repo lending vault. Ships a complete mainnet loop with no external dependency.
  - `VesuAdapter` — the real Starknet money market. Two entrypoints (`finance`, `settle`) have `TODO(integration)` markers to wire against the live market interface.

Both adapters run the same gate: the right must be ACTIVE in the registry. That single check is what gives the cross-venue guarantee for free — a consumed right fails the gate at any adapter.

## Build order

1. **Contracts green.** `cd contracts && scarb build && snforge test` — every case passes, each adversarial test asserting its exact expected panic (double-claim, replay, direct call, venue-not-active, cross-venue refusal). Fix any Cairo/toolchain version issues against the current STRK20 skills rather than guessing pool APIs.
2. **Anonymizer <-> pool.** Wire the anonymizer to the STRK20 pool privacy path so a claim/finance records the anonymizer as caller, never the wallet.
3. **Deploy to mainnet.** RightsRegistry, ClaimAnonymizer, FirstRegistrationRoot, and one adapter (FallbackMarket first). Record addresses in `evidence/deployment.json` and `strk20.json`.
4. **Run the transaction sequence** (see `strk20.json`): register -> shield -> claim (ACTIVE, mints auth) -> finance (market executes) -> duplicate claim reverts -> settle_and_repay (CONSUMED) -> second-venue finance reverts -> scoped disclosure. Each transaction has a narrative purpose. Never manufacture a transaction for a count.
5. **Second venue.** Deploy a second `FallbackMarket` instance against the same registry. Its refusal of the consumed right is a real mainnet transaction and the demo's closing beat.
6. **Bind the SDK seam.** Implement `SoleClient.privacyInvoke` against the pool SDK; wire the web app buttons to real calls behind a demo/live toggle (the local state model stays as the offline fallback).
7. **Evidence.** Fill `evidence/claims.json` transactions; the verifier reconstructs each transition from chain and confirms every refusal moved no state.
8. **Co-design + video + manifest.** Put one real, attributed practitioner note about duplicate pledging in `CO_DESIGN.md` and the concrete design change it caused. Record the demo video opening on the refusal. Fill every `FILL` in `strk20.json`.
9. **Vesu (ceiling only).** Attempt `VesuAdapter` against the live market only once the full sequence is green on FallbackMarket. Flipping adapters changes nothing in Sole's authorization path or the demo.

## Commit discipline (important — read before you push)

The build is public and mirrored to a live dashboard: every push, the diff, and the commit message are visible to others in real time. Commit **per file, in small individual pushes**, so progress registers cleanly and reviewers can follow each change on its own.

Commit messages describe **what the code does in Sole's own terms only**. Never reference other projects, builders, external hackathons, patterns taken from elsewhere, or the reasoning about how the design was chosen. No "inspired by", no comparisons, no strategy notes. A message says, for example, `add ExecutionAdapter gate: financing requires an ACTIVE right` — not why, not from where. Keep code comments to the same standard: they explain the mechanism, never its provenance. The repository should read as a self-contained protocol that stands on its own.

## Authoritative sources (pull exact APIs from these; don't guess)

- STRK20 agent skills (install via the sprint's published skills command) — pool, Wallet API, anonymizer contracts, SDK.
- STRK20 by example — notes, nullifiers, viewing keys, private transfer, the starter kit's shield / privacy_invoke helpers.
- The live money market's own interface docs for the Vesu adapter TODOs.

## Acceptance checklist

- [ ] `snforge test` green; every adversarial case asserts its exact panic
- [ ] SDK <-> Cairo derivation parity (tags and hashes match)
- [ ] three-plus qualifying successful mainnet transactions through Sole's contracts
- [ ] duplicate claim reverts on mainnet; venue never called
- [ ] financing executes against the market on the authorized right
- [ ] a second, independent venue refuses the consumed right on mainnet, holder hidden
- [ ] a human completes register -> claim -> finance -> (watch duplicate + cross-venue fail) -> settle in the browser
- [ ] four scoped views render and differ
- [ ] the verifier reconstructs every transition from chain
- [ ] `CO_DESIGN.md` has a real voice and a real design change
- [ ] `strk20.json` complete; no `FILL` left
- [ ] every commit is single-file, self-contained, and provenance-free
