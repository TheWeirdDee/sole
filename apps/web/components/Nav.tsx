"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileLock2 } from "lucide-react";

const links = [
  { href: "/", label: "Overview" },
  { href: "/app", label: "Demo" },
  { href: "/verify", label: "Verify" },
  { href: "/protocol", label: "Protocol" },
  { href: "/docs", label: "Docs" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(233,225,206,.9)",
      backdropFilter: "blur(6px)", borderBottom: "1px solid var(--rule)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 26px", height: 62,
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11, fontWeight: 600,
          fontSize: 21, textDecoration: "none", color: "var(--ink)" }}>
          <FileLock2 size={24} color="var(--claret)" strokeWidth={1.5} /> Sole
        </Link>
        <div style={{ display: "flex", gap: 4 }}>
          {links.map((l) => {
            const on = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} style={{ fontSize: 15.5, padding: "8px 14px",
                textDecoration: "none", borderRadius: 2, color: on ? "var(--claret)" : "var(--ink)",
                fontWeight: on ? 600 : 400, opacity: on ? 1 : 0.72 }}>
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
