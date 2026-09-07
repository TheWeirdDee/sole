"use client";
import { useState } from "react";
import { verifyTx, type VerifyResult } from "../../lib/verify";
import claims from "../../../../evidence/claims.json";

const wrap: React.CSSProperties = { maxWidth: 1000, margin: "0 auto", padding: "44px 26px" };
const eyebrow: React.CSSProperties = { fontSize: 14, color: "var(--claret)", fontStyle: "italic", marginBottom: 14 };
const logBox: React.CSSProperties = {
  background: "#e2d9c2", border: "1px solid var(--rule)", padding: 14,
  fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, color: "#4a4436",
  lineHeight: 1.75, minHeight: 64, marginTop: 16, whiteSpace: "pre-wrap",
};

function renderResult(r: VerifyResult): string {
  const lines = [`verifying ${r.txHash}`, ...r.lines.map((l) => `  ${l.ok ? "ok" : "XX"}  ${l.label}`)];
  return lines.join("\n");
}

const mostRecentHash = (): string | undefined => {
  const txs = (claims as any).transactions;
  return txs?.[txs.length - 1]?.hash;
};

export default function Verify() {
  const [txin, setTxin] = useState("");
  const [log, setLog] = useState("Waiting. Try “Verify all”.");
  const [busy, setBusy] = useState(false);

  const verifyOne = async (overrideHash?: string) => {
    const target = (overrideHash ?? txin).trim();
    if (!target) { setLog("enter a transaction hash"); return; }
    if (overrideHash) setTxin(overrideHash);
    setBusy(true);
    setLog(`verifying ${target} ...`);
    try {
      const r = await verifyTx(target);
      setLog(renderResult(r));
    } catch (e: any) {
      setLog(`error: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  const verifyAll = async () => {
    const hashes: string[] = (claims as any).transactions?.map((t: any) => t.hash) ?? [];
    if (hashes.length === 0) {
      setLog(
        "no transactions recorded in evidence/claims.json yet.\n" +
        "Contracts are deployed and wired (see the mainnet deployments table on the Overview page),\n" +
        "but the pool-touching transactions (claim/finance/settle) haven't been run through a live\n" +
        "wallet session yet. Nothing to replay here - this view reads real data, not a canned demo."
      );
      return;
    }
    setBusy(true);
    const out: string[] = [];
    let okCount = 0, total = 0;
    for (const h of hashes) {
      try {
        const r = await verifyTx(h);
        out.push(renderResult(r), "");
        total++;
        if (r.lines.every((l) => l.ok)) okCount++;
      } catch (e: any) {
        out.push(`verifying ${h}\n  XX  ${e?.message ?? e}`, "");
      }
    }
    out.push(`verified ${okCount}/${total} transactions clean from chain`);
    setLog(out.join("\n"));
    setBusy(false);
  };

  return (
    <main style={wrap}>
      <div style={eyebrow}>Verify · nothing here is self-reported</div>
      <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-.015em", margin: 0 }}>
        Reconstruct each transition from chain.
      </h1>
      <p style={{ fontSize: 19, color: "#413a2b", maxWidth: 660, marginTop: 12 }}>
        Paste a transaction hash, or run the whole recorded set. The verifier re-reads the receipt
        from a mainnet RPC, confirms it was emitted by the Sole registry, checks it routed through
        the anonymizer, and decodes the transition it must represent. A refusal must have moved no
        state.
      </p>

      <div style={{ border: "1px solid var(--rule)", background: "var(--parch2)", padding: 26, marginTop: 26 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input value={txin} onChange={(e) => setTxin(e.target.value)} placeholder="0x... transaction hash"
            disabled={busy}
            style={{ flex: 1, minWidth: 240, padding: "12px 14px", border: "1px solid var(--rule)",
              background: "#efe8d6", fontFamily: "ui-monospace,Menlo,monospace", fontSize: 13, color: "var(--ink)" }} />
          <button onClick={() => verifyOne()} disabled={busy} style={{ background: "var(--ink)", color: "var(--parch)", padding: "12px 20px", border: "none", borderRadius: 2, cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 15 }}>Verify hash</button>
          <button onClick={verifyAll} disabled={busy} style={{ background: "transparent", color: "var(--ink)", padding: "12px 20px", border: "1px solid var(--ink)", borderRadius: 2, cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 15 }}>Verify all</button>
        </div>
        {mostRecentHash() && (
          <button
            onClick={() => verifyOne(mostRecentHash())}
            disabled={busy}
            style={{
              display: "block", marginTop: 10, border: "none", background: "none", padding: 0,
              color: "var(--claret)", cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 13,
            }}
          >
            No hash on hand? Try the most recent recorded transaction ({mostRecentHash()!.slice(0, 10)}…)
          </button>
        )}
        <div style={logBox}>{log}</div>
      </div>
      <p style={{ fontSize: 13, color: "var(--faded)", marginTop: 12 }}>
        Same logic as <span className="mono">scripts/verify-mainnet.ts</span>, reading a mainnet RPC
        directly from the browser - not a replay of recorded evidence.
      </p>
    </main>
  );
}
