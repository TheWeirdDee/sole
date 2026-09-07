# Friction Log

The real problems hit building Sole against STRK20 and Starknet mainnet,
in the order they surfaced. Each entry: what happened, what was tried, and
where it actually landed. Nothing here is smoothed over — several of these
cost real STRK on failed mainnet attempts before the actual cause was found.

## Toolchain

**`snforge` 0.63.0's Cairo test plugin fails to build**, on native Windows
and on a clean Ubuntu CI runner alike, because a transitive dependency
declares an `extern` ABI the plugin's build doesn't support.
*Resolution:* pinned `snforge_std` to `0.62.1` in `contracts/Scarb.toml` and
CI, which avoids the broken dependency entirely.

## Wallet API integration

**A bare install of `starknet` resolves to a version without the STRK20
Wallet API at all.** `npm install starknet` pulled the `latest` dist-tag,
which lacked `WalletAccountV6`, `strk20InvokeTransaction`, and
`STRK20_ACTION`. *Resolution:* pinned `starknet@^10.4.0` explicitly, and
`get-starknet-core` to a version whose `createStore()` returns wallets
already in Wallet Standard shape — the older `getAvailableWallets()`/
`enable()` pair returns a shape `WalletAccountV6.connect()` can't consume.

**The Wallet API's FELT type rejects zero-padded hex.** It's specced as
`^0x(0|[a-fA-F1-9]{1}[a-fA-F0-9]{0,62})$` — no leading zero digits — unlike
the padded addresses `sncast`/block explorers display and this repo's own
`deployment.json` stores. Submitting a padded address through
`strk20InvokeTransaction` fails with `INVALID_REQUEST_PAYLOAD`, even though
the identical address works fine through a plain `account.execute()`.
*Resolution:* every felt reaching the wallet is normalized through
`normalizeFelt()` first, not just the addresses known to be padded today.

**A bare invoke-only actions array is rejected outright.** Every documented
`privacy_invoke` example pairs the invoke with a real value-moving action
(withdraw/deposit/transfer); an invoke sent alone fails wallet-side payload
validation before it ever reaches proving. *Resolution:* every
`privacy_invoke` call is paired with a small deposit (2x the pool's current
fee) into the caller's own private balance — it moves value nowhere but
back to them, and rolls back atomically if the invoke reverts.

**`NOT_REGISTERED` (Wallet API code 118) on an account's first-ever STRK20
use**, despite the spec describing pool registration as "transparent."
Ready does not register inline on a combined deposit+invoke for a new
account. *Resolution:* the wallet's own one-time "Enable private tokens"
step (documented in `docs/WALLET_SETUP.md`) must be completed by the
account owner before any private action; Sole does not attempt to
paper over this with an automatic setup transaction.

## The dropped invoke — the longest-running one

**A combined deposit+invoke transaction could confirm successfully
(`SUCCEEDED`, no revert) while the wallet silently omitted the invoke from
what it actually submitted** — verified by decoding the raw on-chain
calldata: the target contract address was simply absent. The deposit still
charged real STRK. This looked, for a long stretch, like `finance()`
specifically was blocked — repeatable, generic wallet error, no Cairo
revert reason.

**A related false positive**: `waitForTransaction()` does not throw on a
reverted transaction by default (its `errorStates` option defaults to
empty — it only watches finality, not execution outcome). A genuine Cairo
revert and a silently-dropped invoke both surfaced identically if only
checked for "no matching event, empty receipt.events." An early fix
conflated the two, misreading a real revert (e.g. `AUTH_NONCE_MISMATCH`) as
"dropped" and retrying with the invoke sent alone — which fails wallet-side
payload validation on its own regardless. *Resolution:* check
`execution_status` first; a real revert throws immediately with the actual
Cairo reason instead of being treated as ambiguous.

**Automatic retry made it worse.** Firing a second
`strk20InvokeTransaction` immediately back-to-back with a suspected-dropped
first attempt produced its own wallet/paymaster-level failures
(`PaymasterV2Error` code 156, no transaction ever submitted), with account
balance ruled out as the cause. The rapid back-to-back pair was the likely
trigger, not anything in the calldata. *Resolution:* the SDK no longer
retries a privacy invocation inline, ever — a caller must reconcile the
registry's actual on-chain state before deciding whether another action is
safe.

