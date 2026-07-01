"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { ChevronDown, Search, Check } from "lucide-react";
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  aplicarMascara,
  contarDigitos,
  buscarPais,
  type Country,
} from "@/lib/data/countries";
import Flag from "./Flag";

type Props = {
  country: Country;
  onCountryChange: (c: Country) => void;
  value: string;
  onChange: (digits: string) => void;
  autoFocus?: boolean;
  error?: string;
};

export default function PhoneInput({
  country,
  onCountryChange,
  value,
  onChange,
  autoFocus,
  error,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const masked = aplicarMascara(value, country.mask);
  const sugestoes = useMemo(() => buscarPais(search).slice(0, 60), [search]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const apenasNumeros = e.target.value.replace(/\D/g, "");
    const truncado = apenasNumeros.slice(0, country.maxDigits);
    onChange(truncado);
  }

  return (
    <div ref={wrapRef} className="flex flex-col gap-1.5 relative">
      <div
        className={`
          flex items-stretch bg-elevated border rounded-md transition-colors
          ${error ? "border-danger" : "border-border focus-within:border-border-strong"}
        `}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-3 border-r border-border hover:bg-surface-2 transition-colors rounded-l-md text-sm flex-shrink-0"
          aria-label={t("País: {name}", { name: country.name })}
        >
          <Flag code={country.code} size={22} />
          <span className="font-medium tabular-nums">+{country.ddi}</span>
          <ChevronDown
            size={12}
            className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        <input
          type="tel"
          inputMode="numeric"
          value={masked}
          onChange={handleChange}
          autoFocus={autoFocus}
          placeholder={country.mask ? country.mask.replace(/X/g, "_") : t("Digite o número")}
          className="flex-1 bg-transparent px-3 py-2 text-sm text-primary outline-none placeholder:text-muted min-w-0"
        />
      </div>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-[100] bg-surface border border-border rounded-md shadow-xl w-full sm:w-[380px] flex flex-col"
          style={{ boxShadow: "0 12px 30px rgba(0,0,0,0.6)", maxHeight: 380 }}
        >
          <div className="p-2 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
              <Search size={14} className="text-muted flex-shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Buscar país ou DDI...")}
                className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted min-w-0"
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {sugestoes.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted">{t("Nenhum país encontrado")}</div>
            ) : (
              sugestoes.map((p) => {
                const isActive = p.code === country.code;
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => {
                      onCountryChange(p);
                      setOpen(false);
                      setSearch("");
                      if (p.code !== country.code) onChange("");
                    }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                      ${isActive ? "bg-elevated" : "hover:bg-elevated"}
                    `}
                  >
                    <Flag code={p.code} size={22} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-medium truncate ${
                          isActive ? "text-primary" : "text-secondary"
                        }`}
                      >
                        {p.name}
                      </div>
                    </div>
                    <span className="text-xs tabular-nums text-muted">+{p.ddi}</span>
                    {isActive && <Check size={14} className="text-primary flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && <span className="text-xs text-danger">{error}</span>}
      {!error && value.length > 0 && contarDigitos(value) < country.minDigits && (
        <span className="text-xs text-muted">
          {t("Faltam {n} dígitos", { n: country.minDigits - contarDigitos(value) })}
        </span>
      )}
    </div>
  );
}

export { contarDigitos, DEFAULT_COUNTRY, COUNTRIES };
export type { Country };
