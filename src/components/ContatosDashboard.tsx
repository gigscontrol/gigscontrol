"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  Users,
  Building2,
  MapPin,
  Ban,
  ChevronRight,
  UserPlus,
  TrendingUp,
} from "lucide-react";
import PageHeader from "./PageHeader";
import { EstadoCarga } from "./EstadoCarga";
import StatCard from "./StatCard";
import DateRangeSelector from "./DateRangeSelector";
import {
  ClickableStat,
  ResumoModal,
  ResumoNumero,
  ResumoLista,
  ResumoFooter,
  type ResumoListaItem,
} from "./DashboardResumo";
import { useContatos } from "@/lib/contatos-context";
import { useShows } from "@/lib/shows-context";
import { useVendas } from "@/lib/vendas-context";
import { useWorkspace } from "@/lib/workspace-context";
import { formatarFaturamento } from "@/lib/contatos-stats";
import { MODULE_THEMES } from "@/types";
import type { ContatoCategoria, AgendaDateRange, Moeda } from "@/types";

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

/** Qual card-resumo está aberto (modal na mesma página). */
type ResumoAberto = "contratantes" | "casas" | "cidades" | "bloqueados" | null;

export default function ContatosDashboard({ onAbrirCategoria }: Props) {
  const t = useT();
  const { contratantes, casas, cidades, carregando: carregandoContatos, erro: erroContatos, recarregar: recarregarContatos } = useContatos();
  const { shows } = useShows();
  const { vendas } = useVendas();
  const { workspaceCriadoEm } = useWorkspace();

  const [range, setRange] = useState<AgendaDateRange>("Mês atual");
  const [customMonth, setCustomMonth] = useState<string | null>(null);
  const [customYear, setCustomYear] = useState<number | null>(null);
  const [resumo, setResumo] = useState<ResumoAberto>(null);
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
    // Vendas canceladas (D5) não entram no ranking de faturamento.
    () => vendas.filter((v) => v.status !== "cancelada" && dataNoMes(v.criadoEm, periodo)),
    [vendas, periodo]
  );

  // Cidades com shows (all-time) — subtítulo do card de cidades.
  const cidadesComShows = useMemo(
    () => new Set(shows.map((s) => s.cidadeId).filter(Boolean)).size,
    [shows]
  );

  // Contatos bloqueados (contratantes + casas). Card VERMELHO.
  const contratantesBloqueados = useMemo(
    () => contratantes.filter((c) => c.bloqueado),
    [contratantes]
  );
  const casasBloqueadas = useMemo(() => casas.filter((c) => c.bloqueado), [casas]);
  const totalBloqueados = contratantesBloqueados.length + casasBloqueadas.length;

  // Ranking de contratantes por faturamento NO PERÍODO (só quem teve atividade).
  // D-RANKING: ordena pelo faturamento BRUTO (heurística — exata no caso de uma
  // moeda só) mas EXIBE por moeda (faturamentoPorMoeda), sem somar moedas
  // diferentes num R$ mentiroso.
  const rankingContratantes = useMemo(() => {
    const hojeYmd = new Date().toISOString().slice(0, 10);
    return contratantes
      .map((c) => {
        const vDo = vendasPeriodo.filter((v) => v.contratanteId === c.id);
        const sDo = showsPeriodo.filter((s) => s.contratanteId === c.id);
        const faturamento = vDo.reduce((acc, v) => acc + v.cache, 0);
        const faturamentoPorMoeda: Partial<Record<Moeda, number>> = {};
        for (const v of vDo) {
          faturamentoPorMoeda[v.moeda] = (faturamentoPorMoeda[v.moeda] ?? 0) + v.cache;
        }
        // I13 — realizado = já aconteceu e não foi cancelado; agendado =
        // futuro não-cancelado; cancelado = status. Corte por data local (ymd).
        const cancelados = sDo.filter((s) => s.status === "cancelado").length;
        const realizados = sDo.filter(
          (s) => s.status !== "cancelado" && s.data && s.data <= hojeYmd
        ).length;
        const agendados = sDo.filter(
          (s) => s.status !== "cancelado" && s.data && s.data > hojeYmd
        ).length;
        return {
          contratante: c,
          totalShows: sDo.length,
          realizados,
          agendados,
          cancelados,
          totalVendas: vDo.length,
          faturamento,
          faturamentoPorMoeda,
        };
      })
      .filter((r) => r.faturamento > 0 || r.totalShows > 0 || r.totalVendas > 0)
      .sort((a, b) => b.faturamento - a.faturamento || b.totalShows - a.totalShows)
      .slice(0, 8);
  }, [contratantes, vendasPeriodo, showsPeriodo]);

  const maxFat = Math.max(1, ...rankingContratantes.map((r) => r.faturamento));

  // ---- Itens dos modais-resumo (até 5 no ResumoLista) ----

  // Top contratantes = ranking do período (com faturamento como valor).
  const itensContratantes: ResumoListaItem[] = useMemo(
    () =>
      rankingContratantes.slice(0, 5).map((r) => ({
        id: r.contratante.id,
        titulo: r.contratante.nome,
        // I13 — não um "N shows" genérico: realizados, agendados e cancelados
        // com as quantidades (cancelados só aparece quando existe).
        subtitulo: [
          `${r.realizados} ${t("realizados")}`,
          `${r.agendados} ${t("agendados")}`,
          ...(r.cancelados > 0 ? [`${r.cancelados} ${t("cancelados")}`] : []),
        ].join(" · "),
        // casas = 2 pra bater exatamente com o antigo formatBRL (whatsapp) daqui.
        valor: r.faturamento > 0 ? formatarFaturamento(r.faturamentoPorMoeda, 2) : "—",
      })),
    [rankingContratantes, t]
  );

  // Top casas por nº de shows (all-time) — visão geral do catálogo.
  const itensCasas: ResumoListaItem[] = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const s of shows) if (s.casaId) contagem.set(s.casaId, (contagem.get(s.casaId) ?? 0) + 1);
    return casas
      .map((c) => ({ casa: c, n: contagem.get(c.id) ?? 0 }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 5)
      .map(({ casa, n }) => ({
        id: casa.id,
        titulo: casa.nome,
        subtitulo: `${n} ${n === 1 ? t("show") : t("shows")}`,
      }));
  }, [casas, shows, t]);

  // Top cidades por nº de shows (all-time).
  const itensCidades: ResumoListaItem[] = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const s of shows) if (s.cidadeId) contagem.set(s.cidadeId, (contagem.get(s.cidadeId) ?? 0) + 1);
    return cidades
      .map((c) => ({ cidade: c, n: contagem.get(c.id) ?? 0 }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 5)
      .map(({ cidade, n }) => ({
        id: cidade.id,
        titulo: cidade.nome,
        subtitulo: `${cidade.estado || cidade.pais || ""} · ${n} ${n === 1 ? t("show") : t("shows")}`,
      }));
  }, [cidades, shows, t]);

  // Bloqueados: contratantes + casas, com o motivo como subtítulo.
  const itensBloqueados: ResumoListaItem[] = useMemo(() => {
    const cts: ResumoListaItem[] = contratantesBloqueados.map((c) => ({
      id: `ct-${c.id}`,
      titulo: c.nome,
      subtitulo: c.bloqueadoMotivo || t("Contratante bloqueado"),
    }));
    const cs: ResumoListaItem[] = casasBloqueadas.map((c) => ({
      id: `ca-${c.id}`,
      titulo: c.nome,
      subtitulo: c.bloqueadoMotivo || t("Casa bloqueada"),
    }));
    return [...cts, ...cs].slice(0, 5);
  }, [contratantesBloqueados, casasBloqueadas, t]);

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Contatos"
        subtitle="Contratantes, casas e cidades da agência"
        accentColor={ACCENT}
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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
              className="btn btn-primary w-full sm:w-auto justify-center"
            >
              <UserPlus size={14} />
              {t("Gerenciar Contatos")}
            </button>
          </div>
        }
      />

      {/* Falha de API deixa de parecer lista vazia (auditoria 27/08/2026). */}
      <div className="mb-6 empty:hidden">
        <EstadoCarga
          carregando={carregandoContatos && contratantes.length === 0 && casas.length === 0}
          erro={erroContatos}
          aoTentar={recarregarContatos}
          rotulo={t("contatos")}
        />
      </div>

      {/* 4 cards — um de cada cor. Clicar abre o modal-resumo (mesma página);
          o rodapé do modal navega para a lista via onAbrirCategoria. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ClickableStat
          onClick={() => setResumo("contratantes")}
          ariaLabel={t("Resumo de contratantes")}
        >
          <StatCard
            title={t("Contratantes")}
            value={contratantes.length}
            icon={<Users size={16} />}
            accentColor="var(--info)"
            subtitle={t("Toque para ver o resumo")}
          />
        </ClickableStat>
        <ClickableStat
          onClick={() => setResumo("casas")}
          ariaLabel={t("Resumo de casas")}
        >
          <StatCard
            title={t("Casas de shows")}
            value={casas.length}
            icon={<Building2 size={16} />}
            accentColor="var(--success)"
            subtitle={t("Clubs, festivais, bares")}
          />
        </ClickableStat>
        <ClickableStat
          onClick={() => setResumo("cidades")}
          ariaLabel={t("Resumo de cidades")}
        >
          <StatCard
            title={t("Cidades")}
            value={cidades.length}
            icon={<MapPin size={16} />}
            accentColor="var(--warning)"
            subtitle={t("{n} com shows", { n: cidadesComShows })}
          />
        </ClickableStat>
        <ClickableStat
          onClick={() => setResumo("bloqueados")}
          ariaLabel={t("Resumo de bloqueados")}
        >
          <StatCard
            title={t("Bloqueados")}
            value={totalBloqueados}
            icon={<Ban size={16} />}
            accentColor="var(--danger)"
            subtitle={t("Contratantes e casas bloqueados")}
          />
        </ClickableStat>
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
                      {r.faturamento > 0 ? formatarFaturamento(r.faturamentoPorMoeda, 2) : "—"}
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

      {/* ---- Modais-resumo (mesma página) ---- */}
      <ResumoModal
        isOpen={resumo === "contratantes"}
        onClose={() => setResumo(null)}
        title={t("Contratantes")}
        subtitle={tituloPeriodo}
        accentColor="var(--info)"
      >
        <ResumoNumero
          valor={contratantes.length}
          label={t("Contratantes cadastrados")}
          accentColor="var(--info)"
        />
        {itensContratantes.length > 0 && (
          <ResumoLista
            itens={itensContratantes}
            onItemClick={() => onAbrirCategoria?.("contratantes")}
          />
        )}
        <ResumoFooter
          label={t("Ver mais detalhes")}
          onClick={() => onAbrirCategoria?.("contratantes")}
        />
      </ResumoModal>

      <ResumoModal
        isOpen={resumo === "casas"}
        onClose={() => setResumo(null)}
        title={t("Casas de shows")}
        accentColor="var(--success)"
      >
        <ResumoNumero
          valor={casas.length}
          label={t("Casas cadastradas")}
          accentColor="var(--success)"
        />
        {itensCasas.length > 0 && (
          <ResumoLista itens={itensCasas} onItemClick={() => onAbrirCategoria?.("casas")} />
        )}
        <ResumoFooter
          label={t("Ver mais detalhes")}
          onClick={() => onAbrirCategoria?.("casas")}
        />
      </ResumoModal>

      <ResumoModal
        isOpen={resumo === "cidades"}
        onClose={() => setResumo(null)}
        title={t("Cidades")}
        accentColor="var(--warning)"
      >
        <ResumoNumero
          valor={cidades.length}
          label={t("Cidades cadastradas")}
          accentColor="var(--warning)"
        />
        {itensCidades.length > 0 && (
          <ResumoLista itens={itensCidades} onItemClick={() => onAbrirCategoria?.("cidades")} />
        )}
        <ResumoFooter
          label={t("Ver mais detalhes")}
          onClick={() => onAbrirCategoria?.("cidades")}
        />
      </ResumoModal>

      <ResumoModal
        isOpen={resumo === "bloqueados"}
        onClose={() => setResumo(null)}
        title={t("Bloqueados")}
        subtitle={t("Contratantes e casas bloqueados")}
        accentColor="var(--danger)"
      >
        <ResumoNumero
          valor={totalBloqueados}
          label={t("Contatos bloqueados")}
          accentColor="var(--danger)"
        />
        {totalBloqueados === 0 ? (
          <div className="text-sm text-muted text-center py-4">
            {t("Nenhum contato bloqueado.")}
          </div>
        ) : (
          <ResumoLista
            itens={itensBloqueados}
            onItemClick={(id) =>
              onAbrirCategoria?.(id.startsWith("ca-") ? "casas" : "contratantes")
            }
          />
        )}
        <ResumoFooter
          label={t("Ver mais detalhes")}
          onClick={() => onAbrirCategoria?.("contratantes")}
        />
      </ResumoModal>
    </div>
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
