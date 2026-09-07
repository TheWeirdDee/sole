"use client";

import Link from "next/link";
import { ExternalLink, Terminal, FileCode2, Layers, BookOpen } from "lucide-react";

function GithubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ display: "inline-block" }}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function Footer() {
  const GITHUB_REPO = "https://github.com/TheWeirdDee/sole";

  return (
    <footer
      style={{
        borderTop: "1px solid var(--rule)",
        background: "#16130d",
        color: "var(--parch)",
        padding: "68px 0 44px",
        fontFamily: "'Spectral', Georgia, serif",
      }}
    >
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "0 26px" }}>
        {/* Top Info Banner */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 24,
            paddingBottom: 40,
            borderBottom: "1px solid rgba(202, 189, 157, 0.15)",
            marginBottom: 44,
          }}
        >
          <div style={{ maxWidth: 480 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
              <span
                style={{
                  fontFamily: "ui-monospace,Menlo,monospace",
                  fontWeight: 700,
                  fontSize: 22,
                  letterSpacing: "0.04em",
                  color: "#e9e1ce",
                }}
              >
                SOLE
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: "rgba(124, 29, 42, 0.4)",
                  border: "1px solid rgba(124, 29, 42, 0.7)",
                  color: "#f5c2c7",
                  fontFamily: "ui-monospace,Menlo,monospace",
                }}
              >
                STRK20 · Mainnet
              </span>
            </div>
            <p style={{ fontSize: 15, color: "#a89f88", lineHeight: 1.55, margin: 0 }}>
              A single-use execution-right prototype on Starknet. The deployed adapter records and clears an opaque
              position under a public lifecycle gate; it does not originate credit or transfer assets.
            </p>
          </div>

          {/* GitHub CTA Button */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: "var(--claret)",
                color: "var(--parch)",
                padding: "10px 20px",
                borderRadius: 2,
                textDecoration: "none",
                fontSize: 14.5,
                fontWeight: 600,
                transition: "background 0.2s ease, transform 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#9a2434")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--claret)")}
            >
              <GithubIcon size={18} /> View on GitHub <ExternalLink size={14} />
            </a>
            <span style={{ fontSize: 12, color: "#8a816c", fontFamily: "ui-monospace,Menlo,monospace" }}>
              Apache-2.0 · Open Source
            </span>
          </div>
        </div>

        {/* 4-Column Navigation Links */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 36,
            marginBottom: 48,
          }}
        >
          {/* Col 1: Protocol & Research */}
          <div>
            <div
              style={{
                fontSize: 12.5,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--gilt, #cabd9d)",
                fontWeight: 600,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "ui-monospace,Menlo,monospace",
              }}
            >
              <BookOpen size={14} /> Protocol &amp; Specs
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <li>
                <a
                  href={`${GITHUB_REPO}/blob/main/CO_DESIGN.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  CO_DESIGN.md <span style={subtextStyle}>Design analysis</span>
                </a>
              </li>
              <li>
                <a
                  href={`${GITHUB_REPO}/blob/main/docs/PRIVACY_BOUNDARY.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  PRIVACY_BOUNDARY.md <span style={subtextStyle}>Leaks vs hidden</span>
                </a>
              </li>
              <li>
                <a
                  href={`${GITHUB_REPO}/blob/main/docs/STATE_MACHINE.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  STATE_MACHINE.md <span style={subtextStyle}>Lifecycle rules</span>
                </a>
              </li>
              <li>
                <a
                  href={`${GITHUB_REPO}/blob/main/THREAT_MODEL.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  THREAT_MODEL.md <span style={subtextStyle}>Threat analysis</span>
                </a>
              </li>
              <li>
                <a
                  href={`${GITHUB_REPO}/blob/main/README.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  README.md <span style={subtextStyle}>Overview &amp; setup</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Col 2: Cairo Smart Contracts */}
          <div>
            <div
              style={{
                fontSize: 12.5,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--gilt, #cabd9d)",
                fontWeight: 600,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "ui-monospace,Menlo,monospace",
              }}
            >
              <FileCode2 size={14} /> Cairo Contracts
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <li>
                <a
                  href={`${GITHUB_REPO}/blob/main/contracts/src/rights_registry.cairo`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  rights_registry.cairo <span style={subtextStyle}>Slot state machine</span>
                </a>
              </li>
              <li>
                <a
                  href={`${GITHUB_REPO}/blob/main/contracts/src/claim_anonymizer.cairo`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  claim_anonymizer.cairo <span style={subtextStyle}>privacy_invoke</span>
                </a>
              </li>
              <li>
                <a
                  href={`${GITHUB_REPO}/blob/main/contracts/src/execution_adapter.cairo`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  execution_adapter.cairo <span style={subtextStyle}>Position-recording gate</span>
                </a>
              </li>
              <li>
                <a
                  href={`${GITHUB_REPO}/blob/main/contracts/src/right_root.cairo`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  right_root.cairo <span style={subtextStyle}>Root validator</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Dapp Pages */}
          <div>
            <div
              style={{
                fontSize: 12.5,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--gilt, #cabd9d)",
                fontWeight: 600,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "ui-monospace,Menlo,monospace",
              }}
            >
              <Layers size={14} /> Interactive App
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <li>
                <Link href="/app" style={linkStyle}>
                  Mainnet app <span style={subtextStyle}>State-machine walkthrough</span>
                </Link>
              </li>
              <li>
                <Link href="/docs" style={linkStyle}>
                  Documentation <span style={subtextStyle}>Evidence &amp; limits</span>
                </Link>
              </li>
              <li>
                <Link href="/protocol" style={linkStyle}>
                  Protocol Specification <span style={subtextStyle}>State transitions</span>
                </Link>
              </li>
              <li>
                <Link href="/verify" style={linkStyle}>
                  Receipt verifier <span style={subtextStyle}>Recorded mainnet facts</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Ecosystem & Primitives */}
          <div>
            <div
              style={{
                fontSize: 12.5,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--gilt, #cabd9d)",
                fontWeight: 600,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "ui-monospace,Menlo,monospace",
              }}
            >
              <Terminal size={14} /> Ecosystem &amp; SDK
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <li>
                <a
                  href={`${GITHUB_REPO}/tree/main/packages/sole-sdk`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  @sole/sdk <span style={subtextStyle}>TypeScript client</span>
                </a>
              </li>
              <li>
                <a
                  href="https://strk20.starknet.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  STRK20 Privacy Pool <span style={subtextStyle}>Starknet primitives</span>
                </a>
              </li>
              <li>
                <a
                  href="https://voyager.online"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  Voyager Explorer <span style={subtextStyle}>Starknet mainnet</span>
                </a>
              </li>
              <li>
                <a
                  href="https://www.readywallet.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  Ready Wallet <span style={subtextStyle}>Wallet integration</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: License, Specs & Attestation */}
        <div
          style={{
            borderTop: "1px solid rgba(202, 189, 157, 0.12)",
            paddingTop: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 14,
            fontSize: 12.5,
            color: "#8a816c",
          }}
        >
          <div style={{ maxWidth: 650, lineHeight: 1.45 }}>
            Experimental and unaudited. Recorded direct-flow receipts place a public pool deposit, helper invoke, and
            registry transition together, so a depositing wallet can be correlated with a slot. The deployed adapter
            records/clears a position only; no asset transfer, repayment, or independent second venue is established.
          </div>
          <div style={{ display: "flex", gap: 16, fontFamily: "ui-monospace,Menlo,monospace" }}>
            <span>Cairo 2.11</span>
            <span>·</span>
            <span>Starknet Mainnet</span>
            <span>·</span>
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" style={{ color: "#cabd9d", textDecoration: "none" }}>
              GitHub ↗
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

const linkStyle: React.CSSProperties = {
  color: "#d8ceb8",
  textDecoration: "none",
  fontSize: 14,
  display: "flex",
  flexDirection: "column",
  gap: 2,
  transition: "color 0.2s ease",
};

const subtextStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: "#807865",
  fontFamily: "ui-monospace,Menlo,monospace",
};
