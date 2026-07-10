"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  Users,
  Building2,
  MapPin,
  Music,
  ChevronRight,
  UserPlus,
  TrendingUp,
} from "lucide-react";
import PageHeader from "./PageHeader";
import StatCard from "./StatCard";
import DateRangeSelector from "./DateRangeSelector";
import { useContatos } from "@/lib/contatos-context";
import { useShows } from "@/lib/shows-context";
import { useVendas } from "@/lib/vendas-context";
import { useWorkspace } from "@/lib/workspace-context";
import { formatBRL } from "@/lib/whatsapp";
import { MODULE_THEMES } from "@/types";
import type { ContatoCategoria, AgendaDateRange } from "@/types";

const ACCENT = MODULE_THEMES.contatos.color;

const MESES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ATALHOS: AgendaDateRange[] = ["Visão geral", "Mês anterior", "Mês atual", "Próximo mês", "Personalizado"];

/** {ano, mes(0-based), tudo}. "Visão geral" = all-time. */
function resolverMes(
  range: AgendaDateRange,
  customMonth: string | null,
  customYear: number | null
): { ano: number; mes: number; tudo: boolean } {
  const h = new Date();
  if (range === "Visão geral") return { ano: h.getFullYear(), mes: h.getMonth(), tudo: true };
  if (range === "Mês anterior") {
    const d = new Date(h.getFullYear(), h.getMonth() - 1, 1);
    return { ano: d.getFullYear(), mes: d.getMonth(), tudo: false };
  }
  if (range === "Próximo mês") {
    const d = new Date(h.getFullYear(), h.getMonth() + 1, 1);
    return { ano: d.getFullYear(), mes: d.getMonth(), tudo: false };
  }
  if (range === "Personalizado" && customMonth && customYear !== null) {
    return { ano: customYear, mes: Math.max(0, MESES_CURTO.indexOf(customMonth)), tudo: false };
  }
  return { ano: h.getFullYear(), mes: h.getMonth(), tudo: false };
}

/** Casa uma data ISO (YYYY-MM-DD do show, ou timestamp da venda) no período. */
function dataNoMes(dataISO: string | undefined, p: { ano: number; mes: number; tudo: boolean }): boolean {
  if (p.tudo) return true;
  if (!dataISO) return false;
  const d = dataISO.length <= 10 ? new Date(`${dataISO}T12:00:00`) : new Date(dataISO);
  return d.getFullYear() === p.ano && d.getMonth() === p.mes;
}

type Props = {
  /** Abre a aba de Contatos numa categoria específica */
  onAbrirCategoria?: (cat: ContatoCategoria) => void;
};

