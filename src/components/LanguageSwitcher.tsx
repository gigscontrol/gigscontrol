"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useLang, type Lang } from "@/lib/i18n";
import Flag from "./Flag";

/**
 * Seletor de idioma (dropdown com bandeiras). 6 idiomas; salva no
 * localStorage (gc-lang) e traduz o site inteiro via useT. Os NOMES dos
 * idiomas ficam no próprio idioma (autônimos) — não se traduzem.
 */
export const IDIOMAS: { code: Lang; nome: string; pais: string }[] = [
  { code: "pt", nome: "Português", pais: "BR" },
  { code: "en", nome: "English", pais: "US" },
  { code: "es", nome: "Español", pais: "ES" },
  { code: "fr", nome: "Français", pais: "FR" },
  { code: "de", nome: "Deutsch", pais: "DE" },
  { code: "it", nome: "Italiano", pais: "IT" },
];

export default function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [aberto]);

  const atual = IDIOMAS.find((i) => i.code === lang) ?? IDIOMAS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        title={atual.nome}
        className="flex h-9 items-center gap-2 rounded-md border border-border px-2.5 text-sm text-secondary hover:text-primary hover:border-border-strong transition-colors"
      >
        <Flag code={atual.pais} size={20} />
        <span className="hidden sm:inline font-medium">{atual.nome}</span>
        <ChevronDown
          size={14}
          className={`transition-transform ${aberto ? "rotate-180" : ""}`}
        />
      </button>

      {aberto && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1.5 z-50 min-w-[190px] rounded-lg border border-border bg-surface shadow-xl overflow-hidden py-1"
        >
          {IDIOMAS.map((i) => {
            const ativo = i.code === lang;
            return (
              <button
                key={i.code}
                type="button"
                role="option"
                aria-selected={ativo}
                onClick={() => {
                  setLang(i.code);
                  setAberto(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  ativo ? "" : "hover:bg-elevated text-secondary"
                }`}
                style={
                  ativo
                    ? {
                        color: "var(--brand)",
                        background:
                          "color-mix(in srgb, var(--brand) 12%, transparent)",
                      }
                    : undefined
                }
              >
                <Flag code={i.pais} size={20} />
                <span
                  className={`flex-1 text-left ${
                    ativo ? "font-semibold" : "font-medium"
                  }`}
                >
                  {i.nome}
                </span>
                {ativo && <Check size={15} className="flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
