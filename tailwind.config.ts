import type { Config } from "tailwindcss";

/**
 * The prototype (bundlescan-nav.html) is the design source of truth. Its
 * monochrome+ember tokens live as CSS variables in globals.css; we mirror them
 * here so Tailwind utilities resolve to the exact same values when used.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        black: "var(--black)",
        "bg-2": "var(--bg-2)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        signal: "var(--signal)",
        "signal-2": "var(--signal-2)",
        clean: "var(--clean)",
        mild: "var(--mild)",
      },
      fontFamily: {
        display: ["var(--display)", "Clash Display", "sans-serif"],
        body: ["var(--body)", "Switzer", "sans-serif"],
        mono: ["var(--mono)", "Geist Mono", "monospace"],
      },
      transitionTimingFunction: {
        ease: "cubic-bezier(.16,1,.3,1)",
      },
    },
  },
  plugins: [],
};

export default config;
