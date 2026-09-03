import Link from "next/link";
import { ArrowRight } from "lucide-react";

const wrap: React.CSSProperties = { maxWidth: 1000, margin: "0 auto", padding: "0 26px" };
const eyebrow: React.CSSProperties = { fontSize: 14, color: "var(--claret)", fontWeight: 600,
  fontStyle: "italic", marginBottom: 14 };

export default function Home() {
  return (
    <main>
      <section style={{ ...wrap, padding: "76px 26px 56px" }}>
        <div style={eyebrow}>A privacy-preserving exclusivity protocol on STRK20</div>
        <h1 style={{ fontSize: "clamp(40px,6vw,68px)", lineHeight: 1.04, maxWidth: "12ch",
          fontWeight: 600, letterSpacing: "-.015em", margin: 0 }}>
          A right, held by one party, without revealing who.
        </h1>
        <p style={{ fontSize: 20, color: "#413a2b", marginTop: 22, maxWidth: "52ch", lineHeight: 1.5 }}>
          Sole makes an economic right privately ownable and publicly enforceable. The chain proves
          the right can be claimed exactly once. It never learns the claimant, the amount, or the
          relationship behind it.
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
          <div style={eyebrow}>The privacy boundary, stated plainly</div>
          <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-.015em", margin: "0 0 8px" }}>
            The enforcement state is public. The relationship is private.
          </h2>
          <p style={{ fontSize: 19, color: "#413a2b", maxWidth: 660, marginBottom: 22 }}>
            Sole hides the economic relationship behind a right&apos;s state, not the fact that a
            known right is active. Full markup for every surface — hero seal animation, the demo
            flow, verify, and protocol — is in <span className="mono">apps/web/preview.html</span>,
            the canonical design. Port each route into components here.
          </p>
        </div>
      </section>
    </main>
  );
}
