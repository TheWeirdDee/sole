import Link from "next/link";

const wrap: React.CSSProperties = { maxWidth: 1000, margin: "0 auto", padding: "44px 26px" };
const eyebrow: React.CSSProperties = { fontSize: 14, color: "var(--claret)", fontStyle: "italic", marginBottom: 14 };
const flow: React.CSSProperties = {
  fontFamily: "ui-monospace,Menlo,monospace", fontSize: 13.5, lineHeight: 1.9,
  background: "var(--ink)", color: "var(--parch)", padding: "22px 24px",
  overflowX: "auto", whiteSpace: "pre", borderRadius: 2,
};
const c = { color: "var(--gilt)" };
const rr = { color: "var(--claret-soft)" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 15, border: "1px solid var(--rule)" };
const th: React.CSSProperties = { textAlign: "left", padding: "11px 14px", background: "var(--parch2)", fontWeight: 600, borderBottom: "1px solid var(--paper-line)" };
const td: React.CSSProperties = { textAlign: "left", padding: "11px 14px", borderBottom: "1px solid var(--paper-line)", verticalAlign: "top" };

export default function Protocol() {
  return (
    <main style={wrap}>
      <div style={eyebrow}>Protocol</div>
      <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-.015em", margin: 0 }}>
        One right, one gated adapter action, consumed once — the machine underneath.
      </h1>

      <h2 style={{ fontSize: 22, fontWeight: 600, margin: "34px 0 12px" }}>Shipped states</h2>
      <div style={flow}>
        {`        register_right()
   ( - ) --------------> `}<span style={c}>UNCLAIMED</span>{`
                          | claim(commitment)        [assert UNCLAIMED]
                          v
                        `}<span style={c}>ACTIVE</span>{`
                          | settle(nullifier)        [assert ACTIVE, nullifier fresh]
                          v
                       `}<span style={c}>CONSUMED</span>{`  (terminal)

  forbidden, each asserted and tested:
    ACTIVE     --claim-->   `}<span style={rr}>REVERT RIGHT_ALREADY_ACTIVE</span>{`   <- the invariant
    CONSUMED   --claim-->   `}<span style={rr}>REVERT RIGHT_ALREADY_ACTIVE</span>{`
    UNCLAIMED  --settle-->  `}<span style={rr}>REVERT RIGHT_NOT_ACTIVE</span>{`
    consumed slot --settle--> `}<span style={rr}>REVERT RIGHT_NOT_ACTIVE</span>{`
    reused nullifier on another ACTIVE slot --> `}<span style={rr}>REVERT NULLIFIER_ALREADY_SPENT</span>{`
    (wallet)   --any-->     `}<span style={rr}>REVERT CALLER_NOT_ANONYMIZER</span>{`
    (shared-registry adapter, non-ACTIVE) --finance--> `}<span style={rr}>REVERT AUTH_RIGHT_NOT_ACTIVE</span>
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 600, margin: "34px 0 12px" }}>The invariant</h2>
      <div style={flow}>
        {`for every slot_key:
    state in {UNCLAIMED, ACTIVE, CONSUMED}
    state = ACTIVE   => exactly one valid claim commitment
    state = CONSUMED => no new claim may become ACTIVE
    shared-registry adapter + non-ACTIVE => finance reverts
and:
    named claimant, raw amount, counterparty  not in public registry state`}
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 600, margin: "34px 0 12px" }}>Assumptions we state, not hide</h2>
      <table style={tableStyle}>
        <tbody>
          <tr><th style={th}>Assumption</th><th style={th}>Stance</th></tr>
          <tr><td style={td}>A canonical id maps to one real right (no double-minting)</td><td style={td}>MVP: first-registration-wins. Production: attester-signed root.</td></tr>
          <tr><td style={td}>Anyone with the canonical id can read a right&apos;s state</td><td style={td}>By design. Low-entropy ids are enumerable; see the privacy boundary for the transaction footprint.</td></tr>
          <tr><td style={td}>Bundled deposit and transition can be correlated</td><td style={td}>Recorded receipts link an indexed depositor, pool invoke, and slot in one transaction. Registry caller separation is not wallet anonymity.</td></tr>
          <tr><td style={td}>Second independent venue</td><td style={td}>The source/test gate is shared-registry based. The deployed second adapter is not yet verified as an independent venue.</td></tr>
          <tr><td style={td}>Contracts are ownerless and unaudited</td><td style={td}>A finding means a redeploy, not a patch. Adversarial coverage is not an audit.</td></tr>
        </tbody>
      </table>
      <p style={{ fontSize: 13.5, color: "var(--faded)", marginTop: 10 }}>
        The two privacy-related rows above are a summary. The complete privacy boundary and what it does not claim:{" "}
        <a
          href="https://github.com/TheWeirdDee/sole/blob/main/docs/PRIVACY_BOUNDARY.md"
          target="_blank" rel="noopener noreferrer" style={{ color: "var(--claret)" }}
        >
          docs/PRIVACY_BOUNDARY.md
        </a>
        . The broader non-claims list and the real problems hit building this:{" "}
        <Link href="/docs" style={{ color: "var(--claret)" }}>the Docs page</Link>.
      </p>

      <p style={{ fontSize: 13.5, color: "var(--faded)", marginTop: 10 }}>
        The shared-registry adapter line above is source-and-test evidence, not a recorded mainnet
        cross-venue rejection. The deployed fallback adapter records and clears an opaque position;
        it does not demonstrate a loan, asset transfer, or external-market integration.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, margin: "34px 0 12px" }}>Roadmap, documented not shipped</h2>
      <p style={{ fontSize: 19, color: "#413a2b", maxWidth: 660 }}>
        ACTIVE to EXPIRED (deadline), ACTIVE to CANCELLED (holder aborts),
        ACTIVE to PARTIALLY_SETTLED to CONSUMED. Interface and spec only. Three clean states on
        mainnet beat six half-working ones.
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
        <Link href="/app" style={{ background: "var(--ink)", color: "var(--parch)", padding: "12px 20px", borderRadius: 2, textDecoration: "none" }}>Run the demo</Link>
        <Link href="/verify" style={{ border: "1px solid var(--ink)", padding: "12px 20px", borderRadius: 2, textDecoration: "none", color: "var(--ink)" }}>Verify on chain</Link>
      </div>
    </main>
  );
}
