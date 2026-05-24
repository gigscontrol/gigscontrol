"use client";

import { useMemo } from "react";
import {
  DollarSign,
  CheckCircle2,
  CalendarClock,
  AlertTriangle,
  ChevronRight,
  Wallet,
  TrendingUp,
} from "lucide-react";
import PageHeader from "./PageHeader";
import StatCard from "./StatCard";
import { useVendas } from "@/lib/vendas-context";
import { DJS } from "@/lib/djs";
import { formatBRL } from "@/lib/whatsapp";
import {
  MODULE_THEMES,
  LABELS_STATUS_PARCELA,
  statusEfetivoParcela,
  type Parcela,
} from "@/types";
import type { ActiveTab, ActivePage } from "@/types";

type Props = {
  selectedDJs: string[];
  onNavigate?: (tab: ActiveTab, page: ActivePage) => void;
  onAbrirVenda?: (id: string) => void;
};

type LinhaParcela = {
  vendaId: string;
  vendaNumero: string;
  parcela: Parcela;
  indice: number;
  total: number;
  djNome: string;
  djColor: string;
  contratante: string;
};

export default function Dashboard({ selectedDJs, onNavigate, onAbrirVenda }: Props) {
  const accent = MODULE_THEMES.financeiro.color;
  const { vendas } = useVendas();

  const vendasVisiveis = useMemo(
    () => vendas.filter((v) => selectedDJs.includes(v.djId)),
    [vendas, selectedDJs]
  );

  // Achata parcelas
  const parcelas = useMemo<LinhaParcela[]>(() => {
    const linhas: LinhaParcela[] = [];
    for (const v of vendasVisiveis) {
      const dj = DJS.find((d) => d.id === v.djId);
      v.parcelas.forEach((parcela, idx) => {
        linhas.push({
          vendaId: v.id,
          vendaNumero: v.numero,
          parcela,
          indice: idx + 1,
          total: v.parcelas.length,
          djNome: dj?.name ?? "—",
          djColor: dj?.color ?? "#888",
          contratante: v.contratanteNome,
        });
      });
    }
    return linhas;
  }, [vendasVisiveis]);

  const totais = useMemo(() => {
    let recebido = 0;
    let aReceber = 0;
    let atrasado = 0;
    for (const l of parcelas) {
      const st = statusEfetivoParcela(l.parcela);
      if (st === "pago") recebido += l.parcela.valor;
      else if (st === "atrasado") atrasado += l.parcela.valor;
      else aReceber += l.parcela.valor;
    }
    return { recebido, aReceber, atrasado, total: recebido + aReceber + atrasado };
  }, [parcelas]);

  // Próximos vencimentos (pendentes/atrasados, ordenado por data)
  const proximosVencimentos = useMemo(() => {
    return parcelas
      .filter((l) => statusEfetivoParcela(l.parcela) !== "pago")
      .sort(
        (a, b) =>
          new Date(a.parcela.dataVencimento).getTime() -
          new Date(b.parcela.dataVencimento).getTime()
      )
      .slice(0, 6);
  }, [parcelas]);

  // Faturamento por DJ
  const porDJ = useMemo(() => {
    return DJS.filter((d) => selectedDJs.includes(d.id))
      .map((dj) => ({
        dj,
        valor: vendasVisiveis
          .filter((v) => v.djId === dj.id)
          .reduce((acc, v) => acc + v.cache, 0),
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [vendasVisiveis, selectedDJs]);

  const maxDJ = Math.max(1, ...porDJ.map((p) => p.valor));
  const pctRecebido =
    totais.total > 0 ? Math.round((totais.recebido / totais.total) * 100) : 0;

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Financeiro"
        subtitle="Recebimentos, pendências e faturamento"
        accentColor={accent}
        actions={
          <button
            onClick={() => onNavigate?.("financeiro", "financeiro-pagamentos")}
            className="btn btn-primary"
            style={{ backgroundColor: accent, color: "#fff" }}
          >
            <Wallet size={14} />
            Controle de Pagamentos
          </button>
        }
      />

      {/* Cards clicáveis — levam ao controle de pagamentos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <ClickableStat onClick={() => onNavigate?.("financeiro", "financeiro-pagamentos")}>
          <StatCard
            title="Total em Vendas"
            value={formatBRL(totais.total)}
            icon={<DollarSign size={16} />}
            accentColor={accent}
            subtitle="Soma de todas as parcelas"
          />
        </ClickableStat>
        <ClickableStat onClick={() => onNavigate?.("financeiro", "financeiro-pagamentos")}>
          <StatCard
            title="Recebido"
            value={formatBRL(totais.recebido)}
            icon={<CheckCircle2 size={16} />}
            accentColor="var(--success)"
            subtitle={`${pctRecebido}% do total`}
          />
        </ClickableStat>
        <ClickableStat onClick={() => onNavigate?.("financeiro", "financeiro-pagamentos")}>
          <StatCard
            title="A Receber"
            value={formatBRL(totais.aReceber)}
            icon={<CalendarClock size={16} />}
            accentColor="var(--warning)"
            subtitle="Parcelas pendentes"
          />
        </ClickableStat>
        <ClickableStat onClick={() => onNavigate?.("financeiro", "financeiro-pagamentos")}>
          <StatCard
            title="Atrasado"
            value={formatBRL(totais.atrasado)}
            icon={<AlertTriangle size={16} />}
            accentColor="var(--danger)"
            subtitle="Vencidas e não pagas"
          />
        </ClickableStat>
      </div>

      {/* Barra de progresso de recebimento */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="section-title">Progresso de recebimento</div>
          <span className="text-sm font-bold tabular-nums" style={{ color: accent }}>
            {pctRecebido}%
          </span>
        </div>
        <div className="h-3 rounded-full bg-elevated overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pctRecebido}%`, backgroundColor: "var(--success)" }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted">
          <span>Recebido {formatBRL(totais.recebido)}</span>
          <span>Falta {formatBRL(totais.aReceber + totais.atrasado)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Próximos vencimentos */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="section-title">Próximos vencimentos</div>
            <button
              onClick={() => onNavigate?.("financeiro", "financeiro-pagamentos")}
              className="btn-ghost text-xs inline-flex items-center gap-1"
            >
              Ver todos
              <ChevronRight size={12} />
            </button>
          </div>
          {proximosVencimentos.length === 0 ? (
            <div className="text-sm text-muted text-center py-8">
              Nenhuma parcela pendente. Tudo em dia!
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {proximosVencimentos.map((l) => {
                const st = statusEfetivoParcela(l.parcela);
                const label = LABELS_STATUS_PARCELA[st];
                return (
                  <button
                    key={`${l.vendaId}-${l.parcela.id}`}
                    onClick={() => onAbrirVenda?.(l.vendaId)}
                    className="flex items-center gap-3 p-2.5 rounded-md border border-border bg-elevated hover:border-border-strong transition-colors text-left"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: l.djColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary truncate">
                        {l.contratante}
                        <span className="text-muted text-xs ml-1.5">
                          {l.vendaNumero} · parc {l.indice}/{l.total}
                        </span>
                      </div>
                      <div className="text-xs text-muted">
                        Vence{" "}
                        {new Date(
                          l.parcela.dataVencimento + "T12:00:00"
                        ).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-primary flex-shrink-0">
                      {formatBRL(l.parcela.valor)}
                    </span>
                    <span className={`badge ${label.badge}`}>{label.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Faturamento por DJ */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} style={{ color: accent }} />
            <div className="section-title">Faturamento por DJ</div>
          </div>
          {porDJ.every((p) => p.valor === 0) ? (
            <div className="text-sm text-muted text-center py-8">
              Sem vendas registradas.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {porDJ.map(({ dj, valor }) => (
                <div key={dj.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-primary">{dj.name}</span>
                    <span className="tabular-nums text-secondary">
                      {formatBRL(valor)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(valor / maxDJ) * 100}%`,
                        backgroundColor: dj.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {totais.atrasado > 0 && (
        <button
          onClick={() => onNavigate?.("financeiro", "financeiro-pagamentos")}
          className="card mt-4 flex items-center gap-3 w-full text-left hover:border-border-strong transition-colors"
          style={{
            borderColor: "var(--danger)",
            backgroundColor: "rgba(239,68,68,0.06)",
          }}
        >
          <AlertTriangle
            size={18}
            className="flex-shrink-0"
            style={{ color: "var(--danger)" }}
          />
          <div className="flex-1 text-sm text-secondary">
            Você tem <strong>{formatBRL(totais.atrasado)}</strong> em parcelas
            atrasadas. Toque para resolver no Controle de Pagamentos.
          </div>
          <ChevronRight size={16} className="text-muted flex-shrink-0" />
        </button>
      )}
    </div>
  );
}

function ClickableStat({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left transition-transform hover:-translate-y-0.5 active:translate-y-0"
    >
      {children}
    </button>
  );
}
