"use client";
// Sole demo flow (product invariant). A human drives the whole lifecycle:
// connect -> register -> claim (private) -> finance (venue executes) ->
// duplicate refused -> settle (consumed) -> second venue refused -> disclosure.
//
// Live mode (default) calls the real deployed contracts through the
// connected wallet via @sole/sdk SoleClient - every action below is a real
// mainnet transaction, linked to Voyager, reverts shown honestly from the
// receipt. Demo mode is the offline fallback: the same flow against a local
// state model with illustrative hashes, for when no wallet is available.
import { useState, useEffect } from "react";
import {
  FileLock2, ShieldCheck, Ban, CheckCircle2, Eye, EyeOff, Landmark, Lock, Wallet, Loader2,
} from "lucide-react";
import { connectWallet, getSoleClients, provider, randomFelt, voyagerTxUrl } from "../lib/sole";

const ink = "#1a160f", parch = "#e9e1ce", parch2 = "#e0d6bd", claret = "#7c1d2a", faded = "#8c8267", rule = "#cabd9d";
const steps = ["Connect", "Register", "A claims", "A finances", "B refused", "Settle", "2nd venue refused"];

function freshReference() { return "RCV-4821-" + Date.now().toString(36); }

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
    state: "UNCLAIMED", holder: null, rejected: false, consumed: false, venue2: false,
    view: "public", log: [], busy: null, error: null,
    claimantSecret: null, fundingNote: null, claimCommitment: null,
  };
}

