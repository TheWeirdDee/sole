# Wallet setup (Ready)

Every `claim`/`finance`/`settle`/`settleAndRepay` call in Sole routes through
the STRK20 pool's `privacy_invoke`, which requires the connected wallet to
have completed a one-time, per-account setup step first. This is a Starknet
Wallet API / STRK20 requirement, not something Sole's code can do on the
account's behalf - skip it and every private action reverts with
`NOT_REGISTERED`, which looks like a dapp bug but isn't one.

## 1. Install Ready and fund it

Install the [Ready](https://ready.co) browser extension and fund the account
with STRK on **Starknet mainnet** (not testnet). Budget at least ~30 STRK for
a full demo run: each private action's own bundled shield is ~2x the pool's
current flat fee (currently ~12 STRK per action - read live, see
[`SETUP.md`](../SETUP.md)), plus a small amount for the one-time registration
step below, plus gas.

## 2. Find "Enable private tokens" - not Smart Account settings

This is the step that costs people the most time, because Ready has **two
different, unrelated** screens that both sound like they might be it:

- **Settings → Smart Account** ("Smart Account is not activated - Click to
  enable"). **This is not it.** Smart Account activation is about account
  abstraction / gas sponsorship, unrelated to STRK20 privacy. Enabling it
  does not register a viewing key and does not fix `NOT_REGISTERED`.
- **The main wallet view** (the screen showing your token balances, Swap /
  Fund / Send / Portfolio) - this is the right one. Look for a card or
  banner titled **"Shielded tokens are here"** or **"Enable private
  tokens."** Tapping it opens a short explainer ("Register this account to
  receive private tokens and shield your balance... Shield to send
  privately... Unshield anytime") followed by a **Shield** screen.

*(A screenshot of this exact card, taken from a real Ready session, belongs
here - add one from `docs/screenshots/` if you have it on hand.)*

## 3. On the Shield screen: enter a small amount, not 100%

The Shield screen shows your available public STRK balance with a slider and
`50%` / `100%` quick-select buttons. **Do not select 100%, and do not shield
your whole balance.** This single screen is what actually completes
registration (it publishes your viewing key on-chain as part of the shield
transaction), but the amount you shield here is separate from what Sole's
own actions need - each of those bundles and pays for its own shield
automatically when you use the app.

Type in a small, specific amount instead - **3-5 STRK is enough** to
register. Shielding more than that just parks money in your private balance
early for no reason; shielding everything (100%) leaves nothing public to
pay gas or the app's own per-action deposits with, and effectively locks you
out until you unshield something back.

Confirm, wait for the transaction to land, then reload the dapp and
reconnect.

## 4. You're set

From here, every `claim`/`finance`/`settle`/`settleAndRepay` click in the
demo will prompt Ready for its own bundled deposit + invoke - normal wallet
behavior, one prompt per action, no further one-time setup needed for this
account. If you ever connect a *different* account, it needs its own
"Enable private tokens" pass - registration is per-account, not
wallet-wide.

## Expect two wallet prompts for "Shield, claim & finance"

That button submits **two separate mainnet transactions** - claim, then
finance - not one. Ready will ask you to sign twice in a row. That is
expected behavior, not a stuck wallet and not the dapp retrying anything.
If you only confirm the first prompt, the right becomes ACTIVE (claimed)
but is not yet financed, and the second half never happened.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `NOT_REGISTERED` / code 118 | This account hasn't completed step 2-3 above. |
| Wallet dialog shows a red "Transaction failed" *before* you press Confirm | The wallet's pre-flight simulation predicts a revert - confirming won't help; something upstream needs fixing, not another click. |
| Wrong account shown as connected | Ready remembers multiple accounts; check the account name/address at the top of the wallet panel matches the one you registered and funded. |
| Two sign prompts back to back for one button | Expected - see above, that button is two transactions. |
| Ready's own console logs `No viewing key available for account ... Ensure the account is provisioned via the backend` | Seen even on a freshly registered, freshly funded account, on the `finance()` step specifically. This is Ready's own extension reporting that *its* backend hasn't finished provisioning the account for privacy operations - not something Sole's contracts or SDK can detect or fix from the dapp side. If finance keeps failing with a generic wallet error right after this log line appears, the wallet itself isn't ready yet; retrying immediately is unlikely to help. |
