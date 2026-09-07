# Wallet setup (Ready)

Every `claim`/`finance`/`settle`/`settleAndRepay` call in Sole routes through
the STRK20 pool's `privacy_invoke`, which requires the connected wallet to
have completed a one-time, per-account setup step first. This is a Starknet
Wallet API / STRK20 requirement, not something Sole's code can do on the
account's behalf - skip it and every private action reverts with
`NOT_REGISTERED`, which looks like a dapp bug but isn't one.

## 1. Install Ready and fund it

Install the [Ready](https://ready.co) browser extension and fund the account
with STRK on **Starknet mainnet** (not testnet). Keep a public STRK balance
for the explicit per-right registration transaction, and shield enough STRK
in Ready to cover the private-action fee for each planned claim, finance, and
settlement. Sole reads the pool's flat fee live; it is not sponsored gas and
must not be hard-coded into a budget.

The normal Sole path is **invoke-only**. It does not automatically make a
12 STRK public shield for every action. Ready can reject a standalone action
before submission with the generic `INVALID_REQUEST_PAYLOAD` / code 114. That
only reports a rejected payload; it does not identify the cause or prove that
adding a deposit will help. Sole may show a separate, explicit **legacy
companion-deposit** choice, but it is never chosen or retried automatically.
At a live 6 STRK fee, that optional experiment uses a 12 STRK *gross* deposit;
treat that number as an example, review Ready's prompt, and approve it only
if you deliberately choose to try it.

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
transaction) and creates shielded STRK that Ready can use for later private
action fees. It is not a charge that Sole makes on its own.

Enter a small, deliberate amount rather than selecting 100%. A 3-5 STRK
shield can establish registration, but it does **not** cover one later
private action when the live fee is 6 STRK. If you intend to claim, finance,
or settle, shield at least the current fee plus a margin for each action you
plan to take. Do not shield your entire balance: retain public STRK for
network fees and for any compatibility deposit you consciously choose later.

Confirm, wait for the transaction to land, then reload the dapp and
reconnect.

## 4. You're set

From here, each `claim`/`finance`/`settle`/`settleAndRepay` uses a standalone
private `invoke`. Ready adds its own private-action fee handling; Sole does
not silently add a public deposit or retry the action with one. Each
state-changing action still needs its own Ready approval, and a different
account needs its own **Enable private tokens** pass - registration is
per-account, not wallet-wide.

## Optional legacy companion deposit

If Ready rejects the standalone action during no-gas preparation with
`INVALID_REQUEST_PAYLOAD` / code 114, Sole reports that **no transaction was
submitted**. Code 114 is generic: it is not proof that a companion deposit is
required, nor that the legacy `[deposit, invoke]` shape will succeed. If you
still choose to try that older shape, Sole lets you explicitly enable it for
the tab. Its companion deposit is twice the live flat fee (12 STRK when the
fee is 6 STRK). It is a Ready-specific experiment, not a STRK20 protocol
requirement.

Read the amount in Ready before accepting it. The gross companion deposit is
not simply an L2 gas charge; Ready's own fee and shielded-balance accounting
determine how it appears in the wallet. Sole never enables this mode because
of a timeout, a generic wallet error, or a failed negative-path check. It may
not resolve code 114. You can instead update/wait for Ready or shield funds
deliberately in Ready; do not repeatedly pay for companion-deposit attempts.

## Sole's per-right registration is separate

Ready's **Enable private tokens** is the one-time wallet setup above. It is
not the same thing as Sole's `register_right` call. In Sole, connecting,
reconnecting, switching modes, and starting a different local reference do
**not** submit a transaction. A registry transaction is sent only after the
user explicitly chooses **Register this right once (network fee)** for a
specific receivable reference.

That registry fee is per reference, not per wallet. Sole keeps the selected
reference and its public registration receipt in the browser tab, then
verifies that receipt on reconnect. It never treats `UNCLAIMED` by itself as
proof of registration, because that is also the default state of an unknown
slot. If a registration confirmation times out, Sole saves its transaction
hash immediately, hides the paid registration control, and offers only a
free receipt check. If an older session did not retain the hash, paste the
original reference and the hash shown in Ready's activity into **Recover &
verify registration (no gas)**; Sole checks the exact event for that
reference before enabling claim.

## Claim and finance are separate, delayed actions

Claim and finance are two separate mainnet transactions. Do **not** submit
them back to back: a STRK20 private proof is built against an anchored chain
snapshot, so the state written by the previous transaction must first become
visible to the next proof. Sole waits until the L2 head is at least 11 blocks
past the preceding state-changing transaction before it enables the next
action.

The sequence for a deliberately new right is: explicitly register that right,
wait for maturity, claim, wait for maturity, finance. If Ready reports a
timeout, do not assume the claim failed or retry blindly; reconcile the
right's on-chain state first. A timeout can occur after the wallet submitted a
transaction but before it returned a hash to the dapp.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `NOT_REGISTERED` / code 118 | This account hasn't completed step 2-3 above. |
| `INVALID_REQUEST_PAYLOAD` / code 114 while Sole prepares a private action | Ready rejected the standalone payload before signing or submission. No gas was spent. The code is generic: a companion deposit is optional and may not solve it; Sole will never enable it itself. |
| Insufficient shielded balance / code 119 | Ready cannot cover its private-action fee from shielded STRK. No transaction was submitted; shield funds deliberately in Ready, then retry as one fresh action. |
| Wallet dialog shows a red "Transaction failed" *before* you press Confirm | The wallet's pre-flight simulation predicts a revert. Reject it; confirming will not help. Sole's Bank B and second-venue refusal controls now use free public-state checks and should not open Ready at all. |
| Wrong account shown as connected | Ready remembers multiple accounts; check the account name/address at the top of the wallet panel matches the one you registered and funded. |
| Claim/finance button is waiting for proof maturity | Expected after a state-changing action; wait until Sole reports 11 L2 blocks before the next private action. |
| Ready's own console logs `No viewing key available for account ... Ensure the account is provisioned via the backend` | Seen even on a freshly registered, freshly funded account, on the `finance()` step specifically. This is Ready's own extension reporting that *its* backend hasn't finished provisioning the account for privacy operations - not something Sole's contracts or SDK can detect or fix from the dapp side. If finance keeps failing with a generic wallet error right after this log line appears, the wallet itself isn't ready yet; retrying immediately is unlikely to help. |
