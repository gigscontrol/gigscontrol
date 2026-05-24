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
        success: "var(--success)",
        danger: "var(--danger)",
        warning: "var(--warning)",
        info: "var(--info)",
        agenda: "var(--module-agenda)",
        vendas: "var(--module-vendas)",
        financeiro: "var(--module-financeiro)",
        contatos: "var(--module-contatos)",
      },
      borderColor: {
        DEFAULT: "var(--border-color)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "var(--radius-sm)",
        lg: "var(--radius-lg)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
