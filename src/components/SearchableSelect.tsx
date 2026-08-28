"use client";

/**
 * Seletor com busca (combobox) — substitui o <select> nativo quando a lista
 * é grande. O próprio campo é o input de busca: clique, digite o nome/telefone
 * e os resultados (nome + telefone · cidade) aparecem logo abaixo. Fecha ao
 * clicar fora ou Esc.
 */

import { useEffect, useRef, useState } from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import { useT } from "@/lib/i18n";

export type SearchOption = { id: string; label: string; sublabel?: string };

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Buscar…",
  className = "",
}: {
  options: SearchOption[];
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    // Clique-fora agora é BACKDROP (fix 28/08/2026): a lista cobre os campos
    // abaixo e o mousedown-fora deixava o clique acertar o campo coberto.
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtrados = q
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.sublabel ?? "").toLowerCase().includes(q)
      )
    : options;
  const visiveis = filtrados.slice(0, 50);

  function escolher(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  return (
    <div ref={ref} className={`relative ${open ? "z-50" : ""} ${className}`}>
      {/* Backdrop transparente: primeiro clique fora só FECHA a lista — nada
          por baixo recebe o clique (contrato de <select> nativo). */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          aria-hidden
          onMouseDown={(e) => {
            e.preventDefault();
            setOpen(false);
            setQuery("");
            inputRef.current?.blur();
          }}
        />
      )}
      <div className="campo-input flex items-center gap-2 relative z-50">
        <Search size={14} className="flex-shrink-0 text-muted" />
        <input
          ref={inputRef}
          value={open ? query : selected?.label ?? ""}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          placeholder={t(placeholder)}
          className="input flex-1"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? t("Fechar lista") : t("Abrir lista")}
          onClick={() => {
            if (open) {
              setOpen(false);
              setQuery("");
            } else {
              inputRef.current?.focus();
            }
          }}
          className="flex-shrink-0"
        >
          <ChevronDown
            size={14}
            className={`text-muted transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {open && (
        <div
          className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-surface"
          style={{ boxShadow: "0 12px 30px var(--shadow-color)" }}
        >
          <div className="max-h-[280px] overflow-y-auto py-1">
            {visiveis.length === 0 ? (
              <div className="px-3 py-5 text-center text-sm text-muted">
                {t("Nenhum resultado.")}
              </div>
            ) : (
              visiveis.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolher(o.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-elevated ${
                    o.id === value ? "bg-elevated" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-primary">
                      {o.label}
                    </span>
                    {o.sublabel && (
                      <span className="block truncate text-xs text-muted">
                        {o.sublabel}
                      </span>
                    )}
                  </span>
                  {o.id === value && (
                    <Check
                      size={14}
                      className="flex-shrink-0"
                      style={{ color: "var(--brand)" }}
                    />
                  )}
                </button>
              ))
            )}
            {filtrados.length > visiveis.length && (
              <div className="px-3 py-2 text-center text-xs text-muted">
                {t("+{n} resultados — refine a busca", { n: filtrados.length - visiveis.length })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
