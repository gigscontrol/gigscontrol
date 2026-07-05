"use client";

import { useMemo } from "react";
import {
  DollarSign,
  Building2,
  Music,
  Users,
  TrendingUp,
  TrendingDown,
  CalendarCheck2,
  FileText,
  Activity,
  Wallet,
  Layers,
} from "lucide-react";
import { usePlataforma } from "@/lib/plataforma-context";
import { getPlano, precoPorMes, formatarPrecoCurto, type PlanoId } from "@/lib/planos";
import type { StatusAssinatura } from "@/lib/plataforma";

const PLANOS_AGENCIA: PlanoId[] = [
  "equipe",
  "time",
  "agencia",
  "agencia-plus",
  "agencia-max",
];

export default function AdminDashboard() {
  const { assinaturas, kpis } = usePlataforma();

  // Métricas de assinatura calculadas do estado REAL (carrega mesmo se o
  // /api/admin/kpis demorar). Os KPIs server-only (ativos30d, contagens
  // cross-workspace) vêm do `kpis` e mostram "—" enquanto carregam.
  const m = useMemo(() => {
    const ativas = assinaturas.filter((a) => a.status === "ativa");
    let mrrBrl = 0;
    let mrrUsd = 0;
    for (const a of ativas) {
      const preco = precoPorMes(getPlano(a.plano), a.ciclo, a.moeda);
      if (a.moeda === "usd") mrrUsd += preco;
      else mrrBrl += preco;
    }
    const total = assinaturas.length;
    const canceladas = assinaturas.filter((a) => a.status === "cancelada").length;
    const trial = assinaturas.filter((a) => a.status === "trial").length;
    const agencias = assinaturas.filter((a) => PLANOS_AGENCIA.includes(a.plano)).length;
    const totalArtistas = assinaturas.reduce((s, a) => s + a.artistasEmUso, 0);
    const churnPct = total > 0 ? Math.round((canceladas / total) * 1000) / 10 : 0;

    // Distribuição de assinaturas ativas por plano (pro gráfico).
    const porPlano = new Map<PlanoId, number>();
    for (const a of ativas) porPlano.set(a.plano, (porPlano.get(a.plano) ?? 0) + 1);
    const dist = [...porPlano.entries()]
      .map(([plano, n]) => ({ plano, nome: getPlano(plano).nome, n }))
      .sort((x, y) => y.n - x.n);

    // Assinaturas mais recentes (atividade real).
    const recentes = [...assinaturas]
      .sort((a, b) => new Date(b.inicioEm).getTime() - new Date(a.inicioEm).getTime())
      .slice(0, 9);

    return {
      mrrBrl,
      mrrUsd,
      ativas: ativas.length,
      trial,
      agencias,
      totalArtistas,
      churnPct,
      dist,
      recentes,
    };
  }, [assinaturas]);

  const fmtMoedas = (brl: number, usd: number) =>
    usd > 0
      ? `${formatarPrecoCurto(brl, "brl")} · ${formatarPrecoCurto(usd, "usd")}`
      : formatarPrecoCurto(brl, "brl");
  const num = (v: number | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR"));
  const maxDist = Math.max(1, ...m.dist.map((d) => d.n));
  const ticketMedio = m.agencias > 0 ? Math.round(m.mrrBrl / m.agencias) : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted">Visão geral do negócio GIGS CONTROL</p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Kpi icon={<DollarSign size={16} />} label="MRR" value={fmtMoedas(m.mrrBrl, m.mrrUsd)} color="var(--brand)" />
        <Kpi icon={<TrendingUp size={16} />} label="ARR" value={fmtMoedas(m.mrrBrl * 12, m.mrrUsd * 12)} color="var(--brand)" />
        <Kpi icon={<Wallet size={16} />} label="Assinaturas ativas" value={m.ativas} color="var(--success)" />
        <Kpi
          icon={<TrendingDown size={16} />}
          label="Churn"
          value={`${m.churnPct}%`}
          color={m.churnPct > 0 ? "var(--danger)" : "var(--success)"}
        />
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi icon={<Users size={16} />} label="Total de usuários" value={num(kpis?.totalUsuarios)} color="var(--brand)" />
        <Kpi icon={<Building2 size={16} />} label="Agências" value={m.agencias} color="var(--brand)" />
        <Kpi icon={<Music size={16} />} label="Artistas" value={m.totalArtistas} color="var(--brand)" />
        <Kpi icon={<Activity size={16} />} label="Ativos (30d)" value={num(kpis?.ativos30d)} color="var(--brand)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
        {/* Distribuição por plano (dado REAL) */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={16} style={{ color: "var(--brand)" }} />
            <div className="section-title">Assinaturas ativas por plano</div>
          </div>
          {m.dist.length === 0 ? (
            <div className="text-sm text-muted py-8 text-center">Nenhuma assinatura ativa ainda.</div>
          ) : (
            <div className="flex items-end justify-between gap-2 h-44 px-1">
              {m.dist.map((d) => (
                <div key={d.plano} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                  <div className="text-[0.65rem] text-muted tabular-nums">{d.n}</div>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{ height: `${(d.n / maxDist) * 130}px`, backgroundColor: "var(--brand)", minHeight: 4 }}
                  />
                  <div className="text-[0.65rem] text-secondary text-center truncate w-full" title={d.nome}>
                    {d.nome}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Métricas reais da plataforma */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-border">
            <MiniStat icon={<CalendarCheck2 size={14} />} label="Shows cadastrados" value={num(kpis?.totalShows)} />
            <MiniStat icon={<FileText size={14} />} label="Contratos gerados" value={num(kpis?.totalContratos)} />
            <MiniStat icon={<FileText size={14} />} label="Orçamentos" value={num(kpis?.totalOrcamentos)} />
            <MiniStat icon={<DollarSign size={14} />} label="Ticket médio/mês" value={formatarPrecoCurto(ticketMedio, "brl")} />
          </div>
        </div>

        {/* Assinaturas recentes (atividade REAL) */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} style={{ color: "var(--brand)" }} />
            <div className="section-title">Assinaturas recentes</div>
          </div>
          {m.recentes.length === 0 ? (
            <div className="text-sm text-muted py-8 text-center">Sem assinaturas ainda.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {m.recentes.map((a) => {
                const st = statusInfo(a.status);
                return (
                  <div key={a.workspaceId} className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0">
                    <div
                      className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${st.cor}1a`, color: st.cor }}
                    >
                      <Building2 size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-primary leading-snug truncate">
                        {a.nomeWorkspace} · {getPlano(a.plano).nome}
                      </div>
                      <div className="text-[0.65rem] text-muted">
                        <span style={{ color: st.cor }}>{st.label}</span> · {formatarData(a.inicioEm)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function statusInfo(s: StatusAssinatura): { label: string; cor: string } {
  switch (s) {
    case "ativa":
      return { label: "Ativa", cor: "var(--success)" };
    case "trial":
      return { label: "Trial", cor: "var(--brand)" };
    case "suspensa":
      return { label: "Suspensa", cor: "var(--warning)" };
    case "cancelada":
      return { label: "Cancelada", cor: "var(--danger)" };
    default:
      return { label: String(s), cor: "var(--text-muted)" };
  }
}

function formatarData(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Kpi({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div
          className="h-8 w-8 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {icon}
        </div>
      </div>
      <div className="text-xl font-bold tabular-nums text-primary">{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-muted mb-0.5">
        {icon}
        <span className="text-[0.65rem] uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-sm font-bold tabular-nums text-primary">{value}</div>
    </div>
  );
}
