import Link from "next/link";
import { ArrowRight } from "lucide-react";

const wrap: React.CSSProperties = { maxWidth: 1000, margin: "0 auto", padding: "0 26px" };
const eyebrow: React.CSSProperties = { fontSize: 14, color: "var(--claret)", fontWeight: 600,
  fontStyle: "italic", marginBottom: 14 };
const thc: React.CSSProperties = { textAlign: "left", padding: "11px 14px", background: "var(--parch2)", fontWeight: 600, borderBottom: "1px solid var(--paper-line)" };
const tdc: React.CSSProperties = { textAlign: "left", padding: "11px 14px", borderBottom: "1px solid var(--paper-line)" };

export default function Home() {
  return (
    <main>
      <section style={{ ...wrap, padding: "76px 26px 56px" }}>
        <div style={eyebrow}>A single-use execution-right protocol on STRK20</div>
        <h1 style={{ fontSize: "clamp(40px,6vw,68px)", lineHeight: 1.04, maxWidth: "12ch",
          fontWeight: 600, letterSpacing: "-.015em", margin: 0 }}>
          One right. One financing. Enforced everywhere, without revealing who.
        </h1>
        <p style={{ fontSize: 20, color: "#413a2b", marginTop: 22, maxWidth: "52ch", lineHeight: 1.5 }}>
          Sole turns a financial right into a single-use execution right: claimed privately, it
          authorizes one real financing action, then is spent for good. Two lenders can never
          finance the same right, at any venue. The chain enforces it without learning the holder,
          the amount, or the relationship.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
          <Link href="/app" style={{ display: "inline-flex", alignItems: "center", gap: 9,
            background: "var(--ink)", color: "var(--parch)", padding: "12px 20px", borderRadius: 2,
            textDecoration: "none", fontSize: 16 }}>
            See a right get refused <ArrowRight size={17} />
          </Link>
          <Link href="/protocol" style={{ display: "inline-flex", alignItems: "center",
            border: "1px solid var(--ink)", padding: "12px 20px", borderRadius: 2,
            textDecoration: "none", color: "var(--ink)", fontSize: 16 }}>
            Read the protocol
          </Link>
        </div>
      </section>

      <section style={{ borderTop: "1px solid var(--rule)", padding: "56px 0" }}>
        <div style={wrap}>
          <div style={eyebrow}>How it works</div>
          <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-.015em", margin: "0 0 20px" }}>
            Three values. One is shared, two stay private.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", border: "1px solid var(--rule)" }}>
            {[
              ["01 - identity", "slot_key", "Poseidon(TAG_SLOT, canonical id). Deterministic, so any party derives the same key and collides. This is what makes a second claim fail."],
              ["02 - ownership", "claim_record", "Poseidon over the slot, a claimant secret, and a shielded funding note. Private. Only the holder can open it."],
              ["03 - consumption", "nullifier", "Burned once at settlement. Producing it needs the claimant secret, so only the holder settles - and never twice, at any venue."],
            ].map(([n, h, p2], i) => (
              <div key={i} style={{ padding: 22, borderRight: i < 2 ? "1px solid var(--rule)" : "none" }}>
                <div style={{ fontSize: 13, color: "var(--claret)", fontWeight: 600, marginBottom: 10 }}>{n}</div>
                <h3 style={{ fontSize: 18, margin: "0 0 8px" }}>{h}</h3>
                <p style={{ fontSize: 15, color: "#4a4231", margin: 0 }}>{p2}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "var(--faded)", marginTop: 14 }}>
            The public chain holds only <span className="mono">slot_key -&gt; state -&gt; commitment</span>. Never an identity, an amount, or a counterparty. Once consumed, the right is spent for every venue.
          </p>
        </div>
      </section>

      <section style={{ borderTop: "1px solid var(--rule)", padding: "56px 0" }}>
        <div style={wrap}>
          <div style={eyebrow}>The privacy boundary, stated plainly</div>
          <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-.015em", margin: "0 0 20px" }}>
            The enforcement state is public. The relationship is private.
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15, border: "1px solid var(--rule)" }}>
            <tbody>
              <tr><th style={thc}>Data</th><th style={thc}>Public</th><th style={thc}>Private</th></tr>
              {[
                ["Right state (unclaimed / active / consumed)", "shown", ""],
                ["Slot identifier", "queryable*", ""],
                ["Claimant identity", "", "hidden"],
                ["Funding amount", "", "shielded"],
                ["Claimant wallet", "", "anonymizer boundary"],
                ["Counterparty relationship", "", "hidden"],
              ].map(([d, pub, pri], i) => (
                <tr key={i}>
                  <td style={tdc}>{d}</td>
                  <td style={{ ...tdc, color: "var(--claret)", fontWeight: 600 }}>{pub}</td>
                  <td style={{ ...tdc, color: "var(--faded)" }}>{pri}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 13, color: "var(--faded)", marginTop: 12 }}>
            *Anyone holding the canonical id can read a right&apos;s state. Sole hides the economic relationship behind that state, not the fact that a known right is active.
          </p>
        </div>
      </section>
    </main>
  );
}
