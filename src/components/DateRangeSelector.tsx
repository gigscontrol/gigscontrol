"use client";

import { useEffect, useRef, useState } from "react";

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
  /** Anos disponíveis. Default: 2026 em diante até ano atual + 1. */
  years?: number[];
};

const ALL_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/**
 * Mês mínimo permitido pra um dado ano.
 *
 * O GIGS CONTROL foi criado em maio/2026, então no ano 2026 só
 * permitimos selecionar Mai-Dez. Anos posteriores (2027+) liberam
 * todos os 12 meses.
 */
function indiceMesMinimoNoAno(year: number): number {
  if (year === 2026) return 4; // 0-based: 4 = Maio
  return 0;
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
  years,
}: Props<T>) {
  const [isCustomMenuOpen, setIsCustomMenuOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Default de anos: 2026 até max(2027, currentYear + 1)
  const defaultYears = (() => {
    const limiteSuperior = Math.max(2027, new Date().getFullYear() + 1);
    const out: number[] = [];
    for (let y = 2026; y <= limiteSuperior; y++) out.push(y);
    return out;
  })();
  const yearsFinal = years && years.length > 0 ? years : defaultYears;

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

  // Quando o ano muda, se o mês selecionado fica fora do range permitido
  // pra esse ano, limpa.
  const minMesIdx = selectedCustomYear !== null ? indiceMesMinimoNoAno(selectedCustomYear) : 0;
  const mesSelecionadoIdx = selectedCustomMonth ? ALL_MONTHS.indexOf(selectedCustomMonth) : -1;
  useEffect(() => {
    if (mesSelecionadoIdx !== -1 && mesSelecionadoIdx < minMesIdx) {
      setSelectedCustomMonth(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomYear]);

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
            {range}
          </button>
        ))}
      </div>

      {value === customLabel && isCustomMenuOpen && (
        <div
          className="absolute top-full right-0 mt-2 z-50 w-[360px] max-w-[calc(100vw-32px)] bg-surface border border-border rounded-lg p-4 animate-in"
          style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}
        >
          <div className="stat-label mb-2">Selecione o ano</div>
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {yearsFinal.map((year) => {
              const isSel = selectedCustomYear === year;
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedCustomYear(year)}
                  className={`
                    py-2 rounded-md text-xs font-semibold transition-all
                    ${isSel
                      ? "bg-primary text-main border border-primary"
                      : "bg-elevated text-secondary border border-border hover:border-border-strong hover:text-primary"
                    }
                  `}
                >
                  {year}
                </button>
              );
            })}
          </div>

          <div className="stat-label mb-2">Selecione o mês</div>
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
                  title={isDisabled ? "GIGS CONTROL foi criado em maio/2026" : undefined}
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
            Confirmar período
          </button>
        </div>
      )}
    </div>
  );
}
