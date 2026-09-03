import type { Config } from "tailwindcss";
// Sole design tokens. Sealed-instrument palette: parchment + ink + wax-seal claret,
// with a single notary gilt. Deliberately not the cream+terracotta default.
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parch: "#e9e1ce", parch2: "#e0d6bd", ink: "#1a160f", ink2: "#2b2418",
        claret: "#7c1d2a", claretSoft: "#9c3b45", gilt: "#b08a3e",
        faded: "#8c8267", rule: "#cabd9d",
      },
      fontFamily: { serif: ["Spectral", "Georgia", "serif"] },
    },
  },
  plugins: [],
} satisfies Config;
