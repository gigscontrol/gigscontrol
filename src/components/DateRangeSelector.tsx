"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  customLabel?: T;
  /** Mês selecionado no Personalizado (ex: "Jan", "Mai"). null = nenhum. */
  selectedCustomMonth: string | null;
  setSelectedCustomMonth: (m: string | null) => void;
  /** Ano selecionado no Personalizado. null = nenhum. */
  selectedCustomYear: number | null;
  setSelectedCustomYear: (y: number | null) => void;
  /**
   * ISO timestamp da criação da conta/workspace. Define o piso absoluto
   * dos filtros — anos anteriores não aparecem, e no ano de criação só
   * são liberados meses ≥ mês de criação. Se null, usa mai/2026 (data
   * de criação do próprio GIGS CONTROL).
   */
  accountCreatedAt?: string | null;
};

const ALL_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ANO_LIMITE_SUPERIOR = 2030;
const ANO_BASE_APP = 2026;
const MES_BASE_APP = 4; // Maio (0-based)

/**
 * Resolve o {ano, mês} mínimo permitido, considerando:
 *  - base do app: mai/2026 (criação do GIGS CONTROL)
 *  - data de criação da conta: se for mais nova, vira o piso
 *
 * Retorna o mais restritivo entre os dois.
 */
function resolverPiso(accountCreatedAt: string | null | undefined): { ano: number; mes: number } {
  if (!accountCreatedAt) return { ano: ANO_BASE_APP, mes: MES_BASE_APP };
  const d = new Date(accountCreatedAt);
  if (isNaN(d.getTime())) return { ano: ANO_BASE_APP, mes: MES_BASE_APP };
  const a = d.getFullYear();
  const m = d.getMonth();
  if (a > ANO_BASE_APP || (a === ANO_BASE_APP && m > MES_BASE_APP)) {
    return { ano: a, mes: m };
  }
  return { ano: ANO_BASE_APP, mes: MES_BASE_APP };
}

export default function DateRangeSelector<T extends string>({
  options,
  value,
  onChange,
  customLabel = "Personalizado" as T,
  selectedCustomMonth,
  setSelectedCustomMonth,
  selectedCustomYear,
  setSelectedCustomYear,
  accountCreatedAt,
}: Props<T>) {
  const t = useT();
  const [isCustomMenuOpen, setIsCustomMenuOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Piso (ano/mês mínimos permitidos)
  const piso = useMemo(() => resolverPiso(accountCreatedAt), [accountCreatedAt]);

  // Pools de anos:
  //  - todos: piso.ano .. 2030
  //  - destaque: piso.ano até max(currentYear + 1, piso.ano + 1) — limitado a 2030
  //  - ocultos: resto
  const { yearsDestaque, yearsOcultos } = useMemo(() => {
    const todos: number[] = [];
    for (let y = piso.ano; y <= ANO_LIMITE_SUPERIOR; y++) todos.push(y);
    const limiteDestaque = Math.min(
      ANO_LIMITE_SUPERIOR,
      Math.max(new Date().getFullYear() + 1, piso.ano + 1)
    );
    const destaque = todos.filter((y) => y <= limiteDestaque);
    const ocultos = todos.filter((y) => y > limiteDestaque);
    return { yearsDestaque: destaque, yearsOcultos: ocultos };
  }, [piso.ano]);

  // Estado "ver mais anos" — auto-true se o ano selecionado tá no pool oculto
  const [showMoreYears, setShowMoreYears] = useState(() =>
    selectedCustomYear !== null && yearsOcultos.includes(selectedCustomYear)
  );
  useEffect(() => {
    if (selectedCustomYear !== null && yearsOcultos.includes(selectedCustomYear)) {
      setShowMoreYears(true);
    }
  }, [selectedCustomYear, yearsOcultos]);

  // Fecha popover ao clicar fora
  useEffect(() => {
    if (!isCustomMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsCustomMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isCustomMenuOpen]);

  // Mês mínimo permitido pro ano selecionado
  const minMesIdx = useMemo(() => {
    if (selectedCustomYear === null) return 0;
    if (selectedCustomYear === piso.ano) return piso.mes;
    return 0;
  }, [selectedCustomYear, piso]);

  // Limpa o mês selecionado se o ano muda e o mês fica fora do range
  const mesSelecionadoIdx = selectedCustomMonth ? ALL_MONTHS.indexOf(selectedCustomMonth) : -1;
  useEffect(() => {
    if (mesSelecionadoIdx !== -1 && mesSelecionadoIdx < minMesIdx) {
      setSelectedCustomMonth(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomYear]);

  const yearsVisiveis = showMoreYears ? [...yearsDestaque, ...yearsOcultos] : yearsDestaque;

  return (
    <div className="relative" ref={popoverRef}>
      <div className="pill-group flex-wrap">
        {options.map((range) => (
          <button
            key={range}
            type="button"
            className={`pill ${value === range ? "active" : ""}`}
            onClick={() => {
              onChange(range);
              if (range === customLabel) setIsCustomMenuOpen((v) => !v);
              else setIsCustomMenuOpen(false);
            }}
          >
            {t(range)}
          </button>
        ))}
      </div>

      {value === customLabel && isCustomMenuOpen && (
        <div
          className="absolute top-full right-0 mt-2 z-50 w-[360px] max-w-[calc(100vw-32px)] bg-surface border border-border rounded-lg p-4 animate-in"
          style={{ boxShadow: "0 12px 40px var(--shadow-color)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">{t("Selecione o ano")}</span>
            {yearsOcultos.length > 0 && (
              <button
                type="button"
                onClick={() => setShowMoreYears((v) => !v)}
                className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted hover:text-primary transition-colors"
              >
                {showMoreYears ? t("Recolher") : t("+ Mostrar mais")}
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {yearsVisiveis.map((year) => {
              const isSel = selectedCustomYear === year;
              const isExtra = yearsOcultos.includes(year);
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedCustomYear(year)}
                  className={`
                    py-2 rounded-md text-xs font-semibold transition-all
                    ${isSel
                      ? "bg-primary text-main border border-primary"
                      : isExtra
                      ? "bg-elevated text-muted border border-border hover:border-border-strong hover:text-primary opacity-75"
                      : "bg-elevated text-secondary border border-border hover:border-border-strong hover:text-primary"
                    }
                  `}
                >
                  {year}
                </button>
              );
            })}
          </div>

          <div className="stat-label mb-2">{t("Selecione o mês")}</div>
          <div className="grid grid-cols-6 gap-1.5 mb-4">
            {ALL_MONTHS.map((month, idx) => {
              const isSel = selectedCustomMonth === month;
              const isDisabled = idx < minMesIdx;
              return (
                <button
                  key={month}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => setSelectedCustomMonth(month)}
                  className={`
                    py-2 rounded-md text-xs font-semibold transition-all
                    ${isDisabled
                      ? "bg-elevated text-disabled border border-border cursor-not-allowed opacity-40"
                      : isSel
                      ? "bg-primary text-main border border-primary"
                      : "bg-elevated text-secondary border border-border hover:border-border-strong hover:text-primary"
                    }
                  `}
                  title={isDisabled ? t("Mês anterior à criação da conta") : undefined}
                >
                  {month}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setIsCustomMenuOpen(false)}
            className="btn btn-primary w-full"
            disabled={selectedCustomMonth === null || selectedCustomYear === null}
          >
            {t("Confirmar período")}
          </button>
        </div>
      )}
    </div>
  );
}