**A self-paid "bypass the paymaster" path was built on a misreading of the
Wallet API and never worked.** `SoleClient.financeSelfPaid()` /
`claimSelfPaid()` called `account.executeWithProof(call, proof)` on the
*connected* wallet account, on the theory that this would submit the
wallet-prepared `{call, proof}` pair without the wallet's own paymaster
sponsorship. In fact `executeWithProof()` still routes through the wallet's
own submission channel (`addInvokeTransaction`, same as every other wallet
call) — it is not a bypass at all, and its documented calling convention
takes the caller's *own* built contract calls (e.g.
`myContract.populate('claim')`) plus a separately-obtained proof, not the
`call` object `strk20PrepareInvoke` returns. The actual documented
self-paid pattern requires a completely separate, key-holding `Account`
(a "sponsor account," in the SDK's own terminology) submitting via a plain
`execute()` — a real architecture change for an app that otherwise never
holds a private key, not attempted here. *Resolution:* the broken methods
and their UI buttons were removed rather than fixed to look like they work.

**The actual root cause, once found, was upstream of the wallet entirely.**
`SoleClient`'s own `state_of()` decoder treated the registry's Cairo enum
return — a `CairoCustomEnum` shaped like `{variant: {Active: {}}}` — as a
plain number. `Number()` on that object is `NaN`, which silently fell back
to `UNCLAIMED` regardless of the right's real on-chain state. This meant a
genuinely successful claim, and later a genuinely successful `finance()`
and `settleAndRepay()`, could read back as failures indefinitely — not
because the invoke was dropped, but because the reader was lying, including
to earlier debugging attempts on this exact project that concluded specific
claims had failed when they had, in fact, succeeded. *Resolution:*
`decodeRightState()` now decodes the actual enum variant (covered by
tests), and every state-changing call now verifies the *exact* expected
event (`hasExactRightClaim`/`hasExactRightRegistration`) rather than
trusting decoded state at all.

**Dependent private actions submitted back-to-back can fail for reasons
indistinguishable from a paymaster refusal.** Ready's own zero-knowledge
proof is built against an anchored, already-final chain snapshot; state a
prior transaction just wrote may not yet be old enough (~10-11 L2 blocks)
to be included in that snapshot. Submitting `finance()` immediately after
`claim()` confirmed could fail for this reason alone, with no way from the
app side to distinguish it from any other wallet-side rejection.
*Resolution:* the app now waits until the L2 head is 11 blocks past the
preceding state-changing transaction before enabling the next private
action, and documents this explicitly rather than presenting it as
instant.

## Infrastructure

**`waitForTransaction({ retries: N })` does not bound a hung RPC fetch.**
The retry count only helps if each individual poll actually resolves or
rejects; a single fetch to a public RPC node that never responds at all —
no error, no timeout — leaves the retry counter frozen on its first
attempt, hanging the UI indefinitely regardless of the configured retry
budget. *Resolution:* added a real `withTimeout()` (a `Promise.race`
against an actual timer) wrapping every wait, independent of what the
underlying library or RPC does.

**The public Lava RPC endpoint stopped serving.**
`https://rpc.starknet.lava.build`, used as the app's default fallback,
began returning HTTP 410 Gone — confirmed live via a direct request, not
assumed. This silently broke the app's own provider (reads, receipt
reconciliation) independent of anything wallet-related, since it's a
different RPC connection than the one Ready itself uses. *Resolution:*
repointed the fallback to `https://starknet-rpc.publicnode.com`, confirmed
responding.

## Still open

**A live, on-chain reverted transaction for duplicate-claim refusal or
cross-venue refusal has not been captured**, and may not be reachable
through the sponsored wallet path at all. Ready's paymaster runs its own
pre-flight simulation and refuses to sponsor gas for a call it predicts
will revert — which is exactly what a duplicate claim or a finance call
against a consumed right is expected to do. This is standard,
cost-saving paymaster behavior, not a Sole defect, but it means the
specific on-chain artifact these two invariants would produce cannot be
generated through the connected wallet as currently architected. The
invariants remain proven in the adversarial test suite; see
[`NON_CLAIMS.md`](./NON_CLAIMS.md) item 5. The only documented route past
this is the separate-sponsor-account self-paid pattern above, not yet
built.
