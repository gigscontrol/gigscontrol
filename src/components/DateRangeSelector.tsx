"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Check, ChevronDown } from "lucide-react";
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
  const [isOpen, setIsOpen] = useState(false);
  // Visão do popover: "list" = menu de opções · "custom" = seletor de ano/mês
  const [view, setView] = useState<"list" | "custom">("list");
  const rootRef = useRef<HTMLDivElement>(null);

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

  // Fecha popover ao clicar fora (o ref envolve trigger + popover)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Fecha popover com Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

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

  // Abre o popover já na visão coerente com o valor atual
  function toggleOpen() {
    if (isOpen) {
      setIsOpen(false);
    } else {
      setView(value === customLabel ? "custom" : "list");
      setIsOpen(true);
    }
  }

  // Rótulo do trigger: no Personalizado com mês+ano definidos, mostra "Mai · 2026"
  const triggerLabel =
    value === customLabel && selectedCustomMonth && selectedCustomYear !== null
      ? `${selectedCustomMonth} · ${selectedCustomYear}`
      : t(value);

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-2 h-[38px] px-3 rounded-md bg-surface border border-border text-sm text-primary hover:border-border-strong transition-colors whitespace-nowrap"
      >
        <CalendarDays size={14} className="shrink-0 text-secondary" />
        <span>{triggerLabel}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-secondary transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className={`absolute top-full left-0 sm:left-auto sm:right-0 mt-2 z-50 max-w-[calc(100vw-32px)] bg-surface border border-border rounded-lg animate-in ${
            view === "custom" ? "w-[360px] p-4" : "w-[240px] p-1.5"
          }`}
          style={{ boxShadow: "0 12px 40px var(--shadow-color)" }}
        >
          {view === "list" ? (
            <div className="flex flex-col">
              {options.map((opcao) => {
                const isActive = value === opcao;
                return (
                  <button
                    key={opcao}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      if (opcao === customLabel) {
                        onChange(customLabel);
                        setView("custom");
                      } else {
                        onChange(opcao);
                        setIsOpen(false);
                      }
                    }}
                    className={`flex items-center justify-between w-full text-left px-3 py-2 rounded-md text-sm hover:bg-elevated transition-colors ${
                      isActive ? "font-semibold text-primary" : "text-secondary"
                    }`}
                  >
                    <span>{t(opcao)}</span>
                    {isActive && <Check size={14} className="shrink-0 text-brand" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-label={t("Voltar")}
                  className="inline-flex items-center justify-center h-7 w-7 -ml-1 rounded-md text-secondary hover:text-primary hover:bg-elevated transition-colors"
                >
                  <ArrowLeft size={14} />
                </button>
                <span className="stat-label">{t(customLabel)}</span>
              </div>

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
                onClick={() => setIsOpen(false)}
                className="btn btn-primary w-full"
                disabled={selectedCustomMonth === null || selectedCustomYear === null}
              >
                {t("Confirmar período")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
