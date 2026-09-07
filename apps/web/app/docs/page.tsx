"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { provider } from "../../lib/sole";
import claims from "../../../../evidence/claims.json";

const wrap: React.CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "44px 26px 60px" };
const eyebrow: React.CSSProperties = { fontSize: 14, color: "var(--claret)", fontStyle: "italic", marginBottom: 14 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14.5, border: "1px solid var(--rule)" };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 13px", background: "var(--parch2)", fontWeight: 600, borderBottom: "1px solid var(--paper-line)" };
const td: React.CSSProperties = { textAlign: "left", padding: "10px 13px", borderBottom: "1px solid var(--paper-line)", verticalAlign: "top" };
const h2: React.CSSProperties = { fontSize: 22, fontWeight: 600, margin: "40px 0 6px" };
const sub: React.CSSProperties = { fontSize: 14, color: "var(--faded)", marginBottom: 14, lineHeight: 1.5 };
const ol: React.CSSProperties = { fontSize: 15, lineHeight: 1.7, paddingLeft: 22, margin: 0 };
const linkStyle: React.CSSProperties = { color: "var(--claret)" };
const code: React.CSSProperties = { background: "var(--parch2)", padding: "1px 6px", borderRadius: 2, fontFamily: "ui-monospace,Menlo,monospace", fontSize: "0.88em" };

type LedgerClaim = {
  id: string;
  status: "proven" | "pending";
  scope: string;
  claim: string;
  regenerate: string;
};

type LedgerTx = {
  hash: string;
  kind: string;
  actual_fee_fri: string;
  pool_deposit_fri: string | null;
  pool_fee_withdrawal_fri: string | null;
};

type TxRow = LedgerTx & { status: "loading" | "ok" | "error"; feeSTRK?: string; execStatus?: string };

