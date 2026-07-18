"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useT } from "@/lib/i18n";
import { gradienteSutil } from "@/lib/gradiente";
import { totaisPorMoeda } from "@/lib/formatters";
import type { RankingLinha } from "@/lib/agencia-dashboard";
import type { Moeda } from "@/types";

/**
 * Card de ranking do Dashboard da Agência — APRESENTACIONAL puro (sem
 * contexts/fetch). Recebe as linhas já agregadas (com duas métricas `a`/`b`)
 * e dois modos de exibição; mantém só o estado local do toggle e do
 * expandir/recolher. Ordena e formata conforme a métrica ativa.
 */

export type MetricaConfig = {
  /** Rótulo do botão do toggle (já traduzido pelo pai). */
  label: string;
  /** Qual campo da linha essa métrica usa. */
  campo: "a" | "b";
  /** Formata o número pra exibição (ex.: formatBRL pra R$, String pra contagem). */
  formato: (n: number) => string;
  /**
   * Métrica MONETÁRIA: exibe por moeda (`totaisPorMoeda` sobre a quebra da
   * linha — regra-mãe: nunca soma moedas diferentes) em vez de `formato`.
   * Ordena/dimensiona a barra ainda por `l[campo]` (soma bruta — D-RANKING).
   * Sem a quebra na linha (caso 1-moeda antigo) cai no `formato`.
   */
  moeda?: boolean;
};

type Props = {
  /** Ícone lucide do cabeçalho. */
  icon: ReactNode;
  /** Título do card (já traduzido pelo pai). */
  titulo: string;
  /** Linhas agregadas (não precisam vir ordenadas). */
  linhas: RankingLinha[];
  /** Duas métricas do toggle — a primeira é a padrão. */
  metricas: [MetricaConfig, MetricaConfig];
  /** Cor de acento das barras/ícone quando a linha não tem cor própria. */
  accent?: string;
  /** Texto do estado vazio (já traduzido pelo pai). */
  vazioLabel: string;
};

const TOP = 5;

export default function RankingCard({
  icon,
  titulo,
  linhas,
  metricas,
  accent = "var(--brand)",
  vazioLabel,
}: Props) {
  const t = useT();
  const [metricaIdx, setMetricaIdx] = useState(0);
  const [expandido, setExpandido] = useState(false);

  const metrica = metricas[metricaIdx];

  // Ordena pela métrica ativa (desc) e descarta linhas zeradas nela — um
  // ranking só faz sentido com quem pontuou naquela métrica.
  const ordenadas = useMemo(() => {
    const campo = metrica.campo;
    return linhas
      .filter((l) => l[campo] > 0)
      .sort((x, y) => y[campo] - x[campo]);
  }, [linhas, metrica.campo]);

  const max = ordenadas.length > 0 ? ordenadas[0][metrica.campo] : 1;
  const visiveis = expandido ? ordenadas : ordenadas.slice(0, TOP);
  const temMais = ordenadas.length > TOP;

  // Texto exibido da métrica: se for monetária e a linha trouxer a quebra por
  // moeda, mostra "R$ … + US$ …" (nunca uma soma mista); senão, o número puro.
  const textoMetrica = (l: RankingLinha): string => {
    if (metrica.moeda) {
      const mapa = metrica.campo === "a" ? l.moedasA : l.moedasB;
      if (mapa) {
        const itens = (Object.entries(mapa) as [Moeda, number][]).map(
          ([moeda, valor]) => ({ valor, moeda })
        );
        return totaisPorMoeda(itens);
      }
    }
    return metrica.formato(l[metrica.campo]);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ color: accent }} className="flex-shrink-0">
            {icon}
          </span>
          <div className="section-title truncate">{titulo}</div>
        </div>

        {/* Toggle segmentado de métrica */}
        <div className="inline-flex flex-shrink-0 rounded-md bg-elevated p-0.5">
          {metricas.map((m, idx) => {
            const ativo = idx === metricaIdx;
            return (
              <button
                key={m.label}
                type="button"
                onClick={() => setMetricaIdx(idx)}
                aria-pressed={ativo}
                className="px-2 py-1 rounded-[5px] text-xs font-medium transition-colors whitespace-nowrap"
                style={
                  ativo
                    ? {
                        backgroundColor: "color-mix(in srgb, var(--brand) 16%, transparent)",
                        color: "var(--brand)",
                      }
                    : { color: "var(--text-muted)" }
                }
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {ordenadas.length === 0 ? (
        <div className="text-sm text-muted text-center py-8">{vazioLabel}</div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {visiveis.map((l, i) => {
              const valor = l[metrica.campo];
              const pct = max > 0 ? Math.round((valor / max) * 100) : 0;
              const inicial = (l.nome.trim()[0] ?? "—").toUpperCase();
              return (
                <div key={l.id} className="flex items-center gap-2.5">
                  <span className="w-4 flex-shrink-0 text-right text-xs tabular-nums text-muted">
                    {i + 1}
                  </span>
                  <span
                    className="h-6 w-6 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold"
                    style={
                      l.cor
                        ? { backgroundColor: l.cor, color: "#fff" }
                        : {
                            backgroundColor:
                              "color-mix(in srgb, var(--text-primary) 8%, transparent)",
                            color: "var(--text-secondary)",
                          }
                    }
                  >
                    {inicial}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm text-primary truncate">{l.nome}</span>
                      <span className="text-sm tabular-nums text-secondary flex-shrink-0">
                        {textoMetrica(l)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-elevated overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: l.cor ? gradienteSutil(l.cor) : "var(--grad-signal)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {temMais && (
            <button
              type="button"
              onClick={() => setExpandido((v) => !v)}
              className="btn-ghost text-xs inline-flex items-center gap-1 mt-3"
            >
              {expandido ? (
                <>
                  {t("Mostrar menos")}
                  <ChevronUp size={12} />
                </>
              ) : (
                <>
                  {t("Mostrar todos ({n})", { n: ordenadas.length })}
                  <ChevronDown size={12} />
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
