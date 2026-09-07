# Friction Log

This is a record of observed integration problems, not a list of guarantees.
Each item says what was found and what the repository now does about it.

## Toolchain and deployment

**The 0.63.0 Cairo test-toolchain path failed during plugin/dependency
compilation.** The failure involved an unsupported transitive `extern` ABI
reported while the compiler evaluated type size. **Resolution:** the project
pins the compatible test dependency in `contracts/Scarb.toml`. Re-run
`cd contracts && snforge test` in an environment with that toolchain before
claiming a fresh pass.

**Universal-deployer construction changed `get_caller_address()`.** A
registry deployed through the universal deployer sees that deployer contract,
not the submitting account, as its constructor caller. **Resolution:** the
registry constructor accepts the intended deployer explicitly and the one-time
anonymizer initialization checks that stored address.

**The deployed second adapter does not report a distinct venue address.** Both
configured adapters share the registry, but the live `venue()` read resolves
to the registry address rather than the adapter address. **Resolution:** the
app now checks this before describing a result as cross-venue and refuses to
present the current configuration as independent-venue evidence. A redeploy
and fresh verification are required.

## Wallet route

**The privacy route is browser-wallet-only.** The app uses an injected wallet
and its Wallet API; a headless backend cannot reproduce a user wallet's
private-action flow. **Resolution:** the SDK exposes that route explicitly and
the app does not pretend a server can complete it for a user.

**Wallet API felt formatting is stricter than ordinary account calls.** A
zero-padded hexadecimal felt can be rejected during wallet preparation even
when a normal account call accepts it. **Resolution:** values sent to the
wallet are normalized through `normalizeFelt()`.

**Standalone invoke behavior was overgeneralized from an earlier observation.**
An earlier wallet/action shape rejected a bare invoke before submission; that
does not prove standalone invoke is universally invalid or that a deposit is
required. **Resolution:** the current default is one invoke action. A
deposit-plus-invoke shape is an explicit, user-reviewed compatibility option
only. The recorded private receipts use that older shape, so they do not prove
the default bare-invoke path has landed on mainnet.

**A combined deposit-plus-invoke receipt could succeed while omitting the
invoke.** Decoding an observed transaction showed a deposit without the target
anonymizer call. **Resolution:** state-changing SDK calls check the exact
expected registry or adapter event; a successful wallet response alone is not
accepted as a successful protocol action.

**A wallet timeout is outcome-ambiguous.** The extension can submit a request
but fail to return the hash to the page. **Resolution:** the UI preserves the
local claim intent, offers a read-only reconciliation, and never automatically
retries a paid request.

**Back-to-back private actions can fail before submission.** A later proof may
not yet see the previous state in its proof base. **Resolution:** the app waits
11 L2 blocks after each confirmed state-changing action before enabling the
dependent one.

**The sponsor rejects calls it predicts will revert.** A duplicate claim or a
non-ACTIVE adapter call can produce a preflight `PaymasterV2Error` without a
transaction hash. **Resolution:** the negative-path controls read the public
precondition instead of repeatedly opening paid wallet prompts. That protects
funds but means there is no recorded mainnet rejection receipt.

**A connected-wallet self-paid bypass was not a bypass.** The former path
still used the wallet submission channel and did not create a separate
key-holding sender. **Resolution:** it was removed. A true self-paid design
would require a separate funded account and is not silently added to this
wallet-only app.

## State, evidence, and infrastructure

**The SDK initially decoded the Cairo state enum as a number.** The custom enum
read became `NaN` and fell back to `UNCLAIMED`, making successful transitions
look failed. **Resolution:** `decodeRightState()` handles the enum shape and
transition calls check exact expected events.

**Receipt facts were being described too broadly.** The live `Financed` and
`Repaid` events prove the fallback adapter recorded then cleared an opaque
position. The adapter source does not transfer tokens or call an external
market. **Resolution:** the app and evidence ledger now name that bookkeeping
precisely rather than calling it financing, lending, or repayment.

**Public pool deposits materially narrow the privacy story.** Recorded private
receipts join a public indexed 12 STRK deposit, anonymizer invocation, and
Sole slot in one transaction. **Resolution:** wallet unlinkability was removed
from the claims; [`PRIVACY_BOUNDARY.md`](./PRIVACY_BOUNDARY.md) is the single
source of truth.

**A public RPC endpoint stopped responding.** A former fallback returned HTTP
410, leaving receipt waits hung independently of the wallet. **Resolution:**
the app uses a current public endpoint by default and wraps waits in an actual
timeout.
