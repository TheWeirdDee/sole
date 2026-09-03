// The verify surface. Canonical design + content is in apps/web/preview.html
// (the #verify route). Port it into this component; keep the sealed-instrument
// tokens from tailwind.config.ts and globals.css.
export default function Page() {
  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "44px 26px" }}>
      <p style={{ fontSize: 14, color: "var(--claret)", fontStyle: "italic" }}>verify</p>
      <p style={{ fontSize: 19, color: "#413a2b", maxWidth: 660 }}>
        Port from <span className="mono">apps/web/preview.html</span> (#verify route) — fully designed there.
      </p>
    </main>
  );
}