export default function ContatosDashboard({ onAbrirCategoria }: Props) {
  const t = useT();
  const { contratantes, casas, cidades } = useContatos();
  const { shows } = useShows();
  const { vendas } = useVendas();
  const { workspaceCriadoEm } = useWorkspace();

  const [range, setRange] = useState<AgendaDateRange>("Mês atual");
  const [customMonth, setCustomMonth] = useState<string | null>(null);
  const [customYear, setCustomYear] = useState<number | null>(null);
  const periodo = useMemo(
    () => resolverMes(range, customMonth, customYear),
    [range, customMonth, customYear]
  );
  const tituloPeriodo = periodo.tudo ? t("Visão geral") : `${MESES_LONGO[periodo.mes]} ${periodo.ano}`;

  // Atividade no período (o dashboard filtra por atividade, não por cadastro).
  const showsPeriodo = useMemo(
    () => shows.filter((s) => dataNoMes(s.data, periodo)),
    [shows, periodo]
  );
  const vendasPeriodo = useMemo(
    () => vendas.filter((v) => dataNoMes(v.criadoEm, periodo)),
    [vendas, periodo]
  );

  // Cidades com shows (all-time) — subtítulo do card de cidades.
  const cidadesComShows = useMemo(
    () => new Set(shows.map((s) => s.cidadeId).filter(Boolean)).size,
    [shows]
  );

  // Ranking de contratantes por faturamento NO PERÍODO (só quem teve atividade).
  const rankingContratantes = useMemo(() => {
    return contratantes
      .map((c) => {
        const vDo = vendasPeriodo.filter((v) => v.contratanteId === c.id);
        const sDo = showsPeriodo.filter((s) => s.contratanteId === c.id);
        const faturamento = vDo.reduce((acc, v) => acc + v.cache, 0);
        return {
          contratante: c,
          totalShows: sDo.length,
          totalVendas: vDo.length,
          faturamento,
        };
      })
      .filter((r) => r.faturamento > 0 || r.totalShows > 0 || r.totalVendas > 0)
      .sort((a, b) => b.faturamento - a.faturamento || b.totalShows - a.totalShows)
      .slice(0, 8);
  }, [contratantes, vendasPeriodo, showsPeriodo]);

  const maxFat = Math.max(1, ...rankingContratantes.map((r) => r.faturamento));

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Contatos"
        subtitle="Contratantes, casas e cidades da agência"
        accentColor={ACCENT}
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <DateRangeSelector
              options={ATALHOS}
              value={range}
              onChange={setRange}
              selectedCustomMonth={customMonth}
              setSelectedCustomMonth={setCustomMonth}
              selectedCustomYear={customYear}
              setSelectedCustomYear={setCustomYear}
              accountCreatedAt={workspaceCriadoEm}
            />
            <button
              onClick={() => onAbrirCategoria?.("contratantes")}
              className="btn btn-primary"
            >
              <UserPlus size={14} />
              {t("Gerenciar Contatos")}
            </button>
          </div>
        }
      />

      {/* 4 cards — um de cada cor. Os 3 primeiros são totais da base; o 4º
          (shows) segue o período selecionado. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ClickableStat onClick={() => onAbrirCategoria?.("contratantes")}>
          <StatCard
            title={t("Contratantes")}
            value={contratantes.length}
            icon={<Users size={16} />}
            accentColor="var(--info)"
            subtitle={t("Toque para gerenciar")}
          />
        </ClickableStat>
        <ClickableStat onClick={() => onAbrirCategoria?.("casas")}>
          <StatCard
            title={t("Casas / Locais")}
            value={casas.length}
            icon={<Building2 size={16} />}
            accentColor="var(--success)"
            subtitle={t("Clubs, festivais, bares")}
          />
        </ClickableStat>
        <ClickableStat onClick={() => onAbrirCategoria?.("cidades")}>
          <StatCard
            title={t("Cidades")}
            value={cidades.length}
            icon={<MapPin size={16} />}
            accentColor="var(--warning)"
            subtitle={t("{n} com shows", { n: cidadesComShows })}
          />
        </ClickableStat>
        <StatCard
          title={t("Shows no período")}
          value={showsPeriodo.length}
          icon={<Music size={16} />}
          accentColor="var(--danger)"
          subtitle={tituloPeriodo}
        />
      </div>

      {/* Parte de baixo: ranking de contratantes por faturamento no período */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} style={{ color: ACCENT }} />
            <div className="section-title">{t("Principais contratantes")}</div>
            <span className="badge badge-neutral">{tituloPeriodo}</span>
          </div>
          <button
            onClick={() => onAbrirCategoria?.("contratantes")}
            className="btn-ghost text-xs inline-flex items-center gap-1"
          >
            {t("Ver todos")}
            <ChevronRight size={12} />
          </button>
        </div>

        {rankingContratantes.length === 0 ? (
          <div className="text-sm text-muted text-center py-10">
            {t("Nenhum contratante com atividade neste período.")}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rankingContratantes.map((r, i) => (
              <button
                key={r.contratante.id}
                onClick={() => onAbrirCategoria?.("contratantes")}
                className="text-left flex items-center gap-3"
              >
                <span
                  className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold tabular-nums flex-shrink-0"
                  style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-primary truncate">
                      {r.contratante.nome}
                    </span>
                    <span className="tabular-nums text-secondary flex-shrink-0 ml-2">
                      {r.faturamento > 0 ? formatBRL(r.faturamento) : "—"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(r.faturamento / maxFat) * 100}%`,
                        background: "var(--grad-signal)",
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {r.totalShows} {r.totalShows === 1 ? t("show") : t("shows")} ·{" "}
                    {r.totalVendas} {r.totalVendas === 1 ? t("venda") : t("vendas")}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <AtalhoCard
          icon={<Users size={16} />}
          label={t("Novo contratante")}
          onClick={() => onAbrirCategoria?.("contratantes")}
        />
        <AtalhoCard
          icon={<Building2 size={16} />}
          label={t("Nova casa")}
          onClick={() => onAbrirCategoria?.("casas")}
        />
        <AtalhoCard
          icon={<MapPin size={16} />}
          label={t("Nova cidade")}
          onClick={() => onAbrirCategoria?.("cidades")}
        />
      </div>
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

function AtalhoCard({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card-interactive flex items-center gap-3"
    >
      <div
        className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}
      >
        {icon}
      </div>
      <span className="text-sm font-medium text-primary flex-1 text-left">
        {label}
      </span>
      <ChevronRight size={14} className="text-muted" />
    </button>
  );
}
