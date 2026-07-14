"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { useT } from "@/lib/i18n";
import { buscarPais, type Country } from "@/lib/data/countries";
import Flag from "./Flag";

/**
 * Seletor de país reutilizável — botão com a BANDEIRA real (Flag/flagcdn,
 * funciona no Windows) + dropdown com busca. Usado onde precisa escolher
 * um país isolado (ex: país de origem do contratante).
 */
type Props = {
  value: Country;
  onChange: (c: Country) => void;
  /** Mostra o +DDI ao lado do nome no dropdown (default true). */
  mostrarDdi?: boolean;
};

export default function SeletorPais({ value, onChange, mostrarDdi = true }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setBusca("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const sugestoes = buscarPais(busca).slice(0, 60);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 bg-elevated border rounded-md px-3 py-2 transition-colors ${
          open ? "border-border-strong" : "border-border hover:border-border-strong"
        }`}
      >
        <Flag code={value.code} size={20} />
        <span className="text-sm text-primary font-medium flex-1 text-left truncate">
          {value.name}
        </span>
        <ChevronDown
          size={14}
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 z-50 bg-surface border border-border rounded-md flex flex-col"
          style={{ boxShadow: "0 12px 30px var(--shadow-color)", maxHeight: 320 }}
        >
          <div className="p-2 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-2.5 py-1.5">
              <Search size={13} className="text-muted flex-shrink-0" />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={t("Buscar país...")}
                className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted min-w-0"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {sugestoes.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                  setBusca("");
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  p.code === value.code ? "bg-elevated" : "hover:bg-elevated"
                }`}
              >
                <Flag code={p.code} size={20} />
                <span
                  className={`flex-1 text-sm truncate ${
                    p.code === value.code ? "text-primary font-medium" : "text-secondary"
                  }`}
                >
                  {p.name}
                </span>
                {mostrarDdi && <span className="text-xs tabular-nums text-muted">+{p.ddi}</span>}
                {p.code === value.code && <Check size={14} className="text-primary flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
