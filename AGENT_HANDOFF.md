# Agent Handoff — Sole

You are implementing Sole for the STRK20 Private Sprint (deadline Sept 7, judged Sept 8). The strategy, protocol, and scaffold are frozen and correct — this repo already contains the contracts, SDK, web app, tests, docs, and evidence structure. Your job is to make it run on Starknet mainnet without weakening the thesis. Strategy is owned; you own execution.

## Hard rules (every file, every commit)
- **No literal emoji anywhere** — UI, copy, logs, commits, README. Icons are **lucide-react components only** (the web app already follows this).
- Stack: **Next.js 16.2 with `--webpack`** (never Turbopack), **TypeScript strict**, **Tailwind**. Contracts in **Cairo** (Scarb + snforge). SDK in TypeScript.
- Starknet tooling: **starknet.js v10.4.0 + Ready wallet + get-starknet**. Not wagmi/viem — that's EVM.
- Do not weaken the thesis to make implementation easier. Make the implementation smaller while preserving the thesis.

## The thesis (never drift from this)
A right can be privately held, publicly enforceable, and consumed exactly once. The enforcement state is public; the economic relationship behind it is private. Demo vertical: duplicate-financing rejection, one receivable, two banks. The registry itself is use-case agnostic.

## Four invariants = Definition of Done (these are acceptance criteria, not nice-to-haves)
1. **Protocol invariant** — one right, one active claimant, one consumption. Enforced by `RightsRegistry`, proven by `tests/adversarial`.
2. **Privacy/integration invariant** — the claimant enforces the right without exposing identity or funding relationship. The anonymizer + shielded funding are causally necessary, not decorative.
3. **Product invariant** — a real human drives the full lifecycle in a browser (`apps/web`). Not a script. Not a CLI.
4. **Proof invariant** — the demo visibly proves failure (Bank B rejection), and mainnet transactions are reconstructed from chain by `verify-mainnet.ts`, not self-reported.

## Build order (Phase 1 before any polish)
1. **Contracts green.** `cd contracts && scarb build && snforge test` — all cases in `tests/adversarial` pass, each with its exact expected panic. Fix Cairo version/import issues against the current STRK20 skills (`npx skills add welttowelt/strk20-skills`) — do not guess pool APIs.
2. **Anonymizer ↔ pool wiring.** Bind `ClaimAnonymizer` to the live STRK20 pool's privacy_invoke path. Confirm a claim through the pool records the anonymizer as the registry caller, never the wallet. This is invariant 2 and the 30% score.
3. **Deploy to mainnet.** RightsRegistry, ClaimAnonymizer, FirstRegistrationRoot. Record addresses in `evidence/deployment.json` and `strk20.json`.
4. **Run the seven-transaction sequence** (see `strk20.json`): register → shield → claim(ACTIVE) → **duplicate claim reverts** → settle(CONSUMED) → scoped disclosure → fresh register. Each has a narrative purpose; never manufacture a transaction for a count.
5. **Bind the SDK seam.** Implement `SoleClient.privacyInvoke` against the pool SDK (`docs/INTEGRATING.md`). Wire the web app buttons to real calls behind a demo/live toggle — the local state model stays as the offline fallback.
6. **Evidence.** Fill `evidence/claims.json` transactions, run `verify-mainnet.ts --all` green.
7. **Co-design.** Replace the `CO_DESIGN.md` template with one real, attributed practitioner conversation about duplicate pledging and the concrete design change it caused. This is a DoD item — it does not ship empty.
8. **Video + manifest.** Record the 3-minute demo per `docs/DEMO.md` (open on the rejection). Fill all `FILL` fields in `strk20.json`.

## Acceptance checklist (must all be true to submit)
- [ ] `snforge test` green, every adversarial case asserts its exact panic
- [ ] SDK derivation parity test green (Cairo `Tags` == TS `TAG_*`)
- [ ] Three-plus qualifying successful mainnet transactions through our contracts
- [ ] Bank B duplicate claim reverts on mainnet with `RIGHT_ALREADY_ACTIVE`, moves no state
- [ ] A human can complete register → claim → (watch B fail) → settle in the browser
- [ ] Four scoped views render and differ (public/holder/counterparty/auditor)
- [ ] `verify-mainnet.ts --all` reconstructs every transition from chain
- [ ] `CO_DESIGN.md` contains a real voice and a real design change
- [ ] `strk20.json` has demo URL, video, contracts, tx hashes; no `FILL` left
- [ ] README privacy-boundary table and limitations are accurate to what shipped

## Authoritative sources (pull exact APIs from these, don't guess)
- STRK20 skills: `npx skills add welttowelt/strk20-skills`
- STRK20 by example: https://strk20-by-example.org (notes, nullifiers, viewing keys, Wallet API, anonymizer contracts, SDK)
- Build hub: https://strk20.starknet.io/build ; starter kit for the wallet/shield/privacy_invoke helpers
- Evidence-standard benchmark to match (not copy): github.com/winsznx/limen
- Cost: each STRK20 privacy action is a flat 4 STRK (~$0.10); fund ~$20 of STRK for headroom.

Ship the core deep and usable on mainnet with Limen-grade evidence. That combination — a private exclusivity primitive nobody else in 194 builds is doing, proven from chain, driven by a human in a browser — is the win.

## Frontend (canonical design = apps/web/preview.html)
`apps/web/preview.html` is the finished, viewable design for all four surfaces
(Overview / Demo / Verify / Protocol) with the sealed-instrument aesthetic, the
wax-seal stamp motion, and the fail-first rejection. It is the source of truth.

Next.js is scaffolded: `app/layout.tsx` + `components/Nav.tsx` (shared chrome),
`app/page.tsx` (landing, ported), and route stubs at `app/app`, `app/verify`,
`app/protocol`. Frontend tasks:
- Port the Demo, Verify, and Protocol markup from `preview.html` into the route
  components, keeping tokens from `tailwind.config.ts` / `globals.css`.
- Wire the Demo flow (`SoleDemo.jsx`) to `@sole/sdk` `SoleClient` behind a
  demo/live toggle; the local state model stays as the offline fallback.
- Wire Verify to a mainnet RPC via `scripts/verify-mainnet.ts` logic.
- Keep the two orchestrated motions only (seal stamp, refused strike); respect
  reduced-motion. No emoji; lucide-react icons only.
