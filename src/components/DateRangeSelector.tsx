"use client";

import { useEffect, useRef, useState } from "react";

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  customLabel?: T;
  selectedCustomMonths: string[];
  setSelectedCustomMonths: (m: string[]) => void;
  selectedCustomYears: number[];
  setSelectedCustomYears: (y: number[]) => void;
  years?: number[];
};

const ALL_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function DateRangeSelector<T extends string>({
  options,
  value,
  onChange,
  customLabel = "Personalizado" as T,
  selectedCustomMonths,
  setSelectedCustomMonths,
  selectedCustomYears,
  setSelectedCustomYears,
  years = [2025, 2026, 2027],
}: Props<T>) {
  const [isCustomMenuOpen, setIsCustomMenuOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  const toggleMonth = (m: string) => {
    if (selectedCustomMonths.includes(m))
      setSelectedCustomMonths(selectedCustomMonths.filter((x) => x !== m));
    else setSelectedCustomMonths([...selectedCustomMonths, m]);
  };

  const toggleYear = (y: number) => {
    if (selectedCustomYears.includes(y))
      setSelectedCustomYears(selectedCustomYears.filter((x) => x !== y));
    else setSelectedCustomYears([...selectedCustomYears, y]);
  };

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
          <div className="stat-label mb-2">Selecione os meses</div>
          <div className="grid grid-cols-6 gap-1.5 mb-4">
            {ALL_MONTHS.map((month) => {
              const isSel = selectedCustomMonths.includes(month);
              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => toggleMonth(month)}
                  className={`
                    py-2 rounded-md text-xs font-semibold transition-all
                    ${isSel
                      ? "bg-primary text-main border border-primary"
                      : "bg-elevated text-secondary border border-border hover:border-border-strong hover:text-primary"
                    }
                  `}
                >
                  {month}
                </button>
              );
            })}
          </div>

          <div className="stat-label mb-2">Selecione os anos</div>
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {years.map((year) => {
              const isSel = selectedCustomYears.includes(year);
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => toggleYear(year)}
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

          <button
            onClick={() => setIsCustomMenuOpen(false)}
            className="btn btn-primary w-full"
          >
            Confirmar período
          </button>
        </div>
      )}
    </div>
  );
}
