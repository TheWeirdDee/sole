"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { provider } from "../../lib/sole";
import claims from "../../../../evidence/claims.json";

const wrap: React.CSSProperties = { maxWidth: 1000, margin: "0 auto", padding: "44px 26px 60px" };
const eyebrow: React.CSSProperties = { fontSize: 14, color: "var(--claret)", fontStyle: "italic", marginBottom: 14 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14.5, border: "1px solid var(--rule)" };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 13px", background: "var(--parch2)", fontWeight: 600, borderBottom: "1px solid var(--paper-line)" };
const td: React.CSSProperties = { textAlign: "left", padding: "10px 13px", borderBottom: "1px solid var(--paper-line)", verticalAlign: "top" };
const h2: React.CSSProperties = { fontSize: 22, fontWeight: 600, margin: "40px 0 6px" };
const sub: React.CSSProperties = { fontSize: 14, color: "var(--faded)", marginBottom: 14, lineHeight: 1.5 };
const ol: React.CSSProperties = { fontSize: 15, lineHeight: 1.7, paddingLeft: 22, margin: 0 };
const linkStyle: React.CSSProperties = { color: "var(--claret)" };
const code: React.CSSProperties = { background: "var(--parch2)", padding: "1px 6px", borderRadius: 2, fontFamily: "ui-monospace,Menlo,monospace", fontSize: "0.88em" };

// Regenerated from evidence/claims.json's own text, not restated by hand -
// a status here can only be as stale as that file, never independently wrong.
function claimStatus(evidence: string): { label: string; color: string } {
  const e = evidence.toLowerCase();
  if (e.includes("not yet exercised live") || e.includes("timed out") || e.includes("without a conclusive")) {
    return { label: "Pending (tests only)", color: "var(--faded)" };
  }
  if (e.includes("mainnet") || e.includes("verify-mainnet")) return { label: "Proven (mainnet)", color: "var(--claret)" };
  return { label: "Proven (tests)", color: "var(--ink)" };
}

interface TxRow { hash: string; kind: string; status: "loading" | "ok" | "error"; feeSTRK?: string; execStatus?: string }

