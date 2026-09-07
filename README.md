# Sole

**A prototype single-use execution-right state machine on Starknet.**

Sole maps a canonical reference to a public registry slot. A registered slot can
move UNCLAIMED -> ACTIVE -> CONSUMED; the registry accepts transitions only from
its configured anonymizer helper. An adapter re-derives an execution
authorization from the ACTIVE commitment before it records a position.

This repository does **not** claim a live loan, asset transfer, credit
issuance, external-market integration, economic repayment, wallet
unlinkability, or a live cross-venue rejection. The exact boundaries are part
of the product, not fine print: [Non-Claims](./docs/NON_CLAIMS.md),
[Privacy Boundary](./docs/PRIVACY_BOUNDARY.md), and
[Evidence Ledger](./docs/EVIDENCE_LEDGER.md).

## What is deployed and evidenced

~~~text
canonical reference
       |
       | register -> UNCLAIMED
       v
RightsRegistry <- configured ClaimAnonymizer <- STRK20 pool privacy_invoke
       |
       | claim(commitment) -> ACTIVE
       v
ExecutionAdapter.record_position(ExecAuth, opaque_commitment)
       |
       | clear position + consume -> CONSUMED
       v
shared-registry adapter + non-ACTIVE -> REVERT AUTH_RIGHT_NOT_ACTIVE  [source/tests]
~~~

The deployed FallbackMarket adapter records an opaque position commitment and
later clears it. Its Financed and Repaid events prove that bookkeeping and the
registry transition; source inspection shows it does not transfer tokens or
call an external market.

## Mainnet deployments

