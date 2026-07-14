"use client";

/**
 * Seletor de idioma compacto da landing (tela 13 do guia): globo + código
 * ("PT") na nav; no rodapé, o nome por extenso ("Português"). Dropdown com
 * os 6 idiomas (bandeira + nome), reusando o contexto de i18n do app.
 */

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import Flag from "@/components/Flag";
import { useLang, type Lang } from "@/lib/i18n";

const IDIOMAS: { code: Lang; nome: string; pais: string }[] = [
  { code: "pt", nome: "Português", pais: "BR" },
  { code: "en", nome: "English", pais: "US" },
  { code: "es", nome: "Español", pais: "ES" },
  { code: "fr", nome: "Français", pais: "FR" },
  { code: "de", nome: "Deutsch", pais: "DE" },
  { code: "it", nome: "Italiano", pais: "IT" },
];

export function SeletorIdioma({ nomeCompleto = false }: { nomeCompleto?: boolean }) {
  const { lang, setLang } = useLang();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const atual = IDIOMAS.find((i) => i.code === lang) ?? IDIOMAS[0];

  useEffect(() => {
    if (!aberto) return;
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-label="Idioma"
        className="inline-flex items-center gap-1.5 rounded-[9px] border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-surface px-3 py-[9px] text-xs font-semibold text-secondary transition-colors hover:text-primary"
      >
        <Globe size={13} strokeWidth={1.8} />
        {nomeCompleto ? atual.nome : atual.code.toUpperCase()}
        <ChevronDown size={10} strokeWidth={2.2} className="text-muted" />
      </button>

      {aberto && (
        <div
          role="listbox"
          className="absolute right-0 z-40 mt-1.5 w-44 overflow-hidden rounded-[10px] border border-[var(--border-strong)] bg-elevated py-1 shadow-xl"
          style={{ bottom: nomeCompleto ? "calc(100% + 6px)" : undefined, top: nomeCompleto ? "auto" : undefined }}
        >
          {IDIOMAS.map((idioma) => (
            <button
              key={idioma.code}
              type="button"
              role="option"
              aria-selected={idioma.code === lang}
              onClick={() => {
                setLang(idioma.code);
                setAberto(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-secondary transition-colors hover:bg-surface hover:text-primary"
            >
              <Flag code={idioma.pais} size={16} />
              <span className="flex-1">{idioma.nome}</span>
              {idioma.code === lang && (
                <Check size={13} style={{ color: "var(--brand)" }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
