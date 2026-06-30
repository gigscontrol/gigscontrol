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
  LogIn,
  CreditCard,
  UserCog,
  Layers,
  Settings2,
} from "lucide-react";
import { usePlataforma } from "@/lib/plataforma-context";
import {
  MOCK_LOGS,
  MOCK_CRESCIMENTO,
  METRICAS_SAAS,
  type TipoLog,
} from "@/lib/plataforma";
import { getPlano, precoPorMes, formatarPrecoCurto } from "@/lib/planos";

export default function AdminDashboard() {
  const { assinaturas, usuarios } = usePlataforma();

  const kpis = useMemo(() => {
    const ativas = assinaturas.filter((a) => a.status === "ativa");
    let mrr = 0;
    for (const a of ativas) mrr += precoPorMes(getPlano(a.plano), a.ciclo);

    const agencias = assinaturas.filter((a) =>
      ["equipe", "time", "agencia", "agencia-plus", "agencia-max"].includes(a.plano)
    ).length;
    const totalArtistas = assinaturas.reduce((s, a) => s + a.artistasEmUso, 0);

    // Crescimento do MRR — último mês vs penúltimo
    const c = MOCK_CRESCIMENTO;
    const atual = c[c.length - 1]?.receita ?? 0;
    const anterior = c[c.length - 2]?.receita ?? 0;
    const crescimentoPct =
      anterior > 0 ? Math.round(((atual - anterior) / anterior) * 100) : 0;

    return {
      mrr,
      arr: mrr * 12,
      totalUsuarios: usuarios.length,
      agencias,
      totalArtistas,
      crescimentoPct,
    };
  }, [assinaturas, usuarios]);

  const maxReceita = Math.max(...MOCK_CRESCIMENTO.map((p) => p.receita));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted">Visão geral do negócio GIGS CONTROL</p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Kpi
          icon={<DollarSign size={16} />}
          label="MRR"
          value={formatarPrecoCurto(kpis.mrr)}
          color="var(--module-financeiro)"
          trend={kpis.crescimentoPct}
        />
        <Kpi
          icon={<TrendingUp size={16} />}
          label="ARR"
          value={formatarPrecoCurto(kpis.arr)}
          color="var(--module-financeiro)"
        />
        <Kpi
          icon={<DollarSign size={16} />}
          label="Receita total"
          value={formatarPrecoCurto(METRICAS_SAAS.receitaTotal)}
          color="var(--module-vendas)"
        />
        <Kpi
          icon={<TrendingDown size={16} />}
          label="Churn mensal"
          value={`${METRICAS_SAAS.churnMensal}%`}
          color="var(--danger)"
        />
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi
          icon={<Users size={16} />}
          label="Total de usuários"
          value={kpis.totalUsuarios}
          color="var(--module-contatos)"
        />
        <Kpi
          icon={<Building2 size={16} />}
          label="Agências"
          value={kpis.agencias}
          color="var(--module-vendas)"
        />
        <Kpi
          icon={<Music size={16} />}
          label="Artistas"
          value={kpis.totalArtistas}
          color="var(--module-agenda)"
        />
        <Kpi
          icon={<Activity size={16} />}
          label="Usuários ativos (30d)"
          value={METRICAS_SAAS.usuariosAtivos30d}
          color="var(--module-financeiro)"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
        {/* Gráfico de crescimento */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} style={{ color: "var(--module-financeiro)" }} />
            <div className="section-title">Crescimento do MRR</div>
          </div>
          <div className="flex items-end justify-between gap-2 h-44 px-1">
            {MOCK_CRESCIMENTO.map((p) => (
              <div key={p.mes} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-[0.65rem] text-muted tabular-nums">
                  {formatarPrecoCurto(p.receita)}
                </div>
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${(p.receita / maxReceita) * 130}px`,
                    backgroundColor: "var(--module-financeiro)",
                    minHeight: 4,
                  }}
                />
                <div className="text-xs text-secondary">{p.mes}</div>
              </div>
            ))}
          </div>
          {/* Métricas SaaS extras */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-border">
            <MiniStat
              icon={<CalendarCheck2 size={14} />}
              label="Shows cadastrados"
              value={METRICAS_SAAS.showsCadastrados.toLocaleString("pt-BR")}
            />
            <MiniStat
              icon={<FileText size={14} />}
              label="Contratos gerados"
              value={METRICAS_SAAS.contratosGerados.toLocaleString("pt-BR")}
            />
            <MiniStat
              icon={<TrendingUp size={14} />}
              label="LTV médio"
              value={formatarPrecoCurto(METRICAS_SAAS.ltv)}
            />
            <MiniStat
              icon={<TrendingDown size={14} />}
              label="CAC médio"
              value={formatarPrecoCurto(METRICAS_SAAS.cac)}
            />
          </div>
        </div>

        {/* Logs / atividade recente */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} style={{ color: "var(--module-vendas)" }} />
            <div className="section-title">Atividade recente</div>
          </div>
          <div className="flex flex-col gap-1">
            {MOCK_LOGS.slice(0, 9).map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2.5 py-2 border-b border-border/50 last:border-0"
              >
                <div
                  className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: `${corLog(log.tipo)}1a`,
                    color: corLog(log.tipo),
                  }}
                >
                  {iconeLog(log.tipo)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-primary leading-snug">
                    {log.descricao}
                  </div>
                  <div className="text-[0.65rem] text-muted">
                    {log.workspace ? `${log.workspace} · ` : ""}
                    {formatarData(log.data)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function corLog(tipo: TipoLog): string {
  const m: Record<TipoLog, string> = {
    login: "var(--module-agenda)",
    assinatura: "var(--module-vendas)",
    pagamento: "var(--module-financeiro)",
    usuario: "var(--module-contatos)",
    plano: "var(--module-vendas)",
    sistema: "var(--text-muted)",
  };
  return m[tipo];
}

function iconeLog(tipo: TipoLog) {
  const s = 13;
  switch (tipo) {
    case "login":
      return <LogIn size={s} />;
    case "pagamento":
      return <CreditCard size={s} />;
    case "usuario":
      return <UserCog size={s} />;
    case "plano":
      return <Layers size={s} />;
    case "sistema":
      return <Settings2 size={s} />;
    default:
      return <Building2 size={s} />;
  }
}

function formatarData(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Kpi({
  icon,
  label,
  value,
  color,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  trend?: number;
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
        {trend !== undefined && (
          <span
            className="text-xs font-semibold tabular-nums inline-flex items-center gap-0.5"
            style={{
              color: trend >= 0 ? "var(--success)" : "var(--danger)",
            }}
          >
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {trend >= 0 ? "+" : ""}
            {trend}%
          </span>
        )}
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
