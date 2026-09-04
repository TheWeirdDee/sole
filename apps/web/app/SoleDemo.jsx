"use client";
// Sole demo flow (product invariant). A human drives the whole lifecycle:
// connect -> register -> claim (private) -> finance (venue executes) ->
// duplicate refused -> settle (consumed) -> second venue refused -> disclosure.
// Local state model here so the flow is demonstrable without keys; the shipped
// build wires these to @sole/sdk SoleClient behind a demo/live toggle.
import { useState } from "react";
import {
  FileLock2, ShieldCheck, Ban, CheckCircle2, Eye, EyeOff, Landmark, Lock, Wallet,
} from "lucide-react";

const ink = "#1a160f", parch = "#e9e1ce", parch2 = "#e0d6bd", claret = "#7c1d2a", faded = "#8c8267", rule = "#cabd9d";
const S0 = { connected: false, state: "UNCLAIMED", holder: null, rejected: false, consumed: false, venue2: false, view: "public", log: [] };
const steps = ["Connect", "Register", "A claims", "A finances", "B refused", "Settle", "2nd venue refused"];

export default function SoleDemo() {
  const [s, setS] = useState(S0);
  const push = (l) => setS((p) => ({ ...p, log: [...p.log, l] }));
  const hash = () => "0x" + Array.from({ length: 6 }, () => Math.floor(Math.random() * 65536).toString(16).padStart(4, "0")).join("");

  const cur = !s.connected ? 0 : s.consumed ? 6 : s.rejected ? 4 : s.state === "ACTIVE" ? 3 : s.state === "UNCLAIMED" ? 1 : 2;

  const connect = () => { setS((p) => ({ ...p, connected: true })); push("wallet connected \u00b7 register_right(RCV-4821) -> UNCLAIMED"); };
  const claimA = () => { setS((p) => ({ ...p, state: "ACTIVE", holder: "A", rejected: false })); push("Bank A: shield -> anonymizer -> claim() " + hash() + " -> ACTIVE"); push("Sole authorizes financing -> money market executes against the venue " + hash()); };
  const claimB = () => { setS((p) => ({ ...p, rejected: true })); push("Bank B: claim(same slot) " + hash() + " -> REVERT RIGHT_ALREADY_ACTIVE \u00b7 venue never called"); };
  const settle = () => { setS((p) => ({ ...p, state: "CONSUMED", consumed: true, rejected: false })); push("Bank A: settle_and_repay() -> venue repaid + nullifier " + hash() + " -> CONSUMED"); };
  const venue2 = () => { setS((p) => ({ ...p, venue2: true })); push("Venue 2 (different market, different lender): finance(same right) " + hash() + " -> REVERT \u00b7 right is spent everywhere"); };
  const reset = () => setS(S0);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "44px 26px 60px", fontFamily: "'Spectral',Georgia,serif", color: ink }}>
      <div style={{ fontSize: 14, color: claret, fontStyle: "italic", marginBottom: 14 }}>Demo · one receivable, two banks</div>
      <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-.015em", margin: 0 }}>Finance a right. Then try to finance it twice — anywhere.</h1>
      <p style={{ fontSize: 19, color: "#413a2b", maxWidth: 660, marginTop: 12 }}>
        Bank A privately claims the right and finances it against a market. Bank B is refused. After
        settlement, a second, unrelated venue is refused too. Fixture data is labelled as a fixture —
        the registry knows nothing about receivables; it enforces a single-use right over a commitment.
      </p>

      {/* stepper */}
      <div style={{ display: "flex", gap: 6, margin: "22px 0 26px", flexWrap: "wrap" }}>
        {steps.map((t, i) => (
          <span key={i} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 2,
            border: `1px solid ${i === cur ? ink : rule}`, background: i === cur ? ink : "transparent",
            color: i === cur ? parch : i < cur ? claret : faded }}>{i + 1}. {t}</span>
        ))}
      </div>

      {/* connect */}
      <Panel>
        <h3 style={{ fontSize: 19, margin: "0 0 6px" }}>Connect a wallet</h3>
        <p style={{ fontSize: 13, color: faded, margin: "0 0 16px" }}>A Ready wallet on Starknet mainnet, with STRK for fees. Each private action is a flat 4 STRK.</p>
        <Btn onClick={connect} disabled={s.connected} icon={<Wallet size={16} />} primary>{s.connected ? "Connected \u00b7 0x04a9\u2026c1e2" : "Connect Ready wallet"}</Btn>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Actor who="Bank A" role="acquires and finances the right">
          <Btn onClick={claimA} disabled={s.state !== "UNCLAIMED" || !s.connected} icon={<ShieldCheck size={16} />} primary>Shield, claim &amp; finance</Btn>
          <Btn onClick={settle} disabled={s.state !== "ACTIVE" || s.holder !== "A"} icon={<CheckCircle2 size={16} />}>Settle &amp; consume</Btn>
        </Actor>
        <Actor who="Bank B" role="attempts the same right">
          <Btn onClick={claimB} disabled={s.state !== "ACTIVE"} icon={<Ban size={16} />} danger>Attempt duplicate claim</Btn>
          <p style={{ fontSize: 13, color: faded, marginTop: 4 }}>Only possible once A holds the right. The chain, not a database, refuses it — and learns nothing about A.</p>
        </Actor>
      </div>

      {/* cross venue */}
      {s.consumed && (
        <div style={{ border: `1px solid ${rule}`, background: parch2, padding: 24, marginTop: 18 }}>
          <h3 style={{ fontSize: 19, margin: "0 0 4px" }}>A different venue, later</h3>
          <p style={{ fontSize: 13, color: faded, margin: "0 0 14px" }}>The right is consumed. Another lender, at another market that shares no ledger with the first, tries to finance the same underlying right. Single-use is global — refused here too, and this venue never learns who financed it first.</p>
          <Btn onClick={venue2} disabled={s.venue2} icon={<Ban size={16} />} danger>Finance at a second venue</Btn>
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
            <button key={v} onClick={() => setS((p) => ({ ...p, view: v }))} style={{
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
        <div style={{ background: "#e2d9c2", border: `1px solid ${rule}`, padding: 14, minHeight: 64, fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, color: "#4a4436", lineHeight: 1.7 }}>
          {s.log.length === 0 ? <span style={{ color: faded }}>No transitions yet. Connect, then let Bank A claim.</span> : s.log.map((l, i) => <div key={i}>{"\u203a "}{l}</div>)}
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
    holder: [["Right state", state, true], ["This is my claim", holder ? "yes" : "\u2014", true], ["Funding amount", "known to me", true], ["Settlement", state === "CONSUMED" ? "settled" : "open", true]],
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
