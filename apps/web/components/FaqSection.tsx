"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle, Shield, Lock, Layers, Landmark, CheckCircle2, GitBranch } from "lucide-react";

interface FaqItem {
  q: string;
  a: string | React.ReactNode;
  icon: React.ReactNode;
  tag: string;
}

const faqs: FaqItem[] = [
  {
    tag: "Scope",
    icon: <Shield size={18} color="var(--claret)" />,
    q: "What does the deployed prototype actually enforce?",
    a: (
      <>
        Sole&apos;s registry tracks one opaque slot through <code className="mono">UNCLAIMED -&gt; ACTIVE -&gt; CONSUMED</code>.
        Its deployed adapter can record an opaque position only while that slot is <code className="mono">ACTIVE</code>,
        then clear the position and consume the slot.
        <br /><br />
        It does <strong>not</strong> transfer assets, originate a loan, price credit, verify an invoice, or prove a
        real-world receivable exists. Treat the receivable labels in the app as fixtures, not as a lending product claim.
      </>
    ),
  },
  {
    tag: "Receipt Boundary",
    icon: <Lock size={18} color="var(--claret)" />,
    q: "What does the privacy-pool path reveal?",
    a: (
      <>
        The pool invokes the helper&apos;s <code className="mono">privacy_invoke</code>, and the registry records a
        slot key, lifecycle state, and opaque claim commitment. The registry sees the helper as its caller rather than
        the wallet address.
        <br /><br />
        This is not wallet unlinkability. In the currently recorded direct flow, a public pool deposit, helper invoke,
        and registry transition appear in one receipt. That receipt can correlate the depositing wallet with the slot.
        Note preimages are not published by the registry; see the privacy-boundary document for the complete limit.
      </>
    ),
  },
  {
    tag: "Rejection Evidence",
    icon: <Landmark size={18} color="var(--claret)" />,
    q: "What evidence exists for a duplicate or inactive-right rejection?",
    a: (
      <>
        The source and automated tests cover the registry&apos;s duplicate-claim guard and the adapter precondition:
        <code className="mono">(shared-registry adapter, non-ACTIVE) --finance--&gt; REVERT AUTH_RIGHT_NOT_ACTIVE</code>.
        The app also reads public state before offering a known-reverting sponsored wallet action.
        <br /><br />
        A sponsored wallet may preflight and decline a call predicted to revert, so there is no recorded mainnet
        receipt for the rejected path. The test result is evidence of the source behavior, not proof of a live rejected
        transaction.
      </>
    ),
  },
  {
    tag: "Privacy Boundary",
    icon: <Layers size={18} color="var(--claret)" />,
    q: "Which fields are public and which are not established by the registry?",
    a: (
      <>
        <strong>Public:</strong> pool deposits and withdrawals, their wallet addresses, token and amounts, timing,
        the registry slot/state, the opaque claim commitment, and the helper invocation. A bundled deposit and state
        transition can be linked from the same receipt.
        <br />
        <strong>Not carried as named registry fields:</strong> the claim-commitment preimage and pool-note details.
        The registry alone does not prove a borrower, lender, funding amount, repayment, or business relationship.
        Read the <a href="https://github.com/TheWeirdDee/sole/blob/main/docs/PRIVACY_BOUNDARY.md" target="_blank" rel="noreferrer" style={{ color: "var(--claret)", textDecoration: "underline" }}>privacy boundary</a> before relying on any confidentiality property.
      </>
    ),
  },
  {
    tag: "Adapter Status",
    icon: <CheckCircle2 size={18} color="var(--claret)" />,
    q: "Does settlement repay a loan or prove exclusion across independent venues?",
    a: (
      <>
        No. The deployed fallback adapter only writes and clears an opaque position record. Its
        <code className="mono">settle</code> path consumes the slot; it does not move funds, repay a loan, or establish
        a payment outcome.
        <br /><br />
        The generic adapter gate is tested with a shared registry. An independently deployed, correctly configured
        second adapter has not been verified, so the app does not present cross-venue exclusion as a live fact.
      </>
    ),
  },
  {
    tag: "Verification",
    icon: <GitBranch size={18} color="var(--claret)" />,
    q: "How can I distinguish recorded facts from source or test coverage?",
    a: (
      <>
        The receipt verifier and evidence ledger label each assertion by evidence type. A recorded mainnet receipt can
        establish its emitted events and fee; source and automated tests establish only the behavior exercised in that
        build. The repository is experimental and unaudited, so verify contract addresses, bytecode, and receipts before
        treating a statement as production evidence.
      </>
    ),
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section style={{ borderTop: "1px solid var(--rule)", padding: "80px 0 90px", background: "var(--parch)" }}>
      <div style={{ maxWidth: 940, margin: "0 auto", padding: "0 26px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontSize: 13,
              color: "var(--claret)",
              fontWeight: 600,
              fontStyle: "italic",
              padding: "4px 14px",
              background: "rgba(124, 29, 42, 0.07)",
              borderRadius: 20,
              border: "1px solid rgba(124, 29, 42, 0.18)",
              marginBottom: 12,
            }}
          >
            <HelpCircle size={14} /> Frequently Asked Questions
          </div>
          <h2 style={{ fontSize: "clamp(28px, 3.8vw, 42px)", fontWeight: 600, letterSpacing: "-.015em", margin: 0, color: "var(--ink)" }}>
            Protocol Mechanics &amp; Architecture
          </h2>
          <p style={{ fontSize: 17, color: "var(--faded)", maxWidth: 620, margin: "12px auto 0", lineHeight: 1.5 }}>
            The state gate, receipt boundary, evidence status, and limits of this prototype.
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                style={{
                  border: `1px solid ${isOpen ? "var(--claret)" : "var(--rule)"}`,
                  background: isOpen ? "#fdfbf7" : "var(--parch2)",
                  borderRadius: 3,
                  overflow: "hidden",
                  transition: "border-color 0.25s ease, background-color 0.25s ease",
                  boxShadow: isOpen ? "0 4px 16px rgba(124, 29, 42, 0.06)" : "none",
                }}
              >
                <button
                  onClick={() => toggle(i)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "20px 24px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {faq.icon}
                    </span>
                    <div>
                      <span
                        style={{
                          fontSize: 11.5,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--claret)",
                          fontWeight: 600,
                          display: "block",
                          marginBottom: 2,
                        }}
                      >
                        {faq.tag}
                      </span>
                      <span
                        style={{
                          fontSize: 17.5,
                          fontWeight: 600,
                          color: "var(--ink)",
                          lineHeight: 1.35,
                        }}
                      >
                        {faq.q}
                      </span>
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    style={{ flexShrink: 0, color: isOpen ? "var(--claret)" : "var(--faded)" }}
                  >
                    <ChevronDown size={20} />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div
                        style={{
                          padding: "0 24px 22px 56px",
                          fontSize: 15.5,
                          color: "#3f392c",
                          lineHeight: 1.65,
                          borderTop: "1px dashed rgba(202, 189, 157, 0.6)",
                          paddingTop: 16,
                        }}
                      >
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
