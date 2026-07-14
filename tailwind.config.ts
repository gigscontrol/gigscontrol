import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        main: "var(--bg-main)",
        surface: "var(--bg-surface)",
        "surface-2": "var(--bg-surface-2)",
        elevated: "var(--bg-elevated)",
        border: "var(--border-color)",
        "border-hover": "var(--border-hover)",
        "border-strong": "var(--border-strong)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        disabled: "var(--text-disabled)",
        accent: "var(--accent-color)",
        brand: "var(--brand)",
        "brand-2": "var(--brand-2)",
        success: "var(--success)",
        "success-ink": "var(--success-ink)",
        danger: "var(--danger)",
        "danger-ink": "var(--danger-ink)",
        warning: "var(--warning)",
        info: "var(--info)",
        // Aliases legados por módulo — todos resolvem pro Signal Blue.
        agenda: "var(--module-agenda)",
        vendas: "var(--module-vendas)",
        financeiro: "var(--module-financeiro)",
        contatos: "var(--module-contatos)",
      },
      borderColor: {
        DEFAULT: "var(--border-color)",
      },
      fontFamily: {
        sans: ["Hanken Grotesk", "system-ui", "sans-serif"],
        display: ["Bricolage Grotesque", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "var(--radius-sm)",
        lg: "var(--radius-lg)",
        control: "var(--r-control)",
        chip: "var(--r-chip)",
        card: "var(--r-card)",
        pill: "var(--r-pill)",
      },
      backgroundImage: {
        "grad-signal": "var(--grad-signal)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
