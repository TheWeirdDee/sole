"use client";

// SPDX-License-Identifier: Apache-2.0
//
// Sole - demo web app (product invariant)
// A human can drive the entire lifecycle from the browser and SEE the privacy
// boundary. The demo opens on the FAILURE (fail-closed as the hero), then
// reveals what each party can and cannot learn.
//
// Design brief: the subject is a private financial-rights registry. Not a
// fintech dashboard, not a crypto neon deck. The visual metaphor is a bank
// ledger seal / bonded document: exclusive, quiet, weighty. Palette is ink and
// aged-paper with a single wax-seal claret for the moment of exclusivity.
// Icons are lucide-react components only - no emoji anywhere.
//
// DEMO FIXTURE data (Bank A / Bank B / receivable) is labelled a fixture; the
// underlying registry is generic. Wire buttons to @sole/sdk SoleClient for
// real mainnet calls; here the transitions run against a local state model so
// the flow is demonstrable without keys.

import { useState } from "react";
import {
  FileLock2, ShieldCheck, Ban, CheckCircle2, Eye, EyeOff, Landmark, ArrowRight, Lock,
} from "lucide-react";

const STATE = { UNCLAIMED: "UNCLAIMED", ACTIVE: "ACTIVE", CONSUMED: "CONSUMED" };

const ink = "#1a1712";
const paper = "#efe9dc";
const paper2 = "#e4dcc9";
const claret = "#7a1f2b";
const claretSoft = "#a8434f";
const faded = "#8a8271";