function formatFri(value: unknown): string {
  const amount = BigInt(value as string);
  const unit = 1_000_000_000_000_000_000n;
  const whole = amount / unit;
  const fraction = (amount % unit).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction} STRK` : `${whole} STRK`;
}

function claimStatus(claim: LedgerClaim): { label: string; color: string } {
  return claim.status === "proven"
    ? { label: `Proven — ${claim.scope}`, color: "var(--claret)" }
    : { label: `Pending — ${claim.scope}`, color: "var(--faded)" };
}

export default function Docs() {
  const transactions = (claims as { transactions: LedgerTx[] }).transactions;
  const ledgerClaims = (claims as { claims: LedgerClaim[] }).claims;
  const [txs, setTxs] = useState<TxRow[]>(
    transactions.map((tx) => ({ ...tx, status: "loading" })),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await Promise.all(transactions.map(async (tx): Promise<TxRow> => {
        try {
          const receipt: any = await provider.getTransactionReceipt(tx.hash);
          const feeRaw = receipt.actual_fee?.amount ?? receipt.actual_fee;
          return {
            ...tx,
            status: "ok",
            feeSTRK: feeRaw == null ? undefined : formatFri(feeRaw),
            execStatus: receipt.execution_status ?? receipt.finality_status,
          };
        } catch {
          return { ...tx, status: "error" };
        }
      }));
      if (!cancelled) setTxs(rows);
    })();
    return () => { cancelled = true; };
  }, [transactions]);

  return (
    <main style={wrap}>
      <div style={eyebrow}>Docs · evidence, limits, and integration friction</div>
      <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-.015em", margin: 0 }}>
        What Sole proves, what it does not, and how to re-check it.
      </h1>
      <p style={{ fontSize: 18, color: "#413a2b", maxWidth: 760, marginTop: 12, lineHeight: 1.55 }}>
        Protocol describes the state machine. This page is the operational ledger: explicit claim statuses,
        receipt facts read live where the browser can reach an RPC, and the limits that keep a prototype from
        being described as more than it is.
      </p>

      <h2 style={h2}>Evidence ledger</h2>
      <p style={sub}>
        A claim is <strong>Proven</strong> only within its stated scope and only after its command re-runs cleanly.
        A <strong>Pending</strong> claim has no recorded mainnet artifact for the asserted direction. Full markdown
        ledger: {" "}
        <a href="https://github.com/TheWeirdDee/sole/blob/main/docs/EVIDENCE_LEDGER.md" target="_blank" rel="noopener noreferrer" style={linkStyle}>
          docs/EVIDENCE_LEDGER.md
        </a>.
      </p>
      <table style={tableStyle}>
        <tbody>
          <tr><th style={th}>ID</th><th style={th}>Claim</th><th style={th}>Status</th><th style={th}>Regenerate</th></tr>
          {ledgerClaims.map((claim) => {
            const status = claimStatus(claim);
            return (
              <tr key={claim.id}>
                <td style={{ ...td, fontFamily: "ui-monospace,Menlo,monospace", fontSize: 13 }}>{claim.id}</td>
                <td style={td}>{claim.claim}</td>
                <td style={{ ...td, color: status.color, fontWeight: 600 }}>{status.label}</td>
                <td style={{ ...td, fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12 }}>{claim.regenerate}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2 style={{ ...h2, fontSize: 18, marginTop: 26 }}>Recorded receipts — fees read live</h2>
      <p style={sub}>
        <code style={code}>actual_fee</code>, public pool deposits, and pool fee withdrawals are different receipt
        fields. The browser re-reads <code style={code}>actual_fee</code> below; the verification command also
        checks the recorded pool-event values. None is a current wallet quote or a universal per-action price.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <tbody>
            <tr><th style={th}>Hash</th><th style={th}>Kind</th><th style={th}>Live status</th><th style={th}>Actual L2 fee</th><th style={th}>Recorded public deposit</th><th style={th}>Recorded pool withdrawal</th></tr>
            {txs.map((tx) => (
              <tr key={tx.hash}>
                <td style={{ ...td, fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12.5 }}>
                  <a href={`https://voyager.online/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    {tx.hash.slice(0, 10)}…{tx.hash.slice(-6)}
                  </a>
                </td>
                <td style={td}>{tx.kind}</td>
                <td style={{ ...td, color: tx.status === "error" ? "var(--claret)" : "inherit" }}>
                  {tx.status === "loading" ? "reading…" : tx.status === "error" ? "could not read receipt" : tx.execStatus}
                </td>
                <td style={{ ...td, fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12 }}>{tx.feeSTRK ?? (tx.status === "loading" ? "…" : "—")}</td>
                <td style={td}>{tx.pool_deposit_fri == null ? "—" : formatFri(tx.pool_deposit_fri)}</td>
                <td style={td}>{tx.pool_fee_withdrawal_fri == null ? "—" : formatFri(tx.pool_fee_withdrawal_fri)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={h2}>Non-claims</h2>
      <p style={sub}>
        The full numbered list: {" "}
        <a href="https://github.com/TheWeirdDee/sole/blob/main/docs/NON_CLAIMS.md" target="_blank" rel="noopener noreferrer" style={linkStyle}>
          docs/NON_CLAIMS.md
        </a>.
      </p>
      <ol style={ol}>
        <li>Does not prove a canonical reference is a real-world right.</li>
        <li>Does not hide that a known right is ACTIVE or CONSUMED.</li>
        <li>Does not provide wallet unlinkability in the recorded bundled deposit-plus-invoke receipts.</li>
        <li>Does not prove a loan, asset transfer, credit issuance, external-market integration, or economic repayment.</li>
        <li>Does not have a recorded mainnet duplicate-claim or cross-venue rejection receipt.</li>
        <li>Does not implement auditor keys, counterparty access control, or scoped disclosure.</li>
        <li>Is unaudited experimental software.</li>
      </ol>

      <h2 style={h2}>Friction log</h2>
      <p style={sub}>
        Full detail, including what was observed and how the app now contains it: {" "}
        <a href="https://github.com/TheWeirdDee/sole/blob/main/docs/FRICTION_LOG.md" target="_blank" rel="noopener noreferrer" style={linkStyle}>
          docs/FRICTION_LOG.md
        </a>.
      </p>
      <table style={tableStyle}>
        <tbody>
          <tr><th style={th}>Observed friction</th><th style={th}>Current handling</th></tr>
          {[
            ["Cairo test-toolchain dependency failure", "pin compatible test dependency; rerun before claiming a fresh test pass"],
            ["Universal deployer changes constructor caller", "pass and store the intended deployer explicitly"],
            ["Wallet privacy actions require an injected browser wallet", "no headless or server-side user-wallet claim"],
            ["Standalone invoke result was overgeneralized", "invoke-only is the default; legacy deposit shape is explicit and unproven as a universal fix"],
            ["Wallet could confirm a deposit while omitting invoke", "verify exact expected registry or adapter event"],
            ["Sponsor rejects predicted reverts", "negative paths use free public-state checks, not paid blind retries"],
            ["Fresh private-proof state can be unavailable", "wait 11 L2 blocks before a dependent action"],
            ["Fallback events were described as real financing", "describe them as opaque position bookkeeping only"],
            ["Public pool deposit correlates wallet and slot", "remove wallet-unlinkability claim; link the privacy boundary"],
          ].map(([problem, resolution]) => (
            <tr key={problem}><td style={td}>{problem}</td><td style={td}>{resolution}</td></tr>
          ))}
        </tbody>
      </table>

      <h2 style={h2}>Privacy source of truth</h2>
      <p style={{ fontSize: 15, lineHeight: 1.6, maxWidth: 760 }}>
        Every privacy claim is bounded by {" "}
        <a href="https://github.com/TheWeirdDee/sole/blob/main/docs/PRIVACY_BOUNDARY.md" target="_blank" rel="noopener noreferrer" style={linkStyle}>
          docs/PRIVACY_BOUNDARY.md
        </a>. It distinguishes registry-caller separation from the recorded receipt-level wallet-to-slot correlation.
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 34, flexWrap: "wrap" }}>
        <Link href="/verify" style={{ background: "var(--ink)", color: "var(--parch)", padding: "12px 20px", borderRadius: 2, textDecoration: "none" }}>Verify a transaction</Link>
        <Link href="/protocol" style={{ border: "1px solid var(--ink)", padding: "12px 20px", borderRadius: 2, textDecoration: "none", color: "var(--ink)" }}>Read the protocol</Link>
      </div>
    </main>
  );
}
