"use client";
// Sole demo flow: connect -> register -> claim -> record adapter position ->
// duplicate precondition check -> consume -> second-adapter configuration check.
//
// Live mode calls deployed contracts through the connected wallet. State-
// changing controls submit transactions; negative-path and configuration
// controls are explicitly read-only. Offline mode is illustrative local state:
// it never opens a wallet, sends a transaction, or creates a transaction hash.
import { useState, useEffect, useRef } from "react";
import {
  FileLock2, ShieldCheck, Ban, CheckCircle2, Eye, EyeOff, Landmark, Lock, Wallet, Loader2,
} from "lucide-react";
import {
  ADDRS, connectWallet, getSoleClients, provider, randomFelt, secondAdapterConfiguration, voyagerTxUrl,
} from "../lib/sole";
import { deriveClaimCommitment, hasExactRightRegistration, withTimeout } from "@sole/sdk";

const ink = "#1a160f", parch = "#e9e1ce", parch2 = "#e0d6bd", claret = "#7c1d2a", faded = "#8c8267", rule = "#cabd9d";
const steps = ["Connect", "Register", "A claims", "A records position", "B checked", "Consume", "2nd adapter checked"];
const DEMO_SESSION_KEY = "sole:live-demo-session:v1";

function freshReference() {
  const bytes = new Uint32Array(1);
  if (typeof crypto !== "undefined") crypto.getRandomValues(bytes);
  else bytes[0] = Math.floor(Math.random() * 0x1_0000_0000);
  return `RCV-4821-${Date.now().toString(36)}-${bytes[0].toString(36)}`;
}

/** Wallet/RPC errors often carry more detail in .code/.data than .message
 *  alone shows - surface all of it so a failure is diagnosable from the log
 *  instead of a bare "An error occurred (X)". */
function describeError(e) {
  const parts = [e?.message ?? String(e)];
  if (e?.code !== undefined) parts.push(`code=${e.code}`);
  if (e?.data !== undefined) {
    try { parts.push(`data=${JSON.stringify(e.data)}`); } catch { parts.push(`data=${e.data}`); }
  }
  return parts.join(" · ");
}

function initialState(mode) {
  return {
    // Stable across server and client renders (Date.now() is not - it would
    // hydration-mismatch); the real per-session reference is set client-only
    // in a useEffect below, after mount.
    mode, connected: false, account: null, reference: "RCV-4821",
    state: "UNCLAIMED", holder: null, rejected: false, consumed: false, financed: false, venue2: false,
    registered: false, registrationTxHash: null, registrationBlock: null, registrationOutcomeUnknown: false,
    proofStateBlock: null, proofStateReady: false, proofStateLabel: null,
    claimOutcomeUnknown: false, statusProbe: false,
    // A legacy Ready workaround that carries public value. It is deliberately
    // off by default and is only enabled after an explicit confirmation in
    // this tab; see enableReadyCompatibilityDeposit below.
    readyCompatibilityDeposit: false, readyCompatibilityOption: false,
    readyPrivateBalanceRequired: false,
    view: "public", log: [], busy: null, error: null,
    claimantSecret: null, fundingNote: null, claimCommitment: null,
  };
}