export default function SoleDemo() {
  const [state, setState] = useState(STATE.UNCLAIMED);
  const [holder, setHolder] = useState(null);       // "A" once claimed
  const [rejected, setRejected] = useState(false);   // Bank B rejection shown
  const [viewer, setViewer] = useState("public");    // public | holder | counterparty | auditor
  const [log, setLog] = useState([]);

  const push = (line) => setLog((l) => [...l, line]);

  const register = () => { setState(STATE.UNCLAIMED); push("register_right(slot) -> UNCLAIMED"); };
  const claimA = () => {
    setState(STATE.ACTIVE); setHolder("A"); setRejected(false);
    push("Bank A: shield -> privacy_invoke -> claim() -> ACTIVE");
  };
  const claimB = () => {
    // The thesis: second claim on an ACTIVE right reverts.
    setRejected(true);
    push("Bank B: claim(same slot) -> REVERT: RIGHT_ALREADY_ACTIVE");
  };
  const settle = () => {
    setState(STATE.CONSUMED); setRejected(false);
    push("Bank A: settle() reveal nullifier -> CONSUMED");
  };
  const reset = () => { setState(STATE.UNCLAIMED); setHolder(null); setRejected(false); setLog([]); };

  return (
    <div style={{ minHeight: "100vh", background: paper, color: ink,
      fontFamily: "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif" }}>
      <div style={{ maxWidth: 940, margin: "0 auto", padding: "48px 28px 80px" }}>

        <header style={{ borderBottom: `2px solid ${ink}`, paddingBottom: 18, marginBottom: 34 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <FileLock2 size={30} strokeWidth={1.4} color={claret} />
            <h1 style={{ margin: 0, fontSize: 40, letterSpacing: "-0.02em", fontWeight: 600 }}>Sole</h1>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 18, maxWidth: 640, lineHeight: 1.5, color: "#413a2e" }}>
            A right can be privately held, publicly enforceable, and consumed exactly once.
            The enforcement state is public. The economic relationship behind it is private.
          </p>
        </header>

        {/* THE FIXTURE */}
        <p style={{ fontSize: 14, color: faded, margin: "0 0 20px" }}>
          Demo fixture: one receivable, two banks. The registry itself knows nothing about receivables.
        </p>

        {/* THE RIGHT */}
        <section style={{ background: paper2, border: `1px solid #cbc0a6`, padding: "22px 24px",
          marginBottom: 26, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 13, color: faded, marginBottom: 4 }}>Canonical right</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>Receivable RCV-4821</div>
              <div style={{ fontSize: 13, color: faded, marginTop: 6 }}>
                slot_key = Poseidon(TAG_SLOT, canonical_asset_id)
              </div>
            </div>
            <StateBadge state={state} />
          </div>

          {/* Wax seal appears when held */}
          {holder && state === STATE.ACTIVE && (
            <div style={{ position: "absolute", right: 22, bottom: -16, display: "flex",
              alignItems: "center", gap: 8, background: claret, color: paper,
              padding: "8px 14px", borderRadius: 2, boxShadow: "0 3px 10px rgba(0,0,0,.25)" }}>
              <Lock size={15} strokeWidth={2} /> <span style={{ fontSize: 13, letterSpacing: ".02em" }}>
                Right held. Claimant sealed.</span>
            </div>
          )}
        </section>

        {/* THE REJECTION - the hero moment */}
        {rejected && (
          <section style={{ border: `2px solid ${claret}`, background: "#f6ece9",
            padding: "20px 24px", marginBottom: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Ban size={22} color={claret} strokeWidth={2} />
              <strong style={{ fontSize: 19, color: claret }}>Bank B claim rejected on-chain</strong>
            </div>
            <div style={{ fontSize: 15.5, lineHeight: 1.55, color: "#4a2a2c" }}>
              Reverted with <code style={{ background: "#e9d6d3", padding: "1px 6px" }}>RIGHT_ALREADY_ACTIVE</code>.
              Bank B learns the receivable is already claimed. It does <strong>not</strong> learn who
              claimed it, how much they funded, or the counterparty relationship.
            </div>
          </section>
        )}

        {/* ACTIONS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 34 }}>
          <Actor label="Bank A" sub="acquires the right">
            <Btn onClick={claimA} disabled={state !== STATE.UNCLAIMED}
              icon={<ShieldCheck size={17} />} primary>Shield &amp; claim privately</Btn>
            <Btn onClick={settle} disabled={state !== STATE.ACTIVE || holder !== "A"}
              icon={<CheckCircle2 size={17} />}>Settle &amp; consume</Btn>
          </Actor>
          <Actor label="Bank B" sub="attempts the same right">
            <Btn onClick={claimB} disabled={state !== STATE.ACTIVE}
              icon={<Ban size={17} />} danger>Attempt duplicate claim</Btn>
            <div style={{ fontSize: 13, color: faded, lineHeight: 1.4 }}>
              Only possible once A holds the right. The chain, not a database, refuses it.
            </div>
          </Actor>
        </div>

        {/* SCOPED DISCLOSURE */}
        <section style={{ borderTop: `1px solid #cbc0a6`, paddingTop: 26, marginBottom: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Eye size={18} color={claret} /> <h2 style={{ margin: 0, fontSize: 21, fontWeight: 600 }}>
              What each party sees</h2>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {["public", "holder", "counterparty", "auditor"].map((v) => (
              <button key={v} onClick={() => setViewer(v)} style={{
                border: `1px solid ${viewer === v ? claret : "#cbc0a6"}`,
                background: viewer === v ? claret : "transparent",
                color: viewer === v ? paper : ink, padding: "7px 15px", cursor: "pointer",
                fontSize: 14, fontFamily: "inherit", textTransform: "capitalize", borderRadius: 2 }}>
                {v}
              </button>
            ))}
          </div>
          <Projection viewer={viewer} state={state} holder={holder} />
        </section>

        {/* WHY STRK20 IS NECESSARY */}
        <section style={{ background: ink, color: paper, padding: "22px 24px", marginBottom: 26 }}>
          <div style={{ fontSize: 13, color: "#c9bfa6", marginBottom: 10 }}>Why the privacy layer is causal, not decorative</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 14.5 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><EyeOff size={16} /> shielded funding</span>
            <ArrowRight size={15} color={claretSoft} />
            <span>private transfer</span>
            <ArrowRight size={15} color={claretSoft} />
            <span>anonymizer</span>
            <ArrowRight size={15} color={claretSoft} />
            <span>RightsRegistry.claim()</span>
            <ArrowRight size={15} color={claretSoft} />
            <span style={{ color: claretSoft }}>public ACTIVE state</span>
          </div>
          <p style={{ fontSize: 14, color: "#c9bfa6", margin: "14px 0 0", lineHeight: 1.55 }}>
            Strip the privacy layer and this is a public claims database: everyone reads the financing
            relationship. Privacy is what makes exclusivity commercially usable.
          </p>
        </section>

        {/* LOG + reset */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Landmark size={17} color={faded} /><span style={{ fontSize: 14, color: faded }}>Transition log</span>
            </div>
            <button onClick={reset} style={{ border: "none", background: "none", color: claret,
              cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>Reset</button>
          </div>
          <div style={{ background: "#e7e0cf", border: "1px solid #cbc0a6", padding: 14, minHeight: 70,
            fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", fontSize: 12.5, color: "#4a4436", lineHeight: 1.7 }}>
            {log.length === 0 ? <span style={{ color: faded }}>No transitions yet. Start with Bank A.</span>
              : log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </section>

      </div>
    </div>
  );
}

function StateBadge({ state }) {
  const map = {
    UNCLAIMED: { c: faded, bg: "#dcd3bd" },
    ACTIVE: { c: paper, bg: claret },
    CONSUMED: { c: paper, bg: ink },
  }[state];
  return (
    <span style={{ background: map.bg, color: map.c, padding: "6px 14px", fontSize: 13,
      letterSpacing: ".08em", borderRadius: 2, alignSelf: "flex-start" }}>{state}</span>
  );
}

function Actor({ label, sub, children }) {
  return (
    <div style={{ border: "1px solid #cbc0a6", padding: "18px 18px" }}>
      <div style={{ fontSize: 17, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, color: faded, margin: "2px 0 14px" }}>{sub}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

function Btn({ children, onClick, disabled, icon, primary, danger }) {
  const bg = danger ? claret : primary ? ink : "transparent";
  const fg = danger || primary ? paper : ink;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
      background: disabled ? "#d9d0ba" : bg, color: disabled ? faded : fg,
      border: `1px solid ${disabled ? "#cbc0a6" : bg === "transparent" ? "#9a8f74" : bg}`,
      padding: "10px 14px", fontSize: 14.5, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "inherit", borderRadius: 2 }}>
      {icon}{children}
    </button>
  );
}

function Projection({ viewer, state, holder }) {
  const rows = {
    public: [
      ["Right state", state, true],
      ["Slot identifier", "queryable with canonical id", true],
      ["Claimant", "hidden", false],
      ["Funding amount", "hidden", false],
      ["Counterparty", "hidden", false],
    ],
    holder: [
      ["Right state", state, true],
      ["This is my claim", holder ? "yes" : "-", true],
      ["Funding amount", "known to me", true],
      ["Settlement status", state === "CONSUMED" ? "settled" : "open", true],
    ],
    counterparty: [
      ["Obligation satisfied", state === "CONSUMED" ? "yes" : "not yet", true],
      ["Claimant identity", "hidden", false],
      ["Funding amount", "hidden", false],
    ],
    auditor: [
      ["Canonical right", "RCV-4821", true],
      ["Lifecycle", "registered -> active -> consumed", true],
      ["Claimant", "disclosed under scoped key", true],
      ["Funding note", "disclosed under scoped key", true],
      ["Timestamps", "disclosed under scoped key", true],
    ],
  }[viewer];
  return (
    <div style={{ border: "1px solid #cbc0a6" }}>
      {rows.map(([k, v, known], i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "11px 16px", borderTop: i ? "1px solid #ded4bd" : "none",
          background: i % 2 ? "#e9e2d1" : "#efe9dc" }}>
          <span style={{ fontSize: 14.5 }}>{k}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14,
            color: known ? ink : faded }}>
            {known ? <Eye size={14} color={claret} /> : <EyeOff size={14} color={faded} />}{v}
          </span>
        </div>
      ))}
    </div>
  );
}
