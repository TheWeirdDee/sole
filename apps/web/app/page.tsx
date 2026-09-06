"use client";

import Link from "next/link";
import { ArrowRight, Lock, Eye, EyeOff, ShieldCheck, Ban, CheckCircle2, ChevronRight, Layers, Sparkles } from "lucide-react";
import { motion, Variants } from "framer-motion";

const wrap: React.CSSProperties = { maxWidth: 1040, margin: "0 auto", padding: "0 26px" };
const thc: React.CSSProperties = { textAlign: "left", padding: "14px 18px", background: "var(--parch2)", fontWeight: 600, borderBottom: "1px solid var(--paper-line)" };
const tdc: React.CSSProperties = { textAlign: "left", padding: "14px 18px", borderBottom: "1px solid var(--paper-line)" };

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
    <main>
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
            One right. One financing.
            <br />
            Enforced everywhere, without revealing who.
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
            Sole turns a financial right into a single-use execution right: claimed privately, it
            authorizes one real financing action, then is spent for good. Two lenders can never
            finance the same right, at any venue. The chain enforces it without learning the holder,
            the amount, or the relationship.
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
                See a right get refused <ArrowRight size={17} />
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
                Canonical Asset Right
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
                Refused
              </div>
              <span style={{ fontSize: 11.5, color: "var(--faded)", fontStyle: "italic" }}>
                Bank B collision on chain
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
              Three values. One is shared, two stay private.
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", border: "1px solid var(--rule)", background: "var(--parch2)" }}>
            {[
              {
                num: "01 — identity",
                title: "slot_key",
                desc: "Poseidon(TAG_SLOT, canonical id). Deterministic, so any party derives the same key and collides. This is what makes a second claim fail on-chain.",
              },
              {
                num: "02 — ownership",
                title: "claim_record",
                desc: "Poseidon over the slot, a claimant secret, and a shielded funding note. Private by default. Only the holder can open it.",
              },
              {
                num: "03 — consumption",
                title: "nullifier",
                desc: "Burned once at settlement. Producing it needs the claimant secret, so only the holder settles — and never twice, at any venue.",
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                variants={cardHoverVariants}
                whileHover="hover"
                style={{
                  padding: "32px 28px",
                  borderRight: i < 2 ? "1px solid var(--rule)" : "none",
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
            The public chain holds only <span className="mono">slot_key -&gt; state -&gt; commitment</span>. Never an identity, an amount, or a counterparty. Once consumed, the right is spent for every venue.
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
            {`STRK20        provides private money    -> shielded notes, private transfer
the market    provides liquidity        -> lending, repayment
`}
            <span style={{ color: "var(--gilt)", fontWeight: "bold" }}>Sole</span>
            {`          provides the scarce right -> one claim, one financing, consumed once

Bank A -> shielded funding -> anonymizer -> claim() -> `}
            <span style={{ color: "var(--gilt)" }}>ACTIVE</span>
            {` -> authorizes financing -> market executes -> `}
            <span style={{ color: "var(--gilt)" }}>CONSUMED</span>
          </motion.div>

          <p style={{ fontSize: 18, color: "#413a2b", maxWidth: 740, margin: "24px auto 0", textAlign: "center", lineHeight: 1.6 }}>
            The venue is downstream of Sole: it can only execute a right Sole has activated, and it refuses a spent one — at this market or a different one entirely.
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

      {/* PRIVACY BOUNDARY TABLE SECTION */}
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
              The enforcement state is public. The relationship is private.
            </h2>
            <p style={{ fontSize: 17, color: "var(--faded)", marginTop: 8 }}>
              A vague privacy claim is worse than none, so here is the complete boundary.
            </p>
          </div>

          <div style={{ border: "1px solid var(--rule)", overflow: "hidden", borderRadius: 2, boxShadow: "0 4px 18px rgba(0,0,0,0.02)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15.5 }}>
              <tbody>
                <tr>
                  <th style={thc}>Data Field</th>
                  <th style={thc}>Public Chain</th>
                  <th style={thc}>Private Boundary</th>
                </tr>
                {[
                  ["Right state (unclaimed / active / consumed)", "shown", ""],
                  ["Slot identifier", "queryable*", ""],
                  ["Claimant identity", "", "hidden"],
                  ["Funding amount", "", "shielded"],
                  ["Claimant wallet", "", "anonymizer boundary"],
                  ["Counterparty relationship", "", "hidden"],
                ].map(([d, pub, pri], i) => (
                  <motion.tr
                    key={i}
                    whileHover={{ backgroundColor: "rgba(224, 214, 189, 0.55)" }}
                    style={{ background: i % 2 ? "var(--parch2)" : "var(--parch)", transition: "background-color 0.15s ease" }}
                  >
                    <td style={tdc}>{d}</td>
                    <td style={{ ...tdc, color: "var(--claret)", fontWeight: 600 }}>
                      {pub && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <Eye size={16} /> {pub}
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdc, color: "var(--faded)" }}>
                      {pri && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <EyeOff size={16} /> {pri}
                        </span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 13.5, color: "var(--faded)", marginTop: 16, textAlign: "center" }}>
            *Anyone holding the canonical id can read a right&apos;s state. Sole hides the economic relationship behind that state, not the fact that a known right is active.
          </p>
        </div>
      </motion.section>
    </main>
  );
}
