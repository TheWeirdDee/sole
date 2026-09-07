"use client";

import Link from "next/link";
import { ArrowRight, Lock, ChevronRight } from "lucide-react";
import { motion, Variants } from "framer-motion";
import { GrainOverlay } from "../components/GrainOverlay";
import { ScrambleText } from "../components/ScrambleText";
import { FaqSection } from "../components/FaqSection";

const wrap: React.CSSProperties = { maxWidth: 1040, margin: "0 auto", padding: "0 26px" };

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const cardHoverVariants: Variants = {
  hover: {
    y: -5,
    backgroundColor: "#ded5bc",
    borderColor: "#b5a887",
    transition: { duration: 0.2, ease: "easeOut" },
  },
};

export default function Home() {
  return (
    <main style={{ position: "relative" }}>
      <GrainOverlay />
      {/* HERO SECTION - Centered with Rich Framer Motion Animations */}
      <section style={{ ...wrap, padding: "88px 26px 72px", textAlign: "center" }}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          {/* Eyebrow Badge */}
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.05 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13.5,
              color: "var(--claret)",
              fontWeight: 600,
              fontStyle: "italic",
              padding: "6px 16px",
              background: "rgba(124, 29, 42, 0.08)",
              borderRadius: 30,
              border: "1px solid rgba(124, 29, 42, 0.22)",
              marginBottom: 24,
              cursor: "default",
            }}
          >
            <Lock size={14} color="var(--claret)" /> A single-use execution-right protocol on STRK20
          </motion.div>

          {/* Centered Headline */}
          <motion.h1
            variants={itemVariants}
            style={{
              fontSize: "clamp(38px, 5.4vw, 66px)",
              lineHeight: 1.08,
              maxWidth: "960px",
              margin: "0 auto",
              fontWeight: 600,
              letterSpacing: "-.02em",
              color: "var(--ink)",
            }}
          >
            One right. One gated adapter action.
            <br />
            Enforced by <ScrambleText text="public state." />
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            style={{
              fontSize: 20,
              color: "#413a2b",
              maxWidth: "720px",
              margin: "24px auto 0",
              lineHeight: 1.55,
            }}
          >
            Sole records one active claim for a canonical reference and gates one adapter action while that
            claim remains ACTIVE. The deployed fallback adapter records and clears an opaque position; it does
            not transfer assets, issue credit, or call an external market. Read the evidence and limits before
            treating it as a financing system.
          </motion.p>

          {/* Action Buttons */}
          <motion.div
            variants={itemVariants}
            style={{ display: "flex", gap: 14, marginTop: 36, justifyContent: "center", flexWrap: "wrap" }}
          >
            <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/app"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 9,
                  background: "var(--ink)",
                  color: "var(--parch)",
                  padding: "13px 26px",
                  borderRadius: 2,
                  textDecoration: "none",
                  fontSize: 16,
                  fontWeight: 500,
                  boxShadow: "0 4px 14px rgba(26,22,15,0.14)",
                }}
              >
                Inspect the live demo <ArrowRight size={17} />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/protocol"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  border: "1px solid var(--ink)",
                  padding: "13px 24px",
                  borderRadius: 2,
                  textDecoration: "none",
                  color: "var(--ink)",
                  fontSize: 16,
                  fontWeight: 500,
                  background: "transparent",
                }}
              >
                Read the protocol
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/verify"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  border: "1px solid var(--rule)",
                  padding: "13px 22px",
                  borderRadius: 2,
                  textDecoration: "none",
                  color: "var(--faded)",
                  fontSize: 15,
                  background: "var(--parch2)",
                }}
              >
                Verify on chain
              </Link>
            </motion.div>
          </motion.div>

          {/* Hero Interactive Instrument Preview */}
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.3 }}
            style={{
              margin: "56px auto 0",
              width: "100%",
              maxWidth: "880px",
              border: "1px solid var(--rule)",
              background: "var(--parch2)",
              padding: "30px 34px",
              textAlign: "left",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 24,
              alignItems: "center",
              boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
              position: "relative",
              borderRadius: 2,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--faded)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--claret)", display: "inline-block" }} />
                Illustrative fixture — not a live rejected receipt
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, margin: "6px 0 14px", color: "var(--ink)" }}>
                Receivable RCV-4821
              </div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 14, color: "#413a2b" }}>
                <div>Claimant: <span style={{ background: "var(--ink)", color: "transparent", borderRadius: 1, padding: "0 5px", userSelect: "none" }}>Bank A Lagos</span></div>
                <div>Amount: <span style={{ background: "var(--ink)", color: "transparent", borderRadius: 1, padding: "0 5px", userSelect: "none" }}>100,000 STRK</span></div>
                <div>Counterparty: <span style={{ background: "var(--ink)", color: "transparent", borderRadius: 1, padding: "0 5px", userSelect: "none" }}>Acme Foods Ltd</span></div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--faded)", marginTop: 14 }} className="mono">
                slot_key = Poseidon(TAG_SLOT, canonical_id)
              </div>
            </div>

            <motion.div
              initial={{ scale: 0.8, rotate: -12, opacity: 0 }}
              animate={{ scale: 1, rotate: -6, opacity: 1 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 220, damping: 14 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 150, textAlign: "center" }}
            >
              <div
                style={{
                  border: "2.5px solid var(--claret)",
                  color: "var(--claret)",
                  padding: "8px 18px",
                  borderRadius: 3,
                  fontWeight: 700,
                  fontSize: 18,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  background: "rgba(124, 29, 42, 0.05)",
                  boxShadow: "0 2px 8px rgba(124, 29, 42, 0.12)",
                }}
              >
                Test-only refusal
              </div>
              <span style={{ fontSize: 11.5, color: "var(--faded)", fontStyle: "italic" }}>
                Duplicate-claim revert is covered by tests; no mainnet rejection receipt is recorded.
              </span>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* HOW IT WORKS SECTION - Staggered on Scroll */}
      <motion.section
        initial={{ opacity: 0, y: 36 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ borderTop: "1px solid var(--rule)", padding: "76px 0" }}
      >
        <div style={wrap}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 13.5, color: "var(--claret)", fontWeight: 600, fontStyle: "italic", marginBottom: 8 }}>
              Architecture
            </div>
            <h2 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-.015em", margin: 0 }}>
              Four protocol values across registry and adapter layers.
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", border: "1px solid var(--rule)", background: "var(--parch2)" }}>
            {[
              {
                num: "01 — registry identity",
                title: "slot_key",
                desc: "Poseidon(TAG_SLOT, canonical id). This deterministic public key addresses the registry slot, so the same reference reaches the same state machine.",
              },
              {
                num: "02 — active commitment",
                title: "claim_commitment",
                desc: "An opaque public commitment over the slot and local preimages. The registry stores the commitment; it cannot recover those preimages from it.",
              },
              {
                num: "03 — consumption",
                title: "nullifier",
                desc: "Derived from a local secret and revealed when the registry consumes the right. The registry burns it to prevent the tested replay path.",
              },
              {
                num: "04 — adapter gate",
                title: "ExecAuth",
                desc: "Derived from the active slot and claim commitment. The adapter recomputes it and accepts it only while the registry reports ACTIVE; it is not a fourth registry record.",
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                variants={cardHoverVariants}
                whileHover="hover"
                style={{
                  padding: "32px 28px",
                  borderRight: i % 2 === 0 ? "1px solid var(--rule)" : "none",
                  borderBottom: "1px solid var(--rule)",
                  cursor: "default",
                }}
              >
                <div style={{ fontSize: 13, color: "var(--claret)", fontWeight: 600, marginBottom: 10 }}>{card.num}</div>
                <h3 style={{ fontSize: 22, margin: "0 0 12px", fontWeight: 600, color: "var(--ink)" }}>{card.title}</h3>
                <p style={{ fontSize: 15.5, color: "#4a4231", margin: 0, lineHeight: 1.6 }}>{card.desc}</p>
              </motion.div>
            ))}
          </div>

          <p style={{ fontSize: 13.5, color: "var(--faded)", marginTop: 18, textAlign: "center" }}>
            Registry storage maps <span className="mono">slot_key -&gt; state -&gt; active commitment</span>. That is not the whole public transaction footprint: the canonical privacy boundary documents the recorded pool deposits and correlation risk.
          </p>
        </div>
      </motion.section>

      {/* THREE LAYERS SEPARATION SECTION */}
      <motion.section
        initial={{ opacity: 0, y: 36 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ borderTop: "1px solid var(--rule)", padding: "76px 0", background: "var(--parch2)" }}
      >
        <div style={wrap}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 13.5, color: "var(--claret)", fontWeight: 600, fontStyle: "italic", marginBottom: 8 }}>
              Separation of Concerns
            </div>
            <h2 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-.015em", margin: 0 }}>
              Three layers, and the separation is the point.
            </h2>
          </div>

          <motion.div
            whileHover={{ scale: 1.008 }}
            style={{
              fontFamily: "ui-monospace,Menlo,monospace",
              fontSize: 14,
              lineHeight: 2,
              background: "var(--ink)",
              color: "var(--parch)",
              padding: "26px 30px",
              overflowX: "auto",
              whiteSpace: "pre",
              borderRadius: 2,
              boxShadow: "0 6px 24px rgba(26,22,15,0.18)",
            }}
          >
            {`STRK20 pool    provides the invocation route and fee handling
FallbackMarket records / clears an opaque adapter position (no asset transfer)
`}
            <span style={{ color: "var(--gilt)", fontWeight: "bold" }}>Sole</span>
            {`          provides the scarce right -> one claim, one gated adapter action

wallet -> pool -> anonymizer -> claim() -> `}
            <span style={{ color: "var(--gilt)" }}>ACTIVE</span>
            {` -> adapter records position -> `}
            <span style={{ color: "var(--gilt)" }}>CONSUMED</span>
          </motion.div>

          <p style={{ fontSize: 18, color: "#413a2b", maxWidth: 740, margin: "24px auto 0", textAlign: "center", lineHeight: 1.6 }}>
            The adapter is downstream of Sole: its source-level gate accepts an <span className="mono">ExecAuth</span> only
            for an ACTIVE right and recomputes the nonce from the registry&apos;s commitment. The deployed fallback adapter
            demonstrates position bookkeeping, not a loan, repayment, asset transfer, or independent-market integration.
          </p>

          <div style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/app"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "var(--claret)",
                  color: "var(--parch)",
                  padding: "12px 24px",
                  borderRadius: 2,
                  textDecoration: "none",
                  fontSize: 15.5,
                  fontWeight: 500,
                }}
              >
                Walk the full lifecycle <ChevronRight size={17} />
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* PRIVACY BOUNDARY SECTION */}
      <motion.section
        initial={{ opacity: 0, y: 36 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ borderTop: "1px solid var(--rule)", padding: "76px 0" }}
      >
        <div style={wrap}>
          <div style={{ textAlign: "center", marginBottom: 38 }}>
            <div style={{ fontSize: 13.5, color: "var(--claret)", fontWeight: 600, fontStyle: "italic", marginBottom: 8 }}>
              The Privacy Boundary
            </div>
            <h2 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-.015em", margin: 0 }}>
              Registry caller separation is not wallet anonymity.
            </h2>
            <p style={{ fontSize: 17, color: "var(--faded)", marginTop: 8 }}>
              The registry receives the configured anonymizer as caller. In the recorded bundled flow, a public pool
              deposit, pool invoke, and registry transition occur in one receipt, so the depositing wallet can be
              correlated with the slot. The canonical boundary, including what remains opaque, lives in one document.
            </p>
          </div>
          <p style={{ fontSize: 15.5, color: "var(--faded)", marginTop: 8, textAlign: "center" }}>
            Read the source of truth before relying on any privacy property:{" "}
            <a
              href="https://github.com/TheWeirdDee/sole/blob/main/docs/PRIVACY_BOUNDARY.md"
              target="_blank" rel="noopener noreferrer" style={{ color: "var(--claret)" }}
            >
              docs/PRIVACY_BOUNDARY.md
            </a>
            . The evidence ledger records the actual receipt fields and fees.
          </p>
        </div>
      </motion.section>

      {/* FREQUENTLY ASKED QUESTIONS SECTION */}
      <FaqSection />
    </main>
  );
}