export default function SoleDemo() {
  const [s, setS] = useState(() => initialState("live"));
  const [registrationHashInput, setRegistrationHashInput] = useState("");
  const [registrationReferenceInput, setRegistrationReferenceInput] = useState("");
  const actionLock = useRef(false);
  const claimIntentRef = useRef(null);
  const maturityAnnouncedRef = useRef(null);
  const sessionHydratedRef = useRef(false);
  const push = (l) => setS((p) => ({ ...p, log: [...p.log, l] }));
  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  const persistRegistrationEvidence = (
    reference, registrationTxHash, registrationBlock = null, registrationOutcomeUnknown = false,
  ) => {
    try {
      window.sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({
        reference, registrationTxHash, registrationBlock, registrationOutcomeUnknown,
      }));
    } catch {
      // The in-memory state still prevents an automatic resubmission.
    }
  };
  const runExclusive = async (work) => {
    if (actionLock.current) return;
    actionLock.current = true;
    try { return await work(); } finally { actionLock.current = false; }
  };

  const cur = !s.connected
    ? 0
    : !s.registered
    ? 1
    : s.state === "UNCLAIMED"
    ? 2
    : s.state === "ACTIVE" && !s.financed
    ? 3
    : s.state === "ACTIVE" && s.financed && !s.rejected
    ? 3
    : s.rejected && !s.consumed
    ? 4
    : s.consumed && !s.venue2
    ? 5
    : 6;
  const live = s.mode === "live";

  // Keep the selected reference and its public registration evidence for this
  // browser tab. Reloading must never manufacture a new slot and then charge
  // the user to register it again. Claim secrets are deliberately not stored.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(DEMO_SESSION_KEY) ?? "null");
      if (typeof saved?.reference === "string" && saved.reference.length > 0) {
        set({
          reference: saved.reference,
          registrationTxHash: typeof saved.registrationTxHash === "string" ? saved.registrationTxHash : null,
          registrationBlock: Number.isSafeInteger(saved.registrationBlock) ? saved.registrationBlock : null,
          registrationOutcomeUnknown: saved.registrationOutcomeUnknown === true,
        });
      } else if (s.reference === "RCV-4821") {
        set({ reference: freshReference() });
      }
    } catch {
      if (s.reference === "RCV-4821") set({ reference: freshReference() });
    } finally {
      sessionHydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!sessionHydratedRef.current || s.mode !== "live" || s.reference === "RCV-4821") return;
    try {
      window.sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({
        reference: s.reference,
        registrationTxHash: s.registrationTxHash,
        registrationBlock: s.registrationBlock,
        registrationOutcomeUnknown: s.registrationOutcomeUnknown,
      }));
    } catch {
      // Session persistence is a convenience, never a reason to block a
      // connected wallet. A user can still explicitly register a new right.
    }
  }, [s.mode, s.reference, s.registrationTxHash, s.registrationBlock, s.registrationOutcomeUnknown]);

  // Preserve evidence already visible in an older in-memory version of this
  // screen during a hot reload. This is public data only, and lets the next
  // connect verify the old registration instead of tempting the user to pay
  // for that exact reference again.
  useEffect(() => {
    if (!live || !s.registered || s.registrationTxHash) return;
    const line = s.log.find((entry) => entry.startsWith(`register(${s.reference}): submitted `));
    const txHash = line?.match(/submitted (0x[0-9a-fA-F]+)/)?.[1];
    if (txHash) set({ registrationTxHash: txHash });
  }, [live, s.registered, s.registrationTxHash, s.reference, s.log]);

  // A privacy invoke proves against an anchored state snapshot. Each
  // transition that the next invoke reads must therefore be old enough to be
  // included in Ready's proof base. Ready does not expose that base block, so
  // wait conservatively until the L2 head is 11 blocks ahead.
  useEffect(() => {
    if (!live || s.proofStateReady || s.proofStateBlock == null) return;
    let cancelled = false;
    const checkMaturity = async () => {
      try {
        const head = await provider.getBlockNumber();
        if (!cancelled && head - 10 > s.proofStateBlock) {
          set({ proofStateReady: true });
          const key = `${s.reference}:${s.proofStateLabel}:${s.proofStateBlock}`;
          if (maturityAnnouncedRef.current !== key) {
            maturityAnnouncedRef.current = key;
            push(`${s.proofStateLabel} is now mature for the next private action (11+ L2 blocks confirmed)`);
          }
        }
      } catch {
        // A failed read must keep the next paid action disabled, not turn into
        // an optimistic retry.
      }
    };
    void checkMaturity();
    const interval = window.setInterval(checkMaturity, 8_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [live, s.proofStateReady, s.proofStateBlock, s.proofStateLabel, s.reference]);

  /** Live-mode helper for submissions that do NOT confirm themselves -
   *  currently only register(), a plain account.execute() with no internal
   *  wait. Submits, logs the tx immediately, then waits for the receipt
   *  (bounded - a hung RPC fetch shouldn't spin the UI forever) and logs the
   *  real outcome, including the revert reason when the chain refuses it.
   *  Reverts are logged as a result, not thrown as a UI error: a refused
   *  transaction is the demo working, not the demo breaking. */
  async function runTx(label, submit) {
    let txHash;
    try {
      txHash = await submit();
    } catch (e) {
      push(`${label}: submission failed - ${describeError(e)}`);
      throw e;
    }
    push(`${label}: submitted ${txHash} (pending) -> ${voyagerTxUrl(txHash)}`);
    const receipt = await withTimeout(
      provider.waitForTransaction(txHash), 90_000, `${label}: still not confirmed after ~90s (tx: ${txHash})`,
    );
    const status = receipt.execution_status ?? receipt.finality_status;
    if (status === "REVERTED") {
      const reason = receipt.revert_reason ?? "(no reason reported)";
      push(`${label}: reverted - ${reason}`);
      return { txHash, reverted: true, reason };
    }
    const blockNumber = receipt.block_number == null ? undefined : Number(receipt.block_number);
    push(`${label}: confirmed (${status})`);
    return { txHash, reverted: false, blockNumber, receipt };
  }

  // `UNCLAIMED` is a storage default, so the only safe way to revive a
  // previously paid registration is its exact non-reverted event. This is a
  // read-only check; it cannot ask Ready to sign or spend anything.
  async function verifyRegistrationReceipt(venue1, txHash, reference = s.reference) {
    const receipt = await withTimeout(
      provider.getTransactionReceipt(txHash), 10_000,
      "could not verify the saved registration receipt",
    );
    const status = receipt.execution_status ?? receipt.finality_status;
    const matches = status !== "REVERTED"
      && hasExactRightRegistration(receipt, ADDRS.registry, venue1.slotKeyFor(reference));
    return {
      matches,
      status,
      blockNumber: receipt.block_number == null ? null : Number(receipt.block_number),
    };
  }

  // The SDK has already waited for a successful private transaction. Read its
  // receipt once (not another wait loop) to anchor the next proof-maturity
  // gate. If that read is briefly unavailable, using the current head is a
  // conservative fallback: it only makes the user wait longer.
  async function privateTxBlock(txHash) {
    try {
      const receipt = await withTimeout(
        provider.getTransactionReceipt(txHash), 10_000, `could not read private tx receipt (${txHash})`,
      );
      if (receipt.block_number != null) return Number(receipt.block_number);
    } catch {
      // Fall through to the head-based conservative boundary below.
    }
    try {
      const head = await provider.getBlockNumber();
      push(`could not read ${txHash}'s receipt block; waiting 11 blocks from current head as a safe fallback`);
      return head;
    } catch {
      return null;
    }
  }

  /** Live-mode helper for claim/finance/settleAndRepay - these already wait
   *  for confirmation and verify the invoke actually landed inside the SDK's
   *  own privacyInvoke() (which throws on revert or a wallet-dropped
   *  invoke). Calling provider.waitForTransaction() again here on an
   *  already-confirmed hash was pure redundant risk: a second poll of the
   *  same public RPC node for no benefit, and the exact thing that hung
   *  claimA's own claim step earlier. A thrown error carrying a
   *  revertReason is a chain refusal and is logged as a result, not
   *  rethrown. Anything else (wallet failure, dropped invoke, timeout)
   *  propagates to the caller's own catch. */
  async function runClientTx(label, submit) {
    try {
      const txHash = await submit();
      const blockNumber = await privateTxBlock(txHash);
      push(`${label}: confirmed ${txHash} -> ${voyagerTxUrl(txHash)}`);
      return { txHash, reverted: false, blockNumber };
    } catch (e) {
      if (e?.revertReason !== undefined) {
        push(`${label}: reverted - ${e.revertReason}`);
        return { txHash: e.txHash, reverted: true, reason: e.revertReason };
      }
      const txHint = e?.txHash ? ` -> ${voyagerTxUrl(e.txHash)}` : "";
      const outcome = e?.noSubmission
        ? "Ready rejected the action before signing or submission"
        : e?.txHash
        ? "result not yet conclusive"
        : e?.outcomeUnknown
          ? "Ready did not return a hash before the safe deadline; outcome remains unknown"
          : "wallet did not return a transaction hash";
      push(`${label}: ${outcome} - ${describeError(e)}${txHint}`);
      throw e;
    }
  }

  const markProofBoundary = (label, blockNumber) => {
    set({ proofStateBlock: blockNumber, proofStateReady: false, proofStateLabel: label });
    if (blockNumber == null) {
      push(`${label} is confirmed, but Sole could not determine its block. Recheck on-chain status before the next private action.`);
    } else {
      push(`${label} confirmed in block ${blockNumber}; waiting 11 L2 blocks before the next private action`);
    }
  };

  /** Wallet-side preparation can reject a standalone private action before
   * Ready has signed, relayed, or submitted anything. Keep that distinct from
   * an ambiguous timeout: the user may safely change the local compatibility
   * setting, but Sole must never infer or send a paid retry. */
  const recordNoSubmission = (label, error) => {
    // Code 114 is a generic Wallet API payload rejection, not proof that a
    // deposit will solve it. The SDK exposes the legacy shape only as an
    // optional, user-reviewed diagnostic/workaround after a no-submit check.
    const mayUseCompanionDeposit = error?.mayUseCompanionDeposit === true;
    const requiresPrivateBalance = error?.requiresPrivateBalance === true;
    set({
      busy: null,
      error: describeError(error),
      readyCompatibilityOption: mayUseCompanionDeposit || s.readyCompatibilityOption,
      readyPrivateBalanceRequired: requiresPrivateBalance || s.readyPrivateBalanceRequired,
    });
    push(`${label}: Ready rejected this before signing or submission. No transaction was sent.`);
  };

  const enableReadyCompatibilityDeposit = () => {
    if (!live || s.busy || s.readyCompatibilityDeposit) return;
    const approved = window.confirm(
      "Use Ready's legacy deposit-plus-invoke shape for this tab? This is a deliberate workaround, not a Sole requirement, and it may not fix a generic payload rejection. At the currently observed pool fee, Ready may ask you to shield about 12 STRK alongside each private Sole action. The exact amount is read live; it is not sponsored L2 gas or a one-time registration charge. You will still approve every action in Ready.",
    );
    if (!approved) return;
    set({
      readyCompatibilityDeposit: true,
      readyCompatibilityOption: false,
      readyPrivateBalanceRequired: false,
      error: null,
    });
    push("Ready compatibility deposit enabled for this tab. No transaction was sent; each private action will still require an explicit Ready approval.");
  };

  const disableReadyCompatibilityDeposit = () => {
    if (!live || s.busy || !s.readyCompatibilityDeposit) return;
    set({ readyCompatibilityDeposit: false, readyCompatibilityOption: false, error: null });
    push("Ready compatibility deposit disabled for this tab. No transaction was sent.");
  };

  const adoptRecoveredClaim = (intent, txHash, blockNumber) => {
    intent.final = true;
    set({
      state: "ACTIVE", holder: "A", rejected: false, consumed: false, financed: false,
      claimantSecret: intent.claimantSecret, fundingNote: intent.fundingNote,
      claimCommitment: intent.claimCommitment, claimOutcomeUnknown: false, busy: null, error: null,
      registered: true, registrationOutcomeUnknown: false,
      readyCompatibilityOption: false, readyPrivateBalanceRequired: false,
      proofStateBlock: blockNumber, proofStateReady: false, proofStateLabel: "claim",
    });
    push(`Bank A: chain confirms the expected claim${txHash ? ` ${txHash}` : ""}; Ready's response was stale. No retry was sent.`);
    if (blockNumber == null) {
      push("Claim is held safely, but its proof-maturity block is unknown. Recheck on-chain status before financing.");
    } else {
      push(`claim confirmed in block ${blockNumber}; wait 11 L2 blocks before financing or attempting Bank B`);
    }
  };

  /** Reconcile an ambiguous wallet response using public registry reads. The
   * result is accepted only if it contains the exact commitment generated
   * before the wallet request; a different ACTIVE claim remains unusable. */
  const reconcilePendingClaim = async (venue1, intent) => {
    if (intent.final) return "final";
    const record = await venue1.reconcileClaim(intent.reference, intent.claimCommitment);
    // A slower free read must never overwrite a later conclusive ACTIVE
    // recovery with an earlier UNCLAIMED observation.
    if (intent.final) return "final";
    if (record.matchesExpectedClaim) {
      const blockNumber = intent.txHash ? await privateTxBlock(intent.txHash) : await privateTxBlockFromHead();
      adoptRecoveredClaim(intent, intent.txHash, blockNumber);
      return "matched";
    }
    if (record.state === "UNCLAIMED") {
      set({
        busy: null, claimOutcomeUnknown: true,
        error: "Ready did not return a conclusive claim result. The registry currently reads UNCLAIMED; Sole did not retry. Recheck the on-chain status before any new claim.",
      });
      push("Bank A: claim result remains unconfirmed; state_of() still reads UNCLAIMED. No retry sent.");
      return "unclaimed";
    }
    intent.final = true;
    set({
      state: record.state, holder: null, claimantSecret: null, fundingNote: null,
      claimCommitment: record.claimCommitment, consumed: record.state === "CONSUMED", financed: false,
      busy: null, claimOutcomeUnknown: false, registered: true, registrationOutcomeUnknown: false,
      proofStateBlock: null, proofStateReady: false, proofStateLabel: null,
      error: "The right changed on-chain, but its commitment does not match this tab's claim intent. Sole will not submit or finance anything for it.",
    });
    push(`Bank A: on-chain state is ${record.state}, but the commitment does not match this claim intent. Stopped safely.`);
    return "mismatch";
  };

  async function privateTxBlockFromHead() {
    try {
      const head = await provider.getBlockNumber();
      push("no transaction hash was returned; waiting 11 blocks from the current head before a dependent private action");
      return head;
    } catch {
      return null;
    }
  }

  const holdsLocalClaim = s.state === "ACTIVE" && s.holder === "A";

  const toggleMode = () => {
    if (s.busy || s.claimOutcomeUnknown || holdsLocalClaim || actionLock.current) return;
    claimIntentRef.current = null;
    maturityAnnouncedRef.current = null;
    // Mode switching is local-only. Keep the same right and its public
    // registration evidence so returning to live mode never manufactures a
    // fresh paid-registration candidate.
    setS({
      ...initialState(live ? "demo" : "live"),
      reference: s.reference,
      registrationTxHash: s.registrationTxHash,
      registrationBlock: s.registrationBlock,
      registrationOutcomeUnknown: s.registrationOutcomeUnknown,
      readyCompatibilityDeposit: s.readyCompatibilityDeposit,
      readyCompatibilityOption: s.readyCompatibilityOption,
      readyPrivateBalanceRequired: s.readyPrivateBalanceRequired,
    });
  };

  const connect = () => runExclusive(async () => {
    if (!live) {
      set({
        connected: true,
        state: "UNCLAIMED",
        consumed: false,
        rejected: false,
        financed: false,
        venue2: false,
        registered: false,
        registrationTxHash: null,
        proofStateReady: true,
      });
      push("Illustrative offline setup -> UNCLAIMED. No wallet request, hash, or chain action.");
      return;
    }
    set({ busy: "connect", error: null });
    let connectedAccount = null;
    try {
      const account = await connectWallet();
      connectedAccount = account;
      // Connecting a wallet must be free. The registry's register_right call
      // is intentionally a separate, explicit, paid choice below.
      const base = { connected: true, account, busy: "connect" };
      set(base);
      const { venue1 } = await getSoleClients();
      const record = await withTimeout(
        venue1.claimRecord(s.reference), 12_000, "could not read this right's on-chain status",
      );

      // ACTIVE/CONSUMED can only follow a successful registration. No local
      // secret is reconstructed here, because the chain never has it.
      if (record.state !== "UNCLAIMED") {
        set({
          ...base, busy: null, registered: true, registrationOutcomeUnknown: false,
          state: record.state, consumed: record.state === "CONSUMED",
          holder: null, claimantSecret: null, fundingNote: null, claimCommitment: record.claimCommitment,
        });
        push(`wallet connected; on-chain state is ${record.state}. No transaction was submitted.`);
        return;
      }

      if (s.registrationTxHash) {
        try {
          const verification = await verifyRegistrationReceipt(venue1, s.registrationTxHash);
          if (verification.matches) {
            const blockNumber = verification.blockNumber ?? s.registrationBlock;
            set({
              ...base, busy: null, registered: true, registrationOutcomeUnknown: false, registrationBlock: blockNumber,
              proofStateBlock: blockNumber, proofStateReady: false, proofStateLabel: "registration",
            });
            push("wallet connected; verified this right's earlier registration. No transaction was submitted.");
            return;
          }
          push("the saved registration receipt does not yet prove this right's registration. No transaction was submitted.");
        } catch {
          push("could not verify the saved registration yet; no transaction was submitted");
        }
      }

      // `UNCLAIMED` is the storage default for an unknown slot. Do not carry
      // a legacy in-memory `registered` flag forward without an exact receipt:
      // it could otherwise enable a paid claim that only reverts
      // RIGHT_NOT_REGISTERED. A completed registration always records its
      // public hash before its confirmation wait begins.
      set({ ...base, busy: null, registered: false });
      push("wallet connected; no on-chain transaction was submitted");
    } catch (e) {
      if (connectedAccount) {
        // A public RPC read failing is not a failed wallet connection. Keep
        // the account connected and, crucially, do not "fix" the read error
        // by sending a registration transaction.
        set({
          connected: true, account: connectedAccount, busy: null,
          error: `Wallet connected, but Sole could not verify this right: ${describeError(e)}. No transaction was submitted.`,
        });
        push("wallet connected, but the on-chain status check failed. No transaction was submitted.");
      } else {
        set({ busy: null, error: describeError(e) });
      }
    }
  });

  const registerRight = () => {
    if (!s.connected || s.registered || s.registrationOutcomeUnknown || s.busy || actionLock.current) return;
    if (live && !window.confirm(
      `Register ${s.reference} as a new Sole demo right? This is a paid Starknet transaction. ` +
      "It is unrelated to Ready's one-time 'Enable private tokens' setup.",
    )) return;
    return runExclusive(async () => {
      if (!live) {
        set({ registered: true, proofStateReady: true });
        push("Illustrative offline registration -> UNCLAIMED. No wallet request, hash, or chain action.");
        return;
      }
      set({ busy: "register", error: null });
      let walletSubmissionStarted = false;
      let submittedTxHash = null;
      try {
        const { venue1 } = await getSoleClients();
        const { txHash, reverted, reason, blockNumber, receipt } = await runTx(
          `register(${s.reference})`,
          async () => {
            walletSubmissionStarted = true;
            const txHash = await venue1.register(s.account, s.reference);
            submittedTxHash = txHash;
            // Save the public hash before waiting for confirmation. If the
            // RPC wait times out or the tab reloads, this exact transaction
            // remains the only candidate to verify; a second registration is
            // never sent automatically.
            persistRegistrationEvidence(s.reference, txHash);
            set({ registrationTxHash: txHash, registrationOutcomeUnknown: false });
            return txHash;
          },
        );
        if (reverted) { set({ busy: null, registrationOutcomeUnknown: false, error: reason }); return; }
        if (!hasExactRightRegistration(receipt, ADDRS.registry, venue1.slotKeyFor(s.reference))) {
          set({
            busy: null,
            error: "The transaction confirmed, but its receipt does not prove RightRegistered for this reference. Sole will not retry or offer another paid registration; use the free receipt check.",
          });
          push("registration receipt did not prove the expected event. No retry was sent.");
          return;
        }
        persistRegistrationEvidence(s.reference, txHash, blockNumber ?? null);
        set({
          busy: null, registered: true, registrationTxHash: txHash, registrationBlock: blockNumber ?? null,
          registrationOutcomeUnknown: false,
          proofStateBlock: blockNumber ?? null,
          proofStateReady: false, proofStateLabel: "registration",
        });
        push("state_of() reads UNCLAIMED; waiting 11 L2 blocks before private claim is enabled");
      } catch (e) {
        if (walletSubmissionStarted && !submittedTxHash) {
          // The wallet bridge did not return a hash. It might still have
          // submitted, so preserve that uncertainty rather than making a
          // second paid registration look like the obvious next click.
          persistRegistrationEvidence(s.reference, null, null, true);
          set({
            busy: null, registrationOutcomeUnknown: true,
            error: `Ready did not return a registration hash: ${describeError(e)}. Sole will not retry or offer another paid registration for this reference. Find the hash in Ready and verify it below (no gas).`,
          });
          push("registration outcome is unknown because Ready returned no hash. No retry was sent.");
        } else {
          set({ busy: null, error: describeError(e) });
        }
      }
    });
  };

  const claimA = () => runExclusive(async () => {
    if (!live) {
      set({ state: "ACTIVE", holder: "A", rejected: false, proofStateReady: true });
      push("Illustrative offline claim -> ACTIVE. No wallet request, hash, asset transfer, or chain action.");
      return;
    }
    set({ busy: "claimA", error: null });
    try {
      const { venue1 } = await getSoleClients();
      const claimantSecret = randomFelt();
      const fundingNote = randomFelt();

      const claimCommitment = deriveClaimCommitment(
        venue1.slotKeyFor(s.reference), claimantSecret, fundingNote,
      );
      const intent = { reference: s.reference, claimantSecret, fundingNote, claimCommitment, txHash: null };
      // Retain the exact preimage pair until a read-only reconciliation has
      // proved whether this request landed. Never put it in the log.
      claimIntentRef.current = intent;
      const claimResult = await runClientTx("Bank A: claim", async () => {
        const r = await venue1.claim(
          s.account, s.reference, claimantSecret, fundingNote,
          { useCompanionDeposit: s.readyCompatibilityDeposit },
        );
        intent.txHash = r.tx;
        return r.tx;
      });
      // A concurrent read-only recovery may already have made the outcome
      // conclusive while Ready's bridge was still resolving. Do not replay
      // its state transition or log a second success when that late response
      // finally arrives.
      if (intent.final) return;
      if (claimResult.reverted) { set({ busy: null, error: claimResult.reason }); return; }
      adoptRecoveredClaim(intent, claimResult.txHash, claimResult.blockNumber);
    } catch (e) {
      const intent = claimIntentRef.current;
      if (e?.noSubmission) {
        // This was rejected by Ready before it could leave the wallet. The
        // generated preimages were never used, so do not retain a false
        // "ambiguous claim" lock or make the user reconcile a non-existent
        // transaction.
        if (claimIntentRef.current === intent) claimIntentRef.current = null;
        recordNoSubmission("Bank A: claim", e);
        return;
      }
      if (e?.txHash && intent) intent.txHash = e.txHash;
      if (e?.outcomeUnknown && e?.lateSubmission && intent && !intent.lateWatchAttached) {
        // Ready cannot cancel the original bridge request. Preserve a late
        // hash for a later free reconciliation, but never let it trigger a
        // second wallet action or race a conclusive recovered claim.
        intent.lateWatchAttached = true;
        intent.lateSubmission = e.lateSubmission;
        void e.lateSubmission.then(
          ({ transaction_hash: txHash }) => {
            if (claimIntentRef.current !== intent || intent.final) return;
            intent.txHash = txHash;
            push(`Bank A: Ready later returned ${txHash}; recheck the chain (no gas). No retry was sent.`);
          },
          () => {},
        );
      }
      try {
        const { venue1 } = await getSoleClients();
        if (!intent || intent.reference !== s.reference) throw e;
        await reconcilePendingClaim(venue1, intent);
      } catch (reconcileError) {
        set({
          busy: null, claimOutcomeUnknown: true,
          error: `${describeError(e)}. Sole could not yet read the registry to reconcile this request: ${describeError(reconcileError)}. No retry was sent.`,
        });
      }
    }
  });

  // Claim and finance are deliberately separate wallet actions. Finance's
  // proof reads the claim's ACTIVE state, so it is enabled only after the
  // claim has both confirmed and matured in the proof base.
  const financeA = () => runExclusive(async () => {
    if (!live) {
      set({ financed: true, proofStateReady: true });
      push("Illustrative offline adapter position record. No wallet request, hash, asset transfer, or chain action.");
      return;
    }
    set({ busy: "financeA", error: null });
    try {
      const { venue1 } = await getSoleClients();
      const amountCommitment = randomFelt();
      const result = await runClientTx(
        "Bank A: finance",
        () => venue1.finance(
          s.account, s.reference, s.claimCommitment, amountCommitment,
          { useCompanionDeposit: s.readyCompatibilityDeposit },
        ),
      );
      if (result.reverted) { set({ busy: null, error: result.reason }); return; }
      set({ busy: null, financed: true, readyCompatibilityOption: false, readyPrivateBalanceRequired: false });
      markProofBoundary("finance", result.blockNumber);
    } catch (e) {
      if (e?.noSubmission) {
        recordNoSubmission("Bank A: finance", e);
        return;
      }
      set({
        busy: null,
        error: `${describeError(e)}. Finance was not retried automatically; check its on-chain result before retrying.`,
      });
    }
  });

  /** Temporary diagnostic: runs finance()'s wallet-side pre-flight
   *  simulation (strk20PrepareInvoke, simulate=true) with no submission, no
   *  confirmation, no gas, and no deposit moved - to see the wallet's actual
   *  detailed error instead of the generic PaymasterV2Error code a live
   *  attempt shows. Safe to click any number of times. */
  const dryRunFinance = () => runExclusive(async () => {
    set({ busy: "dryrun", error: null });
    try {
      const { venue1 } = await getSoleClients();
      const amountCommitment = randomFelt();
      const result = await venue1.dryRunFinance(
        s.account, s.reference, s.claimCommitment, amountCommitment,
        { useCompanionDeposit: s.readyCompatibilityDeposit },
      );
      push(`Dry-run finance() result: ${JSON.stringify(result)}`);
      set({ busy: null });
    } catch (e) {
      if (e?.noSubmission) {
        recordNoSubmission("Dry-run finance", e);
        return;
      }
      push(`Dry-run finance() error: ${describeError(e)}`);
      set({ busy: null, error: describeError(e) });
    }
  });

  /** Same zero-cost pre-flight simulation as dryRunFinance, for claim() -
   *  no submission, no gas, no deposit moved. Safe to click any number of
   *  times. Uses throwaway secrets since nothing here is actually claimed. */
  const dryRunClaim = () => runExclusive(async () => {
    set({ busy: "dryrunclaim", error: null });
    try {
      const { venue1 } = await getSoleClients();
      const result = await venue1.dryRunClaim(
        s.account, s.reference, randomFelt(), randomFelt(),
        { useCompanionDeposit: s.readyCompatibilityDeposit },
      );
      push(`Dry-run claim() result: ${JSON.stringify(result)}`);
      set({ busy: null });
    } catch (e) {
      if (e?.noSubmission) {
        recordNoSubmission("Dry-run claim", e);
        return;
      }
      push(`Dry-run claim() error: ${describeError(e)}`);
      set({ busy: null, error: describeError(e) });
    }
  });

  const adoptVerifiedRegistration = (reference, txHash, blockNumber, message) => {
    persistRegistrationEvidence(reference, txHash, blockNumber);
    set({
      reference, busy: null, state: "UNCLAIMED", holder: null, rejected: false, consumed: false, financed: false,
      claimantSecret: null, fundingNote: null, claimCommitment: null, claimOutcomeUnknown: false,
      registered: true, registrationTxHash: txHash, registrationBlock: blockNumber, registrationOutcomeUnknown: false,
      proofStateBlock: blockNumber, proofStateReady: false, proofStateLabel: "registration", error: null,
    });
    push(`${message}. No transaction was submitted.`);
  };

  // Recovery for a registration that predates this fix or whose confirmation
  // wait timed out. A receipt contains the slot hash, not the human-readable
  // reference, so a tab that generated a new reference must restore the
  // original reference alongside the transaction hash before verification.
  const verifyEarlierRegistration = () => runExclusive(async () => {
    if (!live || !s.connected || s.busy) return;
    const reference = (registrationReferenceInput.trim() || s.reference).trim();
    const restoringDifferentReference = reference !== s.reference;
    const txHash = (
      registrationHashInput.trim()
      || (!restoringDifferentReference ? s.registrationTxHash : "")
      || ""
    ).trim();
    if (!/^RCV-4821-[A-Za-z0-9-]{1,120}$/.test(reference)) {
      set({ error: "Paste the original RCV-4821-… reference from the earlier registration log. This check is free." });
      return;
    }
    if (!/^0x[0-9a-fA-F]{1,66}$/.test(txHash)) {
      set({ error: "Paste the transaction hash too when restoring a different reference. This check is free." });
      return;
    }

    // Do not overwrite the tracked right with unverified pasted data. The
    // reference and hash become durable only after their exact event matches.
    set({ busy: "verifyRegistration", error: null });
    try {
      const { venue1 } = await getSoleClients();
      const verification = await verifyRegistrationReceipt(venue1, txHash, reference);
      if (!verification.matches) {
        set({
          busy: null,
          error: "That receipt does not confirm RightRegistered for the selected reference. Check both the original RCV-4821-… reference and transaction hash; Sole did not send another registration.",
        });
        push("saved registration receipt does not yet prove this right. No transaction was submitted.");
        return;
      }

      claimIntentRef.current = null;
      maturityAnnouncedRef.current = null;
      const record = await withTimeout(
        venue1.claimRecord(reference), 12_000, "could not read this right's on-chain status",
      );
      if (record.state === "UNCLAIMED") {
        adoptVerifiedRegistration(reference, txHash, verification.blockNumber, "verified the earlier registration");
        return;
      }

      persistRegistrationEvidence(reference, txHash, verification.blockNumber);
      set({
        reference, busy: null, registered: true, registrationTxHash: txHash, registrationBlock: verification.blockNumber,
        registrationOutcomeUnknown: false,
        state: record.state, consumed: record.state === "CONSUMED", holder: null, financed: false,
        claimantSecret: null, fundingNote: null, claimCommitment: record.claimCommitment,
        proofStateBlock: null, proofStateReady: false, proofStateLabel: null, error: null,
      });
      push(`verified the earlier registration; this right is already ${record.state}. No transaction was submitted.`);
    } catch (e) {
      set({
        busy: null,
        error: `Could not yet verify the saved registration: ${describeError(e)}. No transaction was submitted; recheck later.`,
      });
      push("could not verify the saved registration yet. No transaction was submitted.");
    }
  });

  // Ready can submit a private transaction yet leave its bridge Promise
  // pending forever. This read-only escape hatch intentionally bypasses the
  // wallet-action single-flight lock so a *currently stuck* claim can be
  // reconciled without reloading the tab (which would lose its local secret)
  // or submitting anything else.
  const checkPendingClaimStatus = async () => {
    if (!live || !s.connected || s.busy !== "claimA") return;
    const intent = claimIntentRef.current;
    if (!intent || intent.reference !== s.reference || intent.reconciling || intent.final) return;
    intent.reconciling = true;
    set({ statusProbe: true, error: null });
    try {
      const { venue1 } = await getSoleClients();
      const outcome = await reconcilePendingClaim(venue1, intent);
      // This public read has now made the request safe to reason about. The
      // original Ready bridge can remain hung forever, so leaving its generic
      // click lock held would strand a recovered claim (or prevent later free
      // status checks). Paid controls remain guarded by state/maturity and by
      // claimOutcomeUnknown when the result is still unresolved.
      if (outcome !== undefined) actionLock.current = false;
    } catch (e) {
      // Keep the claim intent and existing wallet lock intact. A later free
      // probe can still recover it if the RPC was temporarily unavailable.
      set({ error: `Could not reconcile the pending claim yet: ${describeError(e)}. No transaction was submitted.` });
    } finally {
      intent.reconciling = false;
      set({ statusProbe: false });
    }
  };

  // A read-only escape hatch for an ambiguous sponsored request, including a
  // Ready timeout that actually landed after the extension stopped replying.
  // It never sends, signs, or retries a transaction.
  const checkOnChainStatus = () => runExclusive(async () => {
    if (!live || !s.connected) return;
    set({ busy: "status", error: null });
    try {
      const { venue1 } = await getSoleClients();
      const intent = claimIntentRef.current;
      if (intent?.reference === s.reference) {
        await reconcilePendingClaim(venue1, intent);
        return;
      }

      const record = await withTimeout(
        venue1.claimRecord(s.reference), 12_000, "could not read this right's on-chain status",
      );
      if (record.state === "UNCLAIMED") {
        if (s.registrationTxHash) {
          try {
            const verification = await verifyRegistrationReceipt(venue1, s.registrationTxHash);
            if (verification.matches) {
              adoptVerifiedRegistration(
                s.reference, s.registrationTxHash, verification.blockNumber,
                "on-chain check verified the earlier registration",
              );
              return;
            }
            set({
              busy: null,
              error: "The saved registration transaction has not confirmed this right yet. Sole will not submit another registration; recheck it without gas.",
            });
            push("on-chain check: saved registration is not yet verified. No transaction was submitted.");
            return;
          } catch (e) {
            set({
              busy: null,
              error: `Could not yet verify the saved registration: ${describeError(e)}. No transaction was submitted; recheck later.`,
            });
            push("on-chain check: saved registration receipt is still unavailable. No transaction was submitted.");
            return;
          }
        }
        if (s.registrationOutcomeUnknown) {
          set({
            busy: null,
            error: "Ready did not return a registration hash, so UNCLAIMED alone cannot settle whether it landed. Sole will not send another registration; find the hash in Ready and verify it without gas.",
          });
          push("on-chain check: registration outcome remains unknown without its transaction hash. No transaction was submitted.");
          return;
        }
        set({ busy: null, state: "UNCLAIMED", consumed: false, holder: null, error: null });
        push("on-chain check: state_of() reads UNCLAIMED");
        return;
      }

      const blockNumber = await privateTxBlockFromHead();
      set({
        busy: null, state: record.state, consumed: record.state === "CONSUMED", financed: false,
        holder: null, claimantSecret: null, fundingNote: null, claimCommitment: record.claimCommitment,
        registered: true, registrationOutcomeUnknown: false,
        proofStateBlock: blockNumber, proofStateReady: false,
        proofStateLabel: record.state === "ACTIVE" ? "claim" : "settlement", claimOutcomeUnknown: false,
        error: null,
      });
      push(`on-chain check: state_of() reads ${record.state}`);
      if (record.state === "ACTIVE") {
        push("The right is ACTIVE, but this tab has no matching local claim secret. Finance and settlement remain disabled.");
      }
    } catch (e) {
      set({ busy: null, error: `Could not read on-chain status: ${describeError(e)}` });
    }
  });

  const claimB = () => runExclusive(async () => {
    if (!live) {
      set({ rejected: true });
      push("Illustrative offline duplicate check -> RIGHT_ALREADY_ACTIVE. No wallet request, hash, or chain action.");
      return;
    }
    set({ busy: "claimB", error: null });
    try {
      const { venue1 } = await getSoleClients();
      // Ready's paymaster correctly refuses to sponsor a call it can already
      // prove will revert. Sending that known-bad private action only opens a
      // failing wallet sheet (and can still involve a pool fee), so verify the
      // public precondition directly instead. A fresh claim is only valid
      // from UNCLAIMED; ACTIVE proves the registry will reject Bank B with
      // RIGHT_ALREADY_ACTIVE. No private data or database is consulted.
      const record = await withTimeout(
        venue1.claimRecord(s.reference), 12_000,
        "could not read the registry to verify Bank B's refusal",
      );
      if (record.state !== "ACTIVE") {
        set({ busy: null, error: `Could not verify duplicate refusal: registry reads ${record.state}, not ACTIVE.` });
        push(`Bank B: no wallet request sent; registry reads ${record.state}, so RIGHT_ALREADY_ACTIVE was not asserted.`);
        return;
      }
      set({ busy: null, rejected: true, error: null });
      push("Bank B: registry confirms ACTIVE. A fresh claim would revert RIGHT_ALREADY_ACTIVE. No Ready request or transaction was sent.");
    } catch (e) {
      set({ busy: null, error: `${describeError(e)}. No wallet request or transaction was sent.` });
    }
  });

  const settle = () => runExclusive(async () => {
    if (!live) {
      set({ state: "CONSUMED", consumed: true, rejected: false, proofStateReady: true });
      push("Illustrative offline position clear + consume -> CONSUMED. No wallet request, hash, asset transfer, or chain action.");
      return;
    }
    set({ busy: "settle", error: null });
    try {
      const { venue1 } = await getSoleClients();
      const { reverted, reason, blockNumber } = await runClientTx(
        "Bank A: settle_and_repay",
        () => venue1.settleAndRepay(
          s.account, s.reference, s.claimantSecret, s.claimCommitment,
          { useCompanionDeposit: s.readyCompatibilityDeposit },
        ),
      );
      if (reverted) set({ busy: null, error: reason });
      else {
        set({
          busy: null, state: "CONSUMED", consumed: true, rejected: false,
          readyCompatibilityOption: false, readyPrivateBalanceRequired: false,
        });
        markProofBoundary("settlement", blockNumber);
      }
    } catch (e) {
      if (e?.noSubmission) {
        recordNoSubmission("Bank A: settle_and_repay", e);
        return;
      }
      set({ busy: null, error: describeError(e) });
    }
  });

  const venue2 = () => runExclusive(async () => {
    if (!live) {
      set({ venue2: true });
      push("Illustrative offline second-adapter check -> AUTH_RIGHT_NOT_ACTIVE. No wallet request, hash, or chain action.");
      return;
    }
    set({ busy: "venue2", error: null });
    try {
      const { venue1 } = await getSoleClients();
      // A cross-venue conclusion requires a distinct adapter that shares the
      // registry and reports a venue address of its own. This deployment does
      // not currently meet all of those conditions, so do not turn a shared
      // state read into a claimed independent-venue result.
      const [record, config] = await Promise.all([
        withTimeout(
          venue1.claimRecord(s.reference), 12_000,
          "could not read the registry to check the second adapter",
        ),
        withTimeout(
          secondAdapterConfiguration(), 12_000,
          "could not read the second adapter's configuration",
        ),
      ]);
      if (!config.isDistinctAdapter || !config.sharesRegistry || !config.reportsOwnVenue) {
        set({
          busy: null,
          error: "The deployed second adapter does not currently prove an independent venue configuration. Sole will not present this as a cross-venue result or submit a transaction.",
        });
        push("Second adapter: configuration is not a verified independent venue. No wallet request or transaction was sent.");
        return;
      }
      if (record.state !== "CONSUMED") {
        set({ busy: null, error: `Could not verify shared-adapter refusal: registry reads ${record.state}, not CONSUMED.` });
        push(`Second adapter: no wallet request sent; registry reads ${record.state}, so AUTH_RIGHT_NOT_ACTIVE was not asserted.`);
        return;
      }
      set({ busy: null, venue2: true, error: null });
      push("Second adapter: shared registry confirms CONSUMED. Its finance gate would revert AUTH_RIGHT_NOT_ACTIVE. No Ready request or transaction was sent.");
    } catch (e) {
      set({ busy: null, error: `${describeError(e)}. No wallet request or transaction was sent.` });
    }
  });

  const startDifferentRight = () => {
    if (s.busy || s.claimOutcomeUnknown || holdsLocalClaim || actionLock.current) return;
    if (live && !window.confirm(
      "Start a different local receivable reference? This sends no transaction. " +
      "The currently registered right remains on-chain, but this tab will stop tracking it.",
    )) return;
    claimIntentRef.current = null;
    maturityAnnouncedRef.current = null;
    setS({
      ...initialState(s.mode), reference: freshReference(),
      readyCompatibilityDeposit: s.readyCompatibilityDeposit,
      readyCompatibilityOption: s.readyCompatibilityOption,
      readyPrivateBalanceRequired: s.readyPrivateBalanceRequired,
    });
  };

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "44px 26px 60px", fontFamily: "'Spectral',Georgia,serif", color: ink }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: 14, color: claret, fontStyle: "italic", marginBottom: 14 }}>Demo · one receivable, two banks</div>
        <button onClick={toggleMode} disabled={!!s.busy || s.claimOutcomeUnknown || holdsLocalClaim} style={{
          fontSize: 12.5, border: `1px solid ${rule}`, background: "transparent", color: faded,
          padding: "5px 10px", borderRadius: 2, cursor: s.busy || s.claimOutcomeUnknown || holdsLocalClaim ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          mode: <strong style={{ color: live ? claret : ink }}>{live ? "live (mainnet)" : "illustrative (offline)"}</strong> — switch
        </button>
      </div>
      <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-.015em", margin: 0 }}>Exercise the execution gate. Then inspect its limits.</h1>
      <p style={{ fontSize: 19, color: "#413a2b", maxWidth: 660, marginTop: 12 }}>
        Live mode claims a right through the pool and records one opaque adapter position while it is ACTIVE.
        The deployed fallback adapter does not move assets, issue credit, or call an external market. Bank B and
        the second-adapter controls are read-only precondition checks, not live reverted transactions.
      </p>
      {!live && (
        <div style={{ border: `1px solid ${claret}`, background: "#f6ece9", color: "#4a2a2c", padding: "10px 13px", marginTop: 14, fontSize: 13, lineHeight: 1.45 }}>
          <strong>Illustrative offline mode.</strong> This local state model never opens Ready, sends a transaction,
          moves assets, or displays a transaction hash.
        </div>
      )}
      {live && (
        <p style={{ fontSize: 13, color: faded, marginTop: 6 }}>
          On-chain reference for this tab: <span className="mono">{s.reference}</span>. Reconnecting keeps this reference
          and never sends a transaction; only the explicit registration control below can cost gas.
        </p>
      )}

      {/* stepper */}
      <div style={{ display: "flex", gap: 6, margin: "22px 0 26px", flexWrap: "wrap" }}>
        {steps.map((t, i) => (
          <span key={i} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 2,
            border: `1px solid ${i === cur ? ink : rule}`, background: i === cur ? ink : "transparent",
            color: i === cur ? parch : i < cur ? claret : faded }}>{i + 1}. {t}</span>
        ))}
      </div>

      {s.error && (
        <div style={{ border: `1px solid ${claret}`, background: "#f6ece9", color: "#4a2a2c", padding: "12px 16px", marginBottom: 18, fontSize: 14 }}>
          {s.error}
          {/* A wallet timeout is not proof that no transaction was submitted.
              Reconcile the exact commitment against the registry before a
              user is offered another paid action. */}
          {(String(s.error).includes("code=163") || String(s.error).includes("Timeout")) && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: faded }}>
              Ready did not give Sole a conclusive result. The request may have landed even without a
              returned hash, so Sole has not retried it. Use the read-only on-chain status check below
              before sending another action.
            </div>
          )}
          {/* A paymaster simulation is not on-chain evidence. Known refusal
              paths are now verified against the registry without contacting
              Ready; an unexpected paymaster error on a positive action still
              needs a free chain check before any user retry. */}
          {String(s.error).includes("PaymasterV2Error") && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: faded }}>
              Ready's paymaster rejected this before a transaction hash was returned. Sole did not treat that
              as proof of an on-chain outcome or retry it; use the free status check before taking another paid action.
            </div>
          )}
        </div>
      )}

      {/* connect */}
      <Panel>
        <h3 style={{ fontSize: 19, margin: "0 0 6px" }}>Connect a wallet</h3>
        <p style={{ fontSize: 13, color: faded, margin: "0 0 16px" }}>
          {live
            ? "A Ready wallet on Starknet mainnet, with STRK for fees. Private-action fees are read live from STRK20; Sole does not automatically shield public STRK."
            : "Illustrative offline mode: no wallet is needed and nothing touches mainnet."}
        </p>
        {live && (
          <p style={{ fontSize: 12.5, color: faded, margin: "-7px 0 16px", lineHeight: 1.5 }}>
            Standard private actions use an invoke only. If Ready needs an older compatibility shape, Sole stops
            before signing or spending and lets you explicitly choose it below; it never silently adds a shield.
          </p>
        )}
        {live && (
          <p style={{ fontSize: 12.5, color: claret, margin: "0 0 16px", lineHeight: 1.5 }}>
            First time using STRK20 with this wallet? In Ready, complete <strong>"Enable private tokens"</strong> on
            the main wallet view (not Settings → Smart Account, a different, unrelated toggle) before continuing -
            it registers a viewing key with the pool. Every private action reverts with <code style={{ background: "#e9d6d3", padding: "1px 5px" }}>NOT_REGISTERED</code> until this is done once.
          </p>
        )}
        {live && s.readyCompatibilityOption && !s.readyCompatibilityDeposit && (
          <div style={{ border: `1px solid ${claret}`, background: "#f6ece9", color: "#4a2a2c", padding: "11px 13px", margin: "0 0 14px", fontSize: 12.5, lineHeight: 1.5 }}>
            Ready rejected the standard invoke during a no-submission check. No transaction was sent. Code 114 is
            generic (for example, a wallet payload/version issue), so a legacy deposit-plus-invoke shape is only an
            optional experiment; it is not a Sole requirement and may not resolve the error.
            <div style={{ marginTop: 9 }}>
              <Btn onClick={enableReadyCompatibilityDeposit} disabled={!!s.busy} primary>
                Use explicit legacy Ready compatibility shape for this tab
              </Btn>
            </div>
          </div>
        )}
        {live && s.readyPrivateBalanceRequired && !s.readyCompatibilityDeposit && (
          <div style={{ border: `1px solid ${rule}`, background: "#f7f1e3", color: "#4a4436", padding: "11px 13px", margin: "0 0 14px", fontSize: 12.5, lineHeight: 1.5 }}>
            Ready says the shielded balance cannot cover its private-action fee. No transaction was sent.
            Shield STRK deliberately in Ready, wait for it to mature, then return and retry this one action.
          </div>
        )}
        {live && s.readyCompatibilityDeposit && (
          <div style={{ border: `1px solid ${rule}`, background: "#f7f1e3", color: "#4a4436", padding: "11px 13px", margin: "0 0 14px", fontSize: 12.5, lineHeight: 1.5 }}>
            <strong>Explicit Ready compatibility shape is selected for this tab.</strong> Before each private Sole
            action, Ready may display a live-fee-based public shield (about 12 STRK at the currently observed
            fee). You chose this locally; it is not automatic, not sponsored L2 gas, may not solve every payload
            error, and every action still needs your Ready approval.
            <div style={{ marginTop: 9 }}>
              <Btn onClick={disableReadyCompatibilityDeposit} disabled={!!s.busy}>
                Disable legacy compatibility shape
              </Btn>
            </div>
          </div>
        )}
        <Btn onClick={connect} disabled={s.connected || s.busy === "connect"} icon={s.busy === "connect" ? <Loader2 size={16} className="spin" /> : <Wallet size={16} />} primary>
          {s.connected
            ? (live && s.account ? `Connected · ${s.account.address.slice(0, 6)}…${s.account.address.slice(-4)}` : "Connected (illustrative)")
            : (s.busy === "connect" ? "Connecting…" : live ? "Connect Ready wallet" : "Connect (illustrative)")}
        </Btn>
      </Panel>

      {/* the right */}
      <div style={{ border: `1px solid ${rule}`, background: parch2, padding: 24, margin: "22px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ fontSize: 13, color: faded }}>Canonical-right fixture</div>
        <div style={{ fontSize: 22, fontWeight: 600, margin: "3px 0 8px" }}>Receivable RCV-4821</div>
        <div style={{ fontSize: 14 }}>State &nbsp; <strong style={{ color: s.state === "CONSUMED" ? ink : claret }}>{s.state}</strong></div>
        {live && !s.registered && (
          <div style={{ marginTop: 9, fontSize: 12.5, color: faded, lineHeight: 1.45 }}>
            <code>UNCLAIMED</code> is also the default for an unregistered slot. It is not proof that a paid
            registration was sent; Sole verifies a saved registration without submitting anything.
          </div>
        )}
        {s.holder && s.state === "ACTIVE" && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, background: claret, color: parch, padding: "8px 14px", borderRadius: 2 }}>
            <Lock size={15} /> Right ACTIVE. Opaque claim commitment recorded.
          </div>
        )}
        {live && s.state === "ACTIVE" && !s.holder && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: claret, lineHeight: 1.45 }}>
            The chain shows an active claim, but this tab does not hold a matching local claim secret.
            Financing and settlement are intentionally disabled.
          </div>
        )}
      </div>

      {/* rejection */}
      {s.rejected && (
        <div style={{ border: `2px solid ${claret}`, background: "#f6ece9", padding: "20px 24px", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Ban size={22} color={claret} /><strong style={{ fontSize: 19, color: claret }}>Bank B refusal verified from on-chain state</strong>
          </div>
          <div style={{ fontSize: 15.5, lineHeight: 1.55, color: "#4a2a2c" }}>
            The contract permits claims only from <code style={{ background: "#e9d6d3", padding: "1px 6px" }}>UNCLAIMED</code>.
            Because the public registry reads <code style={{ background: "#e9d6d3", padding: "1px 6px" }}>ACTIVE</code>, a fresh
            claim would revert <code style={{ background: "#e9d6d3", padding: "1px 6px" }}>RIGHT_ALREADY_ACTIVE</code>. Ready
            predicts that failure and will not sponsor it, so Sole sends no wallet request or transaction.
             The registry read exposes ACTIVE state and an opaque commitment, not named claimant, raw position amount,
             or counterparty fields. It does not establish transaction-level wallet unlinkability; the public receipt
             boundary is documented in <a href="/docs" style={{ color: claret }}>Docs</a>.
          </div>
        </div>
      )}

      {/* actors */}
      {live && (
        <p style={{ fontSize: 12.5, color: faded, margin: "0 0 10px" }}>
          Claim and finance are separate mainnet actions. After each state-changing action, Sole waits
          for 11 L2 blocks so Ready's private proof can see the prior state; it will not queue two
          wallet requests back-to-back.
        </p>
      )}
      {live && s.claimOutcomeUnknown && (
        <div style={{ marginBottom: 10, fontSize: 12.5, color: claret, lineHeight: 1.45 }}>
          Claim status is unresolved. Sole has kept all paid actions locked and retained the claim intent;
          recheck the chain instead of retrying or resetting this tab.
        </div>
      )}
      {live && s.proofStateBlock != null && !s.proofStateReady && !s.claimOutcomeUnknown && (
        <div style={{ marginBottom: 10, fontSize: 12.5, color: faded, lineHeight: 1.45 }}>
          Waiting for {s.proofStateLabel} to enter Ready's private proof base. This is a read-only wait;
          the next paid action unlocks automatically after 11 L2 blocks.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Actor who="Bank A" role="claims and records one adapter position">
          {s.connected && !s.registered && (
            <>
              {live && (
                <p style={{ fontSize: 12.5, color: claret, margin: "0 0 2px", lineHeight: 1.45 }}>
                  Connect is free. Sole never registers a right automatically. Registration is one network transaction
                  for this specific receivable, not Ready's one-time wallet setup.
                </p>
              )}
              {s.registrationTxHash || s.registrationOutcomeUnknown ? (
                <p style={{ fontSize: 12.5, color: faded, margin: "0 0 2px", lineHeight: 1.45 }}>
                  {s.registrationTxHash
                    ? "A registration submission for this reference is already recorded. It must be verified before claim; Sole will not offer another paid registration. Use the free check below."
                    : "Ready did not return a registration hash, so this registration may be unresolved. Sole will not offer another paid registration; find the hash in Ready and verify it below."}
                </p>
              ) : (
                <Btn onClick={registerRight} disabled={!!s.busy} icon={s.busy === "register" ? <Loader2 size={16} className="spin" /> : <FileLock2 size={16} />} primary>
                  {s.busy === "register" ? "Registering right…" : "Register this right once (network fee)"}
                </Btn>
              )}
              {live && (
                <div style={{ borderTop: `1px solid ${rule}`, paddingTop: 10, marginTop: 2 }}>
                  <label style={{ display: "block", fontSize: 12, color: faded, marginBottom: 5 }}>
                    Recover an earlier registration without gas. If this tab has a different reference, paste the original
                    reference from its log as well; otherwise leave it blank.
                  </label>
                  <input
                    value={registrationReferenceInput}
                    onChange={(event) => setRegistrationReferenceInput(event.target.value)}
                    placeholder={`Original reference (current: ${s.reference})`}
                    spellCheck={false}
                    style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${rule}`, background: "#f7f1e3", color: ink, padding: "8px 9px", fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, marginBottom: 6 }}
                  />
                  <input
                    value={registrationHashInput}
                    onChange={(event) => setRegistrationHashInput(event.target.value)}
                    placeholder={s.registrationTxHash || "0x…"}
                    spellCheck={false}
                    style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${rule}`, background: "#f7f1e3", color: ink, padding: "8px 9px", fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12 }}
                  />
                  <Btn onClick={verifyEarlierRegistration} disabled={!!s.busy} icon={s.busy === "verifyRegistration" ? <Loader2 size={16} className="spin" /> : <Eye size={16} />}>
                    {s.busy === "verifyRegistration" ? "Verifying…" : "Recover & verify registration (no gas)"}
                  </Btn>
                </div>
              )}
            </>
          )}
          <Btn onClick={claimA} disabled={s.state !== "UNCLAIMED" || !s.connected || !s.registered || !s.proofStateReady || !!s.busy || s.claimOutcomeUnknown} icon={s.busy === "claimA" ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />} primary>
            {s.busy === "claimA" ? "Claiming…" : !s.registered ? "Register this right first" : !s.proofStateReady ? "Waiting for proof maturity…" : s.readyCompatibilityDeposit ? "Claim through pool (compatibility deposit)" : "Claim through pool"}
          </Btn>
          {live && s.connected && (
            <Btn
              onClick={s.busy === "claimA" ? checkPendingClaimStatus : checkOnChainStatus}
              disabled={(!!s.busy && s.busy !== "claimA") || s.statusProbe}
              icon={s.busy === "status" || s.statusProbe ? <Loader2 size={16} className="spin" /> : <Eye size={16} />}
            >
              {s.statusProbe ? "Reconciling claim…" : s.busy === "claimA" ? "Claim taking too long? Check chain (no gas)" : s.busy === "status" ? "Checking chain…" : "Recheck on-chain status (no gas)"}
            </Btn>
          )}
          {live && s.connected && s.state === "UNCLAIMED" && (
            <Btn onClick={dryRunClaim} disabled={!!s.busy || !s.proofStateReady || s.claimOutcomeUnknown} icon={s.busy === "dryrunclaim" ? <Loader2 size={16} className="spin" /> : <Eye size={16} />}>
              {s.busy === "dryrunclaim" ? "Simulating…" : "Debug: dry-run claim (no gas)"}
            </Btn>
          )}
          {s.state === "ACTIVE" && s.holder === "A" && !s.financed && (
            <Btn onClick={financeA} disabled={!!s.busy || !s.proofStateReady || s.claimOutcomeUnknown} icon={s.busy === "financeA" ? <Loader2 size={16} className="spin" /> : <Landmark size={16} />} primary>
               {s.busy === "financeA" ? "Recording…" : !s.proofStateReady ? "Waiting for claim maturity…" : "Record adapter position"}
            </Btn>
          )}
          <Btn onClick={settle} disabled={s.state !== "ACTIVE" || s.holder !== "A" || !s.financed || !s.proofStateReady || !!s.busy || s.claimOutcomeUnknown} icon={s.busy === "settle" ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}>
            {s.busy === "settle" ? "Consuming…" : "Clear position & consume"}
          </Btn>
          {/* Wallet-issuing actions all share one busy lock (see the note by
              the "Stuck?" link above) - concurrent requests wedge Ready's
              request queue rather than usefully diagnosing anything. */}
          {live && s.state === "ACTIVE" && s.holder === "A" && (
            <Btn onClick={dryRunFinance} disabled={!!s.busy || !s.proofStateReady || s.claimOutcomeUnknown} icon={s.busy === "dryrun" ? <Loader2 size={16} className="spin" /> : <Eye size={16} />}>
              {s.busy === "dryrun" ? "Simulating…" : "Debug: dry-run finance (no gas)"}
            </Btn>
          )}
        </Actor>
        <Actor who="Bank B" role="attempts the same right">
          <Btn onClick={claimB} disabled={s.state !== "ACTIVE" || !!s.busy || s.claimOutcomeUnknown} icon={s.busy === "claimB" ? <Loader2 size={16} className="spin" /> : <Ban size={16} />} danger>
            {s.busy === "claimB" ? "Verifying…" : "Verify duplicate refusal (no gas)"}
          </Btn>
          <p style={{ fontSize: 13, color: faded, marginTop: 4 }}>Reads the shared registry directly. It does not open Ready, submit a transaction, or use a database.</p>
        </Actor>
      </div>

      {/* cross venue */}
      {s.consumed && (
        <div style={{ border: `1px solid ${rule}`, background: parch2, padding: 24, marginTop: 18 }}>
          <h3 style={{ fontSize: 19, margin: "0 0 4px" }}>Second-adapter configuration</h3>
          <p style={{ fontSize: 13, color: faded, margin: "0 0 14px" }}>A shared-registry adapter with a non-ACTIVE right reaches <code>AUTH_RIGHT_NOT_ACTIVE</code> in source and tests. The deployed second adapter must also prove that it is distinct and reports its own venue before this UI calls it a cross-venue result.</p>
          <Btn onClick={venue2} disabled={s.venue2 || !!s.busy || s.claimOutcomeUnknown} icon={s.busy === "venue2" ? <Loader2 size={16} className="spin" /> : <Ban size={16} />} danger>
            {s.busy === "venue2" ? "Checking…" : "Check second-adapter configuration (no gas)"}
          </Btn>
          {s.venue2 && <p style={{ fontSize: 13, color: claret, marginTop: 10, fontFamily: "ui-monospace,Menlo,monospace" }}>shared registry is CONSUMED · finance would fail AUTH_RIGHT_NOT_ACTIVE · no wallet request or transaction sent</p>}
        </div>
      )}

      {/* scoped disclosure */}
      <section style={{ borderTop: `1px solid ${rule}`, paddingTop: 30, marginTop: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Eye size={18} color={claret} /><h2 style={{ margin: 0, fontSize: 21, fontWeight: 600 }}>What each party sees</h2>
        </div>
        <p style={{ fontSize: 13, color: faded, marginBottom: 14 }}>Illustrative client-side projections only. The deployed contracts do not implement scoped disclosure or an auditor-key system.</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {["public", "holder", "counterparty", "auditor"].map((v) => (
            <button key={v} onClick={() => set({ view: v })} style={{
              border: `1px solid ${s.view === v ? claret : rule}`, background: s.view === v ? claret : "transparent",
              color: s.view === v ? parch : ink, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit",
              fontSize: 14, textTransform: "capitalize", borderRadius: 2 }}>{v}</button>
          ))}
        </div>
        <Projection view={s.view} state={s.state} holder={s.holder} />
      </section>

      {/* log */}
      <section style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Landmark size={17} color={faded} /><span style={{ fontSize: 14, color: faded }}>Transition log</span></div>
          <button onClick={startDifferentRight} disabled={!!s.busy || s.claimOutcomeUnknown || holdsLocalClaim} style={{ border: "none", background: "none", color: claret, cursor: s.busy || s.claimOutcomeUnknown || holdsLocalClaim ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 14 }}>Start a different right (no transaction)</button>
        </div>
        <div style={{ background: "#e2d9c2", border: `1px solid ${rule}`, padding: 14, minHeight: 64, fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, color: "#4a4436", lineHeight: 1.7, wordBreak: "break-all" }}>
          {s.log.length === 0 ? (
            <span style={{ color: faded }}>No transitions yet. Connect, then let Bank A claim.</span>
          ) : (
            s.log.map((l, i) => {
              if (typeof l !== "string") return <div key={i}>{"› "}{l}</div>;
              const urlMatch = l.match(/(https:\/\/[^\s]+)/);
              if (!urlMatch) return <div key={i}>{"› "}{l}</div>;
              const url = urlMatch[1];
              const parts = l.split(url);
              return (
                <div key={i}>
                  {"› "}{parts[0]}
                  <a href={url} target="_blank" rel="noreferrer" style={{ color: claret, textDecoration: "underline" }}>
                    {url}
                  </a>
                  {parts[1]}
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}

function Panel({ children }) { return <div style={{ border: `1px solid ${rule}`, background: parch2, padding: 26 }}>{children}</div>; }
function Actor({ who, role, children }) {
  return (
    <div style={{ border: `1px solid ${rule}`, background: "#efe8d6", padding: 18 }}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{who}</div>
      <div style={{ fontSize: 13, color: faded, margin: "2px 0 14px" }}>{role}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}
function Btn({ children, onClick, disabled, icon, primary, danger }) {
  const bg = danger ? claret : primary ? ink : "transparent";
  const fg = danger || primary ? parch : ink;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
      background: disabled ? "#d9d0ba" : bg, color: disabled ? faded : fg,
      border: `1px solid ${disabled ? rule : bg === "transparent" ? "#9a8f74" : bg}`,
      padding: "10px 14px", fontSize: 14.5, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "inherit", borderRadius: 2 }}>{icon}{children}</button>
  );
}
function Projection({ view, state, holder }) {
  const rows = {
    public: [["Registry state", state, true], ["Slot identifier", "queryable with canonical id", true], ["Registry event fields", "slot + opaque commitment", true], ["Bundled receipt", "indexed depositor can correlate to the slot", true]],
    holder: [["Local fixture state", holder ? "Bank A holds the local model" : "—", true], ["Local claim preimage", holder ? "kept in this tab" : "—", true], ["On-chain access control", "not a holder-view feature", true]],
    counterparty: [["Client-side projection", "illustrative only", true], ["Counterparty access control", "not implemented on-chain", true], ["Raw position amount", "not carried in registry events", false]],
    auditor: [["Client-side projection", "illustrative only", true], ["Auditor key", "not implemented", true], ["Disclosure protocol", "not implemented", true]],
  }[view];
  return (
    <div style={{ border: `1px solid ${rule}` }}>
      {rows.map(([k, v, known], i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderTop: i ? "1px solid #ded4bd" : "none", background: i % 2 ? "#e9e2d1" : "#efe9dc" }}>
          <span style={{ fontSize: 14.5 }}>{k}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, color: known ? ink : faded }}>
            {known ? <Eye size={14} color={claret} /> : <EyeOff size={14} color={faded} />}{v}
          </span>
        </div>
      ))}
    </div>
  );
}
