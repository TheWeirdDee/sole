import "./globals.css";
import type { Metadata } from "next";
import { Nav } from "../components/Nav";
import { SmoothScroll } from "../components/SmoothScroll";

export const metadata: Metadata = {
  title: "Sole — private exclusivity for economic rights",
  description:
    "A right can be privately held, publicly enforceable, and consumed exactly once. Built on STRK20.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <SmoothScroll>
          <Nav />
          {children}
          <footer
            style={{
              borderTop: "1px solid var(--rule)",
              padding: "40px 0",
              color: "var(--faded)",
              fontSize: 14,
              marginTop: 40,
            }}
          >
            <div style={{ maxWidth: 1040, margin: "0 auto", padding: "0 26px", textAlign: "center" }}>
              <div>Sole · a single-use execution-right protocol for economic rights on STRK20 · Apache-2.0</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>
                Demo fixture data is labelled as fixture. The registry is use-case agnostic.
              </div>
            </div>
          </footer>
        </SmoothScroll>
      </body>
    </html>
  );
}