export default function SoleDemo() {
  const [s, setS] = useState(() => initialState("live"));
  const push = (l) => setS((p) => ({ ...p, log: [...p.log, l] }));
  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  const demoHash = () => "0x" + Array.from({ length: 6 }, () => Math.floor(Math.random() * 65536).toString(16).padStart(4, "0")).join("");

  const cur = !s.connected ? 0 : s.consumed ? 6 : s.rejected ? 4 : s.state === "ACTIVE" ? 3 : s.state === "UNCLAIMED" ? 1 : 2;
  const live = s.mode === "live";

  // Client-only: assigns the real per-session reference once mounted, so a
  // repeat demo run doesn't collide with an earlier registration.
  useEffect(() => { set({ reference: freshReference() }); }, []);

  /** Live-mode helper: submit through SoleClient, log the tx immediately,
   *  then wait for the receipt and log the real outcome - including the
   *  revert reason when the chain refuses it. Reverts are logged as a
   *  result, not thrown as a UI error: a refused transaction is the demo
   *  working, not the demo breaking. */
  async function runTx(label, submit) {
    let txHash;
    try {
      txHash = await submit();
    } catch (e) {
      push(`${label}: submission failed - ${describeError(e)}`);
      throw e;
    }
    push(`${label}: submitted ${txHash} (pending) -> ${voyagerTxUrl(txHash)}`);
    const receipt = await provider.waitForTransaction(txHash);
    const status = receipt.execution_status ?? receipt.finality_status;
    if (status === "REVERTED") {
      const reason = receipt.revert_reason ?? "(no reason reported)";
      push(`${label}: reverted - ${reason}`);
      return { txHash, reverted: true, reason };
    }
    push(`${label}: confirmed (${status})`);
    return { txHash, reverted: false };
  }

  const toggleMode = () => {
    if (s.busy) return;
    setS({ ...initialState(live ? "demo" : "live"), reference: freshReference() });
  };

  const connect = async () => {
    if (!live) {
      set({ connected: true });
      push("wallet connected (demo) · register_right(" + s.reference + ") -> UNCLAIMED");
      return;
    }
    set({ busy: "connect", error: null });
    try {
      const account = await connectWallet();
      set({ connected: true, account, busy: null });
      const { venue1 } = await getSoleClients();
      const { reverted, reason } = await runTx(
        `register(${s.reference})`,
        () => venue1.register(account, s.reference),
      );
      if (!reverted) push("state_of() reads UNCLAIMED");
      else set({ error: reason });
    } catch (e) {
      set({ busy: null, error: describeError(e) });
    }
  };

  const claimA = async () => {
    if (!live) {
      set({ state: "ACTIVE", holder: "A", rejected: false });
      push("Bank A: shield -> anonymizer -> claim() " + demoHash() + " -> ACTIVE (demo)");
      push("Sole authorizes financing -> money market executes against the venue " + demoHash() + " (demo)");
      return;
    }
    set({ busy: "claimA", error: null });
    try {
      const { venue1 } = await getSoleClients();
      const claimantSecret = randomFelt();
      const fundingNote = randomFelt();

      const { tx: claimTx, claimCommitment } = await venue1.claim(s.account, s.reference, claimantSecret, fundingNote);
      push(`Bank A: claim submitted ${claimTx} (pending) -> ${voyagerTxUrl(claimTx)}`);
      const claimReceipt = await provider.waitForTransaction(claimTx);
      const claimStatus = claimReceipt.execution_status ?? claimReceipt.finality_status;
      if (claimStatus === "REVERTED") {
        const reason = claimReceipt.revert_reason ?? "(no reason reported)";
        push(`Bank A: claim reverted - ${reason}`);
        set({ busy: null, error: reason });
        return;
      }
      push("Bank A: claim confirmed -> ACTIVE");
      set({ state: "ACTIVE", holder: "A", rejected: false, claimantSecret, fundingNote, claimCommitment, busy: "financeA" });

      const amountCommitment = randomFelt();
      const { reverted, reason } = await runTx(
        "Bank A: finance",
        () => venue1.finance(s.account, s.reference, claimCommitment, amountCommitment),
      );
      set({ busy: null });
      if (reverted) set({ error: reason });
    } catch (e) {
      set({ busy: null, error: describeError(e) });
    }
  };

  /** Temporary diagnostic: runs finance()'s wallet-side pre-flight
   *  simulation (strk20PrepareInvoke, simulate=true) with no submission, no
   *  confirmation, no gas, and no deposit moved - to see the wallet's actual
   *  detailed error instead of the generic PaymasterV2Error code a live
   *  attempt shows. Safe to click any number of times. */
  const dryRunFinance = async () => {
    set({ busy: "dryrun", error: null });
    try {
      const { venue1 } = await getSoleClients();
      const amountCommitment = randomFelt();
      const result = await venue1.dryRunFinance(s.account, s.reference, s.claimCommitment, amountCommitment);
      push(`Dry-run finance() result: ${JSON.stringify(result)}`);
      set({ busy: null });
    } catch (e) {
      push(`Dry-run finance() error: ${describeError(e)}`);
      set({ busy: null, error: describeError(e) });
    }
  };

  /** finance() submitted self-paid (no paymaster sponsorship) instead of
   *  through the wallet's usual sponsored route. COSTS REAL GAS - this is
   *  a deliberate single attempt to test whether the paymaster itself is
   *  refusing to sponsor a call into the adapter, not a free diagnostic. */
  const financeSelfPaid = async () => {
    set({ busy: "financeselfpaid", error: null });
    try {
      const { venue1 } = await getSoleClients();
      const amountCommitment = randomFelt();
      const tx = await venue1.financeSelfPaid(s.account, s.reference, s.claimCommitment, amountCommitment);
      push(`Finance (self-paid) submitted ${tx} (pending) -> ${voyagerTxUrl(tx)}`);
      const receipt = await provider.waitForTransaction(tx);
      const status = receipt.execution_status ?? receipt.finality_status;
      if (status === "REVERTED") {
        push(`Finance (self-paid) reverted - ${receipt.revert_reason ?? "(no reason reported)"}`);
        set({ busy: null, error: receipt.revert_reason ?? "(no reason reported)" });
      } else {
        push(`Finance (self-paid) confirmed (${status})`);
        set({ busy: null });
      }
    } catch (e) {
      push(`Finance (self-paid) error: ${describeError(e)}`);
      set({ busy: null, error: describeError(e) });
    }
  };

  const claimB = async () => {
    if (!live) {
      set({ rejected: true });
      push("Bank B: claim(same slot) " + demoHash() + " -> REVERT RIGHT_ALREADY_ACTIVE · venue never called (demo)");
      return;
    }
    set({ busy: "claimB", error: null });
    try {
      const { venue1 } = await getSoleClients();
      const secretB = randomFelt();
      const fundingB = randomFelt();
      const { reverted } = await runTx(
        "Bank B: claim",
        () => venue1.claim(s.account, s.reference, secretB, fundingB).then((r) => r.tx),
      );
      set({ busy: null });
      if (reverted) { push("venue never called"); set({ rejected: true }); }
      // A confirmed duplicate claim would mean the exclusivity invariant is
      // broken - that's a bug to surface, not a state to silently accept.
      else set({ error: "duplicate claim did not revert - check the deployed contracts" });
    } catch (e) {
      set({ busy: null, error: describeError(e) });
    }
  };

  const settle = async () => {
    if (!live) {
      set({ state: "CONSUMED", consumed: true, rejected: false });
      push("Bank A: settle_and_repay() -> venue repaid + nullifier " + demoHash() + " -> CONSUMED (demo)");
      return;
    }
    set({ busy: "settle", error: null });
    try {
      const { venue1 } = await getSoleClients();
      const { reverted, reason } = await runTx(
        "Bank A: settle_and_repay",
        () => venue1.settleAndRepay(s.account, s.reference, s.claimantSecret, s.claimCommitment),
      );
      set({ busy: null });
      if (reverted) set({ error: reason });
      else set({ state: "CONSUMED", consumed: true, rejected: false });
    } catch (e) {
      set({ busy: null, error: describeError(e) });
    }
  };

  const venue2 = async () => {
    if (!live) {
      set({ venue2: true });
      push("Venue 2 (different market, different lender): finance(same right) " + demoHash() + " -> REVERT · right is spent everywhere (demo)");
      return;
    }
    set({ busy: "venue2", error: null });
    try {
      const { venue2: client2 } = await getSoleClients();
      const amountCommitment = randomFelt();
      const { reverted } = await runTx(
        "Venue 2: finance",
        () => client2.finance(s.account, s.reference, s.claimCommitment, amountCommitment),
      );
      set({ busy: null });
      if (reverted) { push("right is spent everywhere, holder still hidden"); set({ venue2: true }); }
      else set({ error: "second-venue finance did not revert - check the deployed contracts" });
    } catch (e) {
      set({ busy: null, error: describeError(e) });
    }
  };

  const reset = () => setS({ ...initialState(s.mode), reference: freshReference() });

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "44px 26px 60px", fontFamily: "'Spectral',Georgia,serif", color: ink }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: 14, color: claret, fontStyle: "italic", marginBottom: 14 }}>Demo · one receivable, two banks</div>
        <button onClick={toggleMode} disabled={!!s.busy} style={{
          fontSize: 12.5, border: `1px solid ${rule}`, background: "transparent", color: faded,
          padding: "5px 10px", borderRadius: 2, cursor: s.busy ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          mode: <strong style={{ color: live ? claret : ink }}>{live ? "live (mainnet)" : "demo (offline)"}</strong> — switch
        </button>
      </div>
      <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-.015em", margin: 0 }}>Finance a right. Then try to finance it twice — anywhere.</h1>
      <p style={{ fontSize: 19, color: "#413a2b", maxWidth: 660, marginTop: 12 }}>
        Bank A privately claims the right and finances it against a market. Bank B is refused. After
        settlement, a second, unrelated venue is refused too. Fixture data is labelled as a fixture —
        the registry knows nothing about receivables; it enforces a single-use right over a commitment.
      </p>
      {live && (
        <p style={{ fontSize: 13, color: faded, marginTop: 6 }}>
          On-chain reference for this session: <span className="mono">{s.reference}</span> (unique per run, so a repeat demo doesn't collide with an earlier one).
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
        </div>
      )}

      {/* connect */}
      <Panel>
        <h3 style={{ fontSize: 19, margin: "0 0 6px" }}>Connect a wallet</h3>
        <p style={{ fontSize: 13, color: faded, margin: "0 0 16px" }}>
          {live
            ? "A Ready wallet on Starknet mainnet, with STRK for fees. Each private action pays the STRK20 pool's flat fee, read live from the pool."
            : "Demo mode: no wallet needed, nothing touches mainnet."}
        </p>
        {live && (
          <p style={{ fontSize: 12.5, color: claret, margin: "0 0 16px", lineHeight: 1.5 }}>
            First time using STRK20 with this wallet? In Ready, complete <strong>"Enable private tokens"</strong> on
            the main wallet view (not Settings → Smart Account, a different, unrelated toggle) before continuing -
            it registers a viewing key with the pool. Every private action reverts with <code style={{ background: "#e9d6d3", padding: "1px 5px" }}>NOT_REGISTERED</code> until this is done once.
          </p>
        )}
        <Btn onClick={connect} disabled={s.connected || s.busy === "connect"} icon={s.busy === "connect" ? <Loader2 size={16} className="spin" /> : <Wallet size={16} />} primary>
          {s.connected
            ? (live && s.account ? `Connected · ${s.account.address.slice(0, 6)}…${s.account.address.slice(-4)}` : "Connected (demo)")
            : (s.busy === "connect" ? "Connecting…" : live ? "Connect Ready wallet" : "Connect (demo)")}
        </Btn>
      </Panel>

      {/* the right */}
      <div style={{ border: `1px solid ${rule}`, background: parch2, padding: 24, margin: "22px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ fontSize: 13, color: faded }}>Canonical right</div>
        <div style={{ fontSize: 22, fontWeight: 600, margin: "3px 0 8px" }}>Receivable RCV-4821</div>
        <div style={{ fontSize: 14 }}>State &nbsp; <strong style={{ color: s.state === "CONSUMED" ? ink : claret }}>{s.state}</strong></div>
        {s.holder && s.state === "ACTIVE" && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, background: claret, color: parch, padding: "8px 14px", borderRadius: 2 }}>
            <Lock size={15} /> Right held. Claimant sealed.
          </div>
        )}
      </div>

      {/* rejection */}
      {s.rejected && (
        <div style={{ border: `2px solid ${claret}`, background: "#f6ece9", padding: "20px 24px", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Ban size={22} color={claret} /><strong style={{ fontSize: 19, color: claret }}>Bank B claim rejected on-chain</strong>
          </div>
          <div style={{ fontSize: 15.5, lineHeight: 1.55, color: "#4a2a2c" }}>
            Reverted with <code style={{ background: "#e9d6d3", padding: "1px 6px" }}>RIGHT_ALREADY_ACTIVE</code>. Bank B
            learns the receivable is already claimed. It does <strong>not</strong> learn who claimed it,
            how much they funded, or the counterparty. The venue was never called.
          </div>
        </div>
      )}

      {/* actors */}
      {live && (
        <p style={{ fontSize: 12.5, color: faded, margin: "0 0 10px" }}>
          "Shield, claim & finance" is two separate mainnet transactions, so Ready will prompt you
          to sign <strong>twice</strong> in a row - once for claim, once for finance. That's expected,
          not a retry or a stuck wallet.
        </p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Actor who="Bank A" role="acquires and finances the right">
          <Btn onClick={claimA} disabled={s.state !== "UNCLAIMED" || !s.connected || !!s.busy} icon={s.busy === "claimA" || s.busy === "financeA" ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />} primary>
            {s.busy === "claimA" ? "Claiming…" : s.busy === "financeA" ? "Financing…" : "Shield, claim & finance"}
          </Btn>
          <Btn onClick={settle} disabled={s.state !== "ACTIVE" || s.holder !== "A" || !!s.busy} icon={s.busy === "settle" ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}>
            {s.busy === "settle" ? "Settling…" : "Settle & consume"}
          </Btn>
          {live && s.state === "ACTIVE" && s.holder === "A" && (
            <>
              {/* Deliberately NOT disabled by s.busy: this is the one tool meant
                  to work even when finance() is hung waiting on an unresolved
                  wallet prompt, which locks every other busy-gated button. */}
              <Btn onClick={dryRunFinance} disabled={s.busy === "dryrun"} icon={s.busy === "dryrun" ? <Loader2 size={16} className="spin" /> : <Eye size={16} />}>
                {s.busy === "dryrun" ? "Simulating…" : "Debug: dry-run finance (no gas)"}
              </Btn>
              {/* Also exempt from s.busy, for the same reason as the dry-run
                  button above. This one costs real gas - it's a deliberate
                  single attempt to bypass the wallet's paymaster sponsorship,
                  not something to click repeatedly. */}
              <Btn onClick={financeSelfPaid} disabled={s.busy === "financeselfpaid"} icon={s.busy === "financeselfpaid" ? <Loader2 size={16} className="spin" /> : <Wallet size={16} />} danger>
                {s.busy === "financeselfpaid" ? "Submitting (self-paid)…" : "Debug: finance self-paid, no paymaster (real gas)"}
              </Btn>
              {s.busy && s.busy !== "dryrun" && s.busy !== "financeselfpaid" && (
                <button onClick={() => set({ busy: null })} style={{ border: "none", background: "none", color: faded, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, textAlign: "left", padding: 0 }}>
                  Stuck? Clear the busy state (doesn't cancel a pending wallet prompt, just unlocks the buttons)
                </button>
              )}
            </>
          )}
        </Actor>
        <Actor who="Bank B" role="attempts the same right">
          <Btn onClick={claimB} disabled={s.state !== "ACTIVE" || !!s.busy} icon={s.busy === "claimB" ? <Loader2 size={16} className="spin" /> : <Ban size={16} />} danger>
            {s.busy === "claimB" ? "Attempting…" : "Attempt duplicate claim"}
          </Btn>
          <p style={{ fontSize: 13, color: faded, marginTop: 4 }}>Only possible once A holds the right. The chain, not a database, refuses it — and learns nothing about A.</p>
        </Actor>
      </div>

      {/* cross venue */}
      {s.consumed && (
        <div style={{ border: `1px solid ${rule}`, background: parch2, padding: 24, marginTop: 18 }}>
          <h3 style={{ fontSize: 19, margin: "0 0 4px" }}>A different venue, later</h3>
          <p style={{ fontSize: 13, color: faded, margin: "0 0 14px" }}>The right is consumed. Another lender, at another market that shares no ledger with the first, tries to finance the same underlying right. Single-use is global — refused here too, and this venue never learns who financed it first.</p>
          <Btn onClick={venue2} disabled={s.venue2 || !!s.busy} icon={s.busy === "venue2" ? <Loader2 size={16} className="spin" /> : <Ban size={16} />} danger>
            {s.busy === "venue2" ? "Attempting…" : "Finance at a second venue"}
          </Btn>
          {s.venue2 && <p style={{ fontSize: 13, color: claret, marginTop: 10, fontFamily: "ui-monospace,Menlo,monospace" }}>reverted at venue 2: AUTH_RIGHT_NOT_ACTIVE · holder still hidden</p>}
        </div>
      )}

      {/* scoped disclosure */}
      <section style={{ borderTop: `1px solid ${rule}`, paddingTop: 30, marginTop: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Eye size={18} color={claret} /><h2 style={{ margin: 0, fontSize: 21, fontWeight: 600 }}>What each party sees</h2>
        </div>
        <p style={{ fontSize: 13, color: faded, marginBottom: 14 }}>Same underlying private state, four scoped projections.</p>
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
          <button onClick={reset} style={{ border: "none", background: "none", color: claret, cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>Reset</button>
        </div>
        <div style={{ background: "#e2d9c2", border: `1px solid ${rule}`, padding: 14, minHeight: 64, fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, color: "#4a4436", lineHeight: 1.7, wordBreak: "break-all" }}>
          {s.log.length === 0 ? <span style={{ color: faded }}>No transitions yet. Connect, then let Bank A claim.</span> : s.log.map((l, i) => <div key={i}>{"› "}{l}</div>)}
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
    public: [["Right state", state, true], ["Slot identifier", "queryable with canonical id", true], ["Claimant", "hidden", false], ["Funding amount", "hidden", false], ["Counterparty", "hidden", false]],
    holder: [["Right state", state, true], ["This is my claim", holder ? "yes" : "—", true], ["Funding amount", "known to me", true], ["Settlement", state === "CONSUMED" ? "settled" : "open", true]],
    counterparty: [["Obligation satisfied", state === "CONSUMED" ? "yes" : "not yet", true], ["Claimant identity", "hidden", false], ["Funding amount", "hidden", false]],
    auditor: [["Canonical right", "RCV-4821", true], ["Lifecycle", "registered -> active -> consumed", true], ["Claimant", "disclosed under scoped key", true], ["Funding note", "disclosed under scoped key", true], ["Timestamps", "disclosed under scoped key", true]],
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
