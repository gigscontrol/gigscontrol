"use client";

/**
 * Seletor com busca (autocomplete) — substitui o <select> nativo quando a
 * lista é grande. Digite o nome/telefone e a lista filtra na hora; mostra
 * label + sublabel (ex.: telefone · cidade). Fecha ao clicar fora ou Esc.
 */

import { useEffect, useRef, useState } from "react";
import { Search, ChevronDown, Check } from "lucide-react";

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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
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

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="campo-input flex w-full items-center gap-2 text-left"
      >
        <Search size={14} className="flex-shrink-0 text-muted" />
        <span
          className={`flex-1 truncate ${selected ? "text-primary" : "text-muted"}`}
        >
          {selected ? (
            <>
              {selected.label}
              {selected.sublabel ? (
                <span className="text-muted"> — {selected.sublabel}</span>
              ) : null}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border border-border bg-surface"
          style={{ boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}
        >
          <div className="border-b border-border p-2">
            <div className="campo-input flex items-center gap-2">
              <Search size={14} className="flex-shrink-0 text-muted" />
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Digite o nome ou telefone…"
                className="input flex-1"
              />
            </div>
          </div>
          <div className="max-h-[280px] overflow-y-auto py-1">
            {visiveis.length === 0 ? (
              <div className="px-3 py-5 text-center text-sm text-muted">
                Nenhum resultado.
              </div>
            ) : (
              visiveis.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                    setQuery("");
                  }}
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
                      style={{ color: "var(--module-vendas)" }}
                    />
                  )}
                </button>
              ))
            )}
            {filtrados.length > visiveis.length && (
              <div className="px-3 py-2 text-center text-xs text-muted">
                +{filtrados.length - visiveis.length} resultados — refine a busca
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
