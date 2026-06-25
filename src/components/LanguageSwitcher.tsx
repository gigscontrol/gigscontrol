"use client";

import { useLang } from "@/lib/i18n";

/**
 * Seletor de idioma PT/EN — fica ao lado do sino na Topbar. Salva no
 * localStorage e traduz o app inteiro (via useT).
 */
export default function LanguageSwitcher() {
  const { lang, setLang } = useLang();

  return (
    <div
      className="flex overflow-hidden rounded-md border border-border"
      title="Idioma / Language"
    >
      {(["pt", "en"] as const).map((l, i) => {
        const ativo = lang === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={ativo}
            className={`px-2 py-1.5 text-[0.7rem] font-bold transition-colors ${
              i === 1 ? "border-l border-border" : ""
            } ${ativo ? "" : "text-muted hover:text-secondary"}`}
            style={
              ativo
                ? {
                    color: "var(--brand)",
                    background: "color-mix(in srgb, var(--brand) 16%, transparent)",
                  }
                : undefined
            }
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