| Contract | Address |
| --- | --- |
| RightsRegistry | [0x057a…e6f4c](https://voyager.online/contract/0x057a4c75612430dae3a79485c41a53f986c42526df59af4f73485cde56be6f4c) |
| ClaimAnonymizer | [0x01dd…5c74](https://voyager.online/contract/0x01ddb10db13096b973a9a63d02f5e9a6370d3b592cd6ca02a91f5729ca685c74) |
| FirstRegistrationRoot | [0x0368…1aae5](https://voyager.online/contract/0x0368203c991cfcc239560bbfe2dfa52a84bbf950f0603010229180d08341aae5) |
| FallbackMarket adapter 1 | [0x0788…6cf28](https://voyager.online/contract/0x0788f8439042f8750ec90638bc764dd36f766930770238c630df70e667e6cf28) |
| FallbackMarket adapter 2 | [0x01db…6d27c](https://voyager.online/contract/0x01dbf93d533f9b1d4aff959cfd10cd53136663db81f101d74db8008825b6d27c) |

Full deployment hashes and the pool address are in
[evidence/deployment.json](./evidence/deployment.json).

## Evidence, not animation

The recorded set contains one direct registration, four claims, one position
record, and one position clear plus consumption. Every receipt is fetched again
by the verifier; expected status, event, block, receipt fee, public pool
deposit, pool fee withdrawal, and pool invoke are checked rather than trusted
from this file.

~~~sh
node --experimental-strip-types scripts/verify-mainnet.ts --all
~~~

The full ledger includes exact receipt actual_fee values and explains why it is
wrong to collapse an L2 fee, a public 12 STRK deposit observed in these
receipts, and the observed 6 STRK pool withdrawal into one universal cost:
[Evidence Ledger](./docs/EVIDENCE_LEDGER.md).

The verifier has no recorded live rejection receipt. Duplicate claim and
shared-registry adapter rejection are adversarial-test evidence only. The
sponsored wallet path preflights and avoids paying for calls predicted to
revert.

## Privacy boundary

The registry event itself contains a slot and an opaque commitment, not a named
claimant, raw position amount, or counterparty field. The registry caller is
the configured anonymizer, not the wallet.

That is not wallet anonymity. Each recorded pool-routed receipt includes an
indexed public 12 STRK pool deposit, an anonymizer privacy_invoke event, and
the Sole slot in one atomic transaction. The depositing wallet can therefore
be correlated with the slot for those flows. This repository's complete and
exclusive privacy statement is the
[Privacy Boundary](./docs/PRIVACY_BOUNDARY.md).

## State machine

~~~text
UNCLAIMED --register--> REVERT RIGHT_ALREADY_REGISTERED
ACTIVE    --claim-->    REVERT RIGHT_ALREADY_ACTIVE
CONSUMED  --claim-->    REVERT RIGHT_ALREADY_ACTIVE
UNCLAIMED --settle-->   REVERT RIGHT_NOT_ACTIVE
consumed slot --settle--> REVERT RIGHT_NOT_ACTIVE
reused nullifier on another ACTIVE slot --> REVERT NULLIFIER_ALREADY_SPENT
wallet --any--> REVERT CALLER_NOT_ANONYMIZER
shared-registry adapter, non-ACTIVE --finance--> REVERT AUTH_RIGHT_NOT_ACTIVE
~~~

The final line is source-and-test evidence. It is not a live cross-venue
receipt, and the deployed second adapter does not currently report a distinct
venue address. The app detects that configuration and refuses to describe it
as an independent-venue proof.

## Run and verify

~~~sh
npm run test:sdk
npm run build --workspace=sole-web
node --experimental-strip-types scripts/verify-mainnet.ts --all

cd contracts
snforge test
~~~

snforge must be installed locally for the last command. Evidence status is
deliberately tied to a fresh command result rather than a historical test
count.

For the browser demo:

~~~sh
cd apps/web
npm run dev
~~~

Connecting a wallet never registers a right. Registration is explicit per
reference. The live app never automatically retries a wallet timeout or a
known-reverting negative path. Wallet setup and compatibility details are in
[Wallet Setup](./docs/WALLET_SETUP.md).

## How to test this yourself

**No wallet, no gas, two minutes:** open the [live site](https://sole-web-app.vercel.app/),
switch mode to **illustrative (offline)** top-right, and click through Bank A's
buttons in order (Connect, Register, Claim, Record adapter position, then Bank
B's check, Consume, then the second-adapter check). Each step logs the real,
independently-verifiable mainnet transaction for that exact step — click a
logged link to see it on Voyager. The two rejection steps are labeled as
proven in the test suite, not live, and say so in the log.

**Verify any of those hashes yourself, no trust required:** go to `/verify`,
click "try the most recent recorded transaction" (or paste any hash from
[Evidence Ledger](./docs/EVIDENCE_LEDGER.md)), and it re-reads the receipt
from a mainnet RPC in your own browser — not a replay of anything recorded
here. The same check runs from the command line:
`node --experimental-strip-types scripts/verify-mainnet.ts <hash>`.

**Live mode with a real wallet:** requires a Ready wallet on Starknet mainnet
with STRK for fees and its one-time "Enable private tokens" setup done (see
[Wallet Setup](./docs/WALLET_SETUP.md)). Switch mode to live, connect, and
work through the same steps for real — each is a real mainnet transaction.
Bank B's duplicate-claim check and the second-adapter check stay read-only in
live mode too: Ready's paymaster refuses to sponsor a call it predicts will
revert, so neither can currently be captured as a live rejected transaction
through the sponsored wallet path (see [Friction Log](./docs/FRICTION_LOG.md),
"Still open"). `scripts/submit-self-paid-claim.ts` documents the path to
close that gap - submitting a wallet-built proof directly through a plain,
non-wallet account with explicit resource bounds - started but not completed.

## Documentation

- [Evidence Ledger](./docs/EVIDENCE_LEDGER.md) — explicit claim statuses,
  regeneration commands, and receipt facts.
- [Non-Claims](./docs/NON_CLAIMS.md) — what this prototype does not prove or
  implement.
- [Privacy Boundary](./docs/PRIVACY_BOUNDARY.md) — the single source of truth
  for privacy claims.
- [Friction Log](./docs/FRICTION_LOG.md) — tooling, deployment, wallet, and
  evidence failures encountered.
- [State Machine](./docs/STATE_MACHINE.md) — shipped states and forbidden
  transitions.
- [Integrating Sole](./docs/INTEGRATING.md) — wallet API surface and its
  current limitations.

Live site: [sole-web-app.vercel.app](https://sole-web-app.vercel.app/)

Demo video: [youtu.be/TX74QG-1U6g](https://youtu.be/TX74QG-1U6g)

Apache-2.0.