export default function Docs() {
  const [txs, setTxs] = useState<TxRow[]>(
    (claims as any).transactions.map((t: any) => ({ hash: t.hash, kind: t.kind, status: "loading" as const })),
  );

  // Live receipt fees, not hardcoded: a fee copied into a doc goes stale the
  // moment the pool's fee schedule changes; reading it from the actual
  // receipt on every page load cannot.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await Promise.all(
        (claims as any).transactions.map(async (t: any): Promise<TxRow> => {
          try {
            const receipt: any = await provider.getTransactionReceipt(t.hash);
            const feeRaw = receipt.actual_fee?.amount ?? receipt.actual_fee;
            const feeSTRK = feeRaw != null ? (Number(BigInt(feeRaw)) / 1e18).toFixed(4) : undefined;
            return { hash: t.hash, kind: t.kind, status: "ok", feeSTRK, execStatus: receipt.execution_status ?? receipt.finality_status };
          } catch {
            return { hash: t.hash, kind: t.kind, status: "error" };
          }
        }),
      );
      if (!cancelled) setTxs(rows);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <main style={wrap}>
      <div style={eyebrow}>Docs · what&apos;s proven, what isn&apos;t</div>
      <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-.015em", margin: 0 }}>
        The evidence, what Sole doesn&apos;t claim, and what actually went wrong building it.
      </h1>
      <p style={{ fontSize: 18, color: "#413a2b", maxWidth: 700, marginTop: 12, lineHeight: 1.55 }}>
        Protocol describes the machine. This page is about the machine&apos;s actual state today: what a command or a
        chain read confirms right now, what doesn&apos;t hold, and the real problems that surfaced getting here.
      </p>

      <h2 style={h2}>Evidence ledger</h2>
      <p style={sub}>
        Regenerate independently: <code style={code}>node --experimental-strip-types scripts/verify-mainnet.ts --all</code>,
        or use the <Link href="/verify" style={linkStyle}>Verify page</Link> to re-check any hash from your own browser.
        A status of &quot;Proven (mainnet)&quot; below means a real, independently-checkable transaction exists for it —
        not that the invariant has been demonstrated in every direction (see Non-claims, item 5).
      </p>
      <table style={tableStyle}>
        <tbody>
          <tr><th style={th}>Id</th><th style={th}>Claim</th><th style={th}>Status</th></tr>
          {(claims as any).claims.map((c: any) => {
            const st = claimStatus(c.evidence);
            return (
              <tr key={c.id}>
                <td style={{ ...td, fontFamily: "ui-monospace,Menlo,monospace", fontSize: 13 }}>{c.id}</td>
                <td style={td}>{c.claim}</td>
                <td style={{ ...td, color: st.color, fontWeight: 600 }}>{st.label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2 style={{ ...h2, fontSize: 18, marginTop: 26 }}>Mainnet transactions, fees read live from each receipt</h2>
      <table style={tableStyle}>
        <tbody>
          <tr><th style={th}>Hash</th><th style={th}>Kind</th><th style={th}>Status</th><th style={th}>Fee (STRK)</th></tr>
          {txs.map((t) => (
            <tr key={t.hash}>
              <td style={{ ...td, fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12.5 }}>
                <a href={`https://voyager.online/tx/${t.hash}`} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  {t.hash.slice(0, 10)}…{t.hash.slice(-6)}
                </a>
              </td>
              <td style={td}>{t.kind}</td>
              <td style={{ ...td, color: t.status === "error" ? "var(--claret)" : "inherit" }}>
                {t.status === "loading" ? "reading…" : t.status === "error" ? "could not read receipt" : t.execStatus}
              </td>
              <td style={td}>{t.feeSTRK ?? (t.status === "loading" ? "…" : "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={h2}>Non-claims</h2>
      <p style={sub}>
        The complete list, updated independently of this page:{" "}
        <a href="https://github.com/TheWeirdDee/sole/blob/main/docs/NON_CLAIMS.md" target="_blank" rel="noopener noreferrer" style={linkStyle}>
          docs/NON_CLAIMS.md
        </a>.
      </p>
      <ol style={ol}>
        <li>Does not prove a real-world receivable exists — a canonical id is an arbitrary reference string.</li>
        <li>Does not hide that a known right is active — only the relationship behind that state is private.</li>
        <li>Does not hide timing, or that a state transition happened.</li>
        <li>The canonical-id-to-right mapping is first-registration-wins, not attester-signed, in the shipped MVP.</li>
        <li><code style={code}>finance()</code> and <code style={code}>settleAndRepay()</code> are proven on mainnet; a live duplicate-claim revert and a live cross-venue revert are not — proven in tests only.</li>
        <li>Does not implement <code style={code}>EXPIRED</code>, <code style={code}>CANCELLED</code>, or <code style={code}>PARTIALLY_SETTLED</code> — interface and spec only.</li>
        <li>Contracts are unaudited, ownerless, and not upgradeable. A finding means a redeploy, not a patch.</li>
        <li>Experimental, hackathon-stage software — not production-ready infrastructure.</li>
      </ol>

      <h2 style={h2}>Friction log</h2>
      <p style={sub}>
        The real blockers hit building this, condensed. Full detail, including what was tried and why each fix works:{" "}
        <a href="https://github.com/TheWeirdDee/sole/blob/main/docs/FRICTION_LOG.md" target="_blank" rel="noopener noreferrer" style={linkStyle}>
          docs/FRICTION_LOG.md
        </a>.
      </p>
      <table style={tableStyle}>
        <tbody>
          <tr><th style={th}>Problem</th><th style={th}>Resolution</th></tr>
          {[
            ["snforge 0.63.0's Cairo test plugin fails to build (bad transitive extern ABI)", "pinned snforge_std to 0.62.1"],
            ["Wallet API rejects zero-padded felt addresses", "normalize every felt before it reaches the wallet"],
            ["A bare invoke-only actions array is rejected outright", "pair every invoke with a real value-moving deposit"],
            ["NOT_REGISTERED on first STRK20 use, despite the spec calling registration “transparent”", "documented as a required one-time wallet step, not papered over"],
            ["A confirmed transaction could silently omit the invoke it was supposed to run", "verify the exact expected event, never trust “no error” alone"],
            ["A genuine Cairo revert was misread as a dropped invoke and retried", "check execution_status first, before inferring anything"],
            ["Automatic retry after a suspected drop caused its own wallet-level failures", "removed all automatic retry; caller must reconcile state first"],
            ["A “self-paid, no paymaster” bypass was built on a wallet API misreading and never worked", "removed rather than left looking functional"],
            ["Root cause: state_of() decoded a Cairo enum as a number, silently defaulting to UNCLAIMED", "decode the real enum variant; verify exact events, not decoded state"],
            ["Dependent private actions submitted back-to-back can fail (proof base too fresh)", "wait 11 L2 blocks between dependent private actions"],
            ["waitForTransaction({retries}) does not bound a truly hung RPC fetch", "added a real timer-based timeout independent of the retry count"],
            ["The public Lava RPC endpoint now returns HTTP 410 Gone", "repointed the default to a working public endpoint"],
          ].map(([p, r], i) => (
            <tr key={i}><td style={td}>{p}</td><td style={td}>{r}</td></tr>
          ))}
        </tbody>
      </table>

      <h2 style={h2}>Privacy</h2>
      <p style={{ fontSize: 15, lineHeight: 1.6, maxWidth: 700 }}>
        The single source of truth for every privacy claim, including what stays public and what Sole
        explicitly does not claim about privacy:{" "}
        <a href="https://github.com/TheWeirdDee/sole/blob/main/docs/PRIVACY_BOUNDARY.md" target="_blank" rel="noopener noreferrer" style={linkStyle}>
          docs/PRIVACY_BOUNDARY.md
        </a>. Every other page on this site summarizes it; this is the version that decides.
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 34, flexWrap: "wrap" }}>
        <Link href="/verify" style={{ background: "var(--ink)", color: "var(--parch)", padding: "12px 20px", borderRadius: 2, textDecoration: "none" }}>Verify a transaction</Link>
        <Link href="/protocol" style={{ border: "1px solid var(--ink)", padding: "12px 20px", borderRadius: 2, textDecoration: "none", color: "var(--ink)" }}>Read the protocol</Link>
      </div>
    </main>
  );
}
