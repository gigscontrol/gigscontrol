"use client";

import { useMemo } from "react";
import {
  FileText,
  CalendarCheck2,
  DollarSign,
  TrendingUp,
  ChevronRight,
  Plus,
  Percent,
} from "lucide-react";
import PageHeader from "./PageHeader";
import StatCard from "./StatCard";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas } from "@/lib/workspace-context";
import { formatBRL } from "@/lib/whatsapp";
import { MODULE_THEMES, LABELS_STATUS_ORCAMENTO } from "@/types";
import type { ActiveTab, ActivePage } from "@/types";

type Props = {
  selectedDJs: string[];
  onNavigate?: (tab: ActiveTab, page: ActivePage) => void;
  onAbrirOrcamento?: (id: string) => void;
  onAbrirVenda?: (id: string) => void;
};

export default function VendasDashboard({
  selectedDJs,
  onNavigate,
  onAbrirOrcamento,
  onAbrirVenda,
}: Props) {
  const accent = MODULE_THEMES.vendas.color;
  const { orcamentos } = useOrcamentos();
  const { vendas } = useVendas();
  const artistas = useArtistas();

  const orcamentosVisiveis = useMemo(
    () => orcamentos.filter((o) => selectedDJs.includes(o.djId)),
    [orcamentos, selectedDJs]
  );
  const vendasVisiveis = useMemo(
    () => vendas.filter((v) => selectedDJs.includes(v.djId)),
    [vendas, selectedDJs]
  );

  const stats = useMemo(() => {
    const totalOrcamentos = orcamentosVisiveis.length;
    const pendentes = orcamentosVisiveis.filter(
      (o) => o.status === "pendente" || o.status === "negociacao"
    ).length;
    const totalVendas = vendasVisiveis.length;
    const faturamento = vendasVisiveis.reduce((acc, v) => acc + v.cache, 0);
    // Taxa de conversão: vendas / orçamentos
    const conversao =
      totalOrcamentos > 0
        ? Math.round((totalVendas / (totalOrcamentos + totalVendas)) * 100)
        : 0;
    const ticketMedio = totalVendas > 0 ? faturamento / totalVendas : 0;
    return { totalOrcamentos, pendentes, totalVendas, faturamento, conversao, ticketMedio };
  }, [orcamentosVisiveis, vendasVisiveis]);

  // Orçamentos recentes
  const orcamentosRecentes = useMemo(
    () =>
      [...orcamentosVisiveis]
        .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
        .slice(0, 5),
    [orcamentosVisiveis]
  );

  // Vendas recentes
  const vendasRecentes = useMemo(
    () =>
      [...vendasVisiveis]
        .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
        .slice(0, 5),
    [vendasVisiveis]
  );

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Vendas"
        subtitle="Orçamentos, conversão e faturamento"
        accentColor={accent}
        actions={
          <button
            onClick={() => onNavigate?.("vendas", "vendas-novo-orcamento")}
            className="btn btn-primary"
            style={{ backgroundColor: accent, color: "#fff" }}
          >
            <Plus size={14} />
            Novo Orçamento
          </button>
        }
      />

      {/* Cards clicáveis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <ClickableStat onClick={() => onNavigate?.("vendas", "vendas-historico")}>
          <StatCard
            title="Orçamentos"
            value={stats.totalOrcamentos}
            icon={<FileText size={16} />}
            accentColor={accent}
            subtitle={`${stats.pendentes} aguardando`}
          />
        </ClickableStat>
        <ClickableStat onClick={() => onNavigate?.("vendas", "vendas-historico-vendas")}>
          <StatCard
            title="Vendas Fechadas"
            value={stats.totalVendas}
            icon={<CalendarCheck2 size={16} />}
            accentColor="var(--success)"
            subtitle="Concretizadas"
          />
        </ClickableStat>
        <ClickableStat onClick={() => onNavigate?.("vendas", "vendas-historico-vendas")}>
          <StatCard
            title="Faturamento"
            value={formatBRL(stats.faturamento)}
            icon={<DollarSign size={16} />}
            accentColor={accent}
            subtitle="Soma das vendas"
          />
        </ClickableStat>
        <ClickableStat onClick={() => onNavigate?.("vendas", "vendas-historico")}>
          <StatCard
            title="Taxa de Conversão"
            value={`${stats.conversao}%`}
            icon={<Percent size={16} />}
            accentColor={accent}
            subtitle="Orçamentos → vendas"
          />
        </ClickableStat>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Orçamentos recentes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="section-title">Orçamentos recentes</div>
            <button
              onClick={() => onNavigate?.("vendas", "vendas-historico")}
              className="btn-ghost text-xs inline-flex items-center gap-1"
            >
              Ver todos
              <ChevronRight size={12} />
            </button>
          </div>
          {orcamentosRecentes.length === 0 ? (
            <div className="text-sm text-muted text-center py-8">
              Nenhum orçamento ainda.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {orcamentosRecentes.map((o) => {
                const dj = artistas.find((d) => d.id === o.djId);
                const st = LABELS_STATUS_ORCAMENTO[o.status];
                return (
                  <button
                    key={o.id}
                    onClick={() => onAbrirOrcamento?.(o.id)}
                    className="flex items-center gap-3 p-2.5 rounded-md border border-border bg-elevated hover:border-border-strong transition-colors text-left"
                  >
                    <span
                      className="font-mono text-xs font-bold flex-shrink-0"
                      style={{ color: accent }}
                    >
                      {o.numero}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary truncate">
                        {dj?.name}
                      </div>
                      <div className="text-xs text-muted tabular-nums">
                        {formatBRL(o.valorCache)}
                      </div>
                    </div>
                    <span className={`badge ${st.badge}`}>{st.label}</span>
                    <ChevronRight size={14} className="text-muted flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Vendas recentes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="section-title">Vendas recentes</div>
            <button
              onClick={() => onNavigate?.("vendas", "vendas-historico-vendas")}
              className="btn-ghost text-xs inline-flex items-center gap-1"
            >
              Ver todas
              <ChevronRight size={12} />
            </button>
          </div>
          {vendasRecentes.length === 0 ? (
            <div className="text-sm text-muted text-center py-8">
              Nenhuma venda concretizada ainda.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {vendasRecentes.map((v) => {
                const dj = artistas.find((d) => d.id === v.djId);
                return (
                  <button
                    key={v.id}
                    onClick={() => onAbrirVenda?.(v.id)}
                    className="flex items-center gap-3 p-2.5 rounded-md border border-border bg-elevated hover:border-border-strong transition-colors text-left"
                  >
                    <span
                      className="font-mono text-xs font-bold flex-shrink-0"
                      style={{ color: accent }}
                    >
                      {v.numero}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary truncate">
                        {v.nomeEvento}
                      </div>
                      <div className="text-xs text-muted truncate">
                        {dj?.name} · {v.contratanteNome}
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-primary flex-shrink-0">
                      {formatBRL(v.cache)}
                    </span>
                    <ChevronRight size={14} className="text-muted flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ticket médio */}
      {stats.totalVendas > 0 && (
        <div className="card mt-4 flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accent}20`, color: accent }}
          >
            <TrendingUp size={18} />
          </div>
          <div>
            <div className="stat-label">Ticket médio por venda</div>
            <div className="text-xl font-bold tabular-nums text-primary">
              {formatBRL(stats.ticketMedio)}
            </div>
          </div>
        </div>
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
