"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  History,
  Music,
  Users,
  ShoppingBag,
  FileText,
  Wallet,
  CalendarClock,
  UserCircle,
  Palette,
  Trash2,
  PauseCircle,
  Ban,
  AlertTriangle,
  Clock,
  Hourglass,
  FileWarning,
  Building2,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { useVendas } from "@/lib/vendas-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useContatos } from "@/lib/contatos-context";
import { useContratos } from "@/lib/contratos-context";
import { useNavegacao } from "@/components/NavOverlay";
import { formatBRL } from "@/lib/whatsapp";
import {
  resolverPeriodo,
  contarStatCards,
  calcularAlertas,
  rankingFaturamentoPorArtista,
  rankingContratantes,
  rankingCasas,
  rankingCidades,
  rankingVendasPorUsuario,
  rankingOrcamentosPorUsuario,
  MESES_LONGO,
} from "@/lib/agencia-dashboard";
import type { AgendaDateRange } from "@/types";
import type { HistoricoAcao, ModuloHistorico } from "@/lib/mappers/historico";
import PageHeader from "../PageHeader";
import StatCard from "../StatCard";
import DateRangeSelector from "../DateRangeSelector";
import RankingCard, { type MetricaConfig } from "./RankingCard";

/**
 * Dashboard do módulo Agência — visão executiva completa.
 *
 *  - 4 StatCards (artistas/equipe/suspensos/bloqueados): visíveis a qualquer
 *    papel que abra o módulo.
 *  - Faixa de alertas (estado atual) + 6 rankings (por período) + feed
 *    "Últimas ações": só admin (expõem financeiro e performance da equipe).
 *
 * Tudo client-side, a partir dos contexts já montados no layout do módulo.
 */

const BASE = "/app";
const ATALHOS: AgendaDateRange[] = [
  "Visão geral",
  "Mês anterior",
  "Mês atual",
  "Próximo mês",
  "Personalizado",
];

/** Ícone + cor por módulo, pro card "Últimas ações". */
const MODULO_HISTORICO: Record<
  ModuloHistorico,
  { icon: typeof History; cor: string }
> = {
  venda: { icon: ShoppingBag, cor: "var(--brand)" },
  orcamento: { icon: FileText, cor: "var(--brand)" },
  parcela: { icon: Wallet, cor: "var(--success)" },
  show: { icon: CalendarClock, cor: "var(--brand)" },
  artista: { icon: Music, cor: "var(--brand)" },
  equipe: { icon: Users, cor: "var(--warning)" },
  contato: { icon: UserCircle, cor: "var(--brand)" },
  aparencia: { icon: Palette, cor: "var(--brand)" },
  lixeira: { icon: Trash2, cor: "var(--text-muted)" },
};

export default function AgenciaDashboard() {
  const t = useT();
  const { artistas, equipe, workspaceCriadoEm } = useWorkspace();
  const { sessao } = useAuth();
  const { vendas } = useVendas();
  const { orcamentos } = useOrcamentos();
  const { contratantes, casas, cidades } = useContatos();
  const { contratos } = useContratos();
  const { navegar } = useNavegacao();
  const accent = "var(--brand)";

  // /api/historico é admin-only (403 pra outros papéis) — alertas, rankings e
  // "Últimas ações" também são admin-only (expõem financeiro/performance).
  const isAdmin = sessao?.usuario.papel === "admin";

  // ---- Seletor de período (padrão: Mês atual). Só admin usa (rankings). ----
  const [range, setRange] = useState<AgendaDateRange>("Mês atual");
  const [customMonth, setCustomMonth] = useState<string | null>(null);
  const [customYear, setCustomYear] = useState<number | null>(null);
  const periodo = useMemo(
    () => resolverPeriodo(range, customMonth, customYear),
    [range, customMonth, customYear]
  );
  const tituloPeriodo = periodo.tudo
    ? t("Visão geral")
    : `${MESES_LONGO[periodo.mes]} ${periodo.ano}`;

  // ---- StatCards (todos os papéis) ----
  const contagem = useMemo(
    () => contarStatCards(artistas, equipe),
    [artistas, equipe]
  );

  // ---- Alertas (estado atual, ignora o período) ----
  const alertas = useMemo(
    () => calcularAlertas(vendas, orcamentos, contratos),
    [vendas, orcamentos, contratos]
  );

  // ---- Rankings (filtrados pelo período) ----
  const r1 = useMemo(
    () => rankingFaturamentoPorArtista(vendas, artistas, periodo),
    [vendas, artistas, periodo]
  );
  const r2 = useMemo(
    () => rankingContratantes(vendas, contratantes, periodo),
    [vendas, contratantes, periodo]
  );
  const r3 = useMemo(
    () => rankingCasas(vendas, casas, periodo),
    [vendas, casas, periodo]
  );
  const r4 = useMemo(
    () => rankingCidades(vendas, cidades, periodo),
    [vendas, cidades, periodo]
  );
  const r5 = useMemo(
    () => rankingVendasPorUsuario(vendas, equipe, periodo),
    [vendas, equipe, periodo]
  );
  const r6 = useMemo(
    () => rankingOrcamentosPorUsuario(orcamentos, equipe, periodo),
    [orcamentos, equipe, periodo]
  );

  // ---- "Últimas ações" (admin-only) ----
  const [acoes, setAcoes] = useState<HistoricoAcao[]>([]);
  const [carregandoAcoes, setCarregandoAcoes] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      setCarregandoAcoes(false);
      return;
    }
    let ativo = true;
    (async () => {
      try {
        const res = await fetch("/api/historico?limit=10", {
          credentials: "include",
        });
        if (!res.ok) {
          if (ativo) setAcoes([]);
          return;
        }
        const data = (await res.json()) as { historico?: HistoricoAcao[] };
        if (ativo) setAcoes(Array.isArray(data.historico) ? data.historico : []);
      } catch {
        if (ativo) setAcoes([]);
      } finally {
        if (ativo) setCarregandoAcoes(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [isAdmin]);

  // Formatação das métricas dos rankings.
  const brl = (n: number) => formatBRL(n);
  const num = (n: number) => String(n);
  const m = (
    label: string,
    campo: "a" | "b",
    formato: (n: number) => string
  ): MetricaConfig => ({ label, campo, formato });

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Agência"
        subtitle="Visão geral dos seus artistas, equipe e atividade recente."
        accentColor={accent}
        actions={
          isAdmin ? (
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
          ) : undefined
        }
      />

      {/* 4 StatCards — um de cada cor. Visíveis a qualquer papel. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t("Artistas")}
          value={contagem.artistas}
          icon={<Music size={15} />}
          accentColor="var(--success)"
          subtitle={t("Total de artistas")}
        />
        <StatCard
          title={t("Equipe")}
          value={contagem.equipe}
          icon={<Users size={15} />}
          accentColor="var(--brand)"
          subtitle={t("Total da equipe")}
        />
        <StatCard
          title={t("Suspensos")}
          value={contagem.suspensos}
          icon={<PauseCircle size={15} />}
          accentColor="var(--warning)"
          subtitle={t("Artistas com acesso suspenso")}
        />
        <StatCard
          title={t("Bloqueados")}
          value={contagem.bloqueados}
          icon={<Ban size={15} />}
          accentColor="var(--danger)"
          subtitle={t("Membros da equipe bloqueados")}
        />
      </div>

      {isAdmin && (
        <>
          {/* ── Faixa de alertas (estado atual) ── */}
          <div className="section-title mt-8 mb-4">{t("Alertas")}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AlertaCard
              icon={<AlertTriangle size={15} />}
              label={t("Parcelas atrasadas")}
              valor={formatBRL(alertas.parcelasAtrasadasValor)}
              sub={`${alertas.parcelasAtrasadasContagem} ${
                alertas.parcelasAtrasadasContagem === 1 ? t("parcela") : t("parcelas")
              }`}
              tone="danger"
              ativo={alertas.parcelasAtrasadasContagem > 0}
              onClick={() => navegar(`${BASE}/financeiro/pagamentos`)}
            />
            <AlertaCard
              icon={<Clock size={15} />}
              label={t("Aguardando assinatura")}
              valor={alertas.contratosAguardando}
              sub={t("Contratos enviados")}
              tone="warning"
              ativo={alertas.contratosAguardando > 0}
              onClick={() => navegar(`${BASE}/contratos/historico`)}
            />
            <AlertaCard
              icon={<Hourglass size={15} />}
              label={t("Orçamentos parados")}
              valor={alertas.orcamentosParados}
              sub={t("Há 7 dias ou mais")}
              tone="warning"
              ativo={alertas.orcamentosParados > 0}
              onClick={() => navegar(`${BASE}/vendas/orcamentos`)}
            />
            <AlertaCard
              icon={<FileWarning size={15} />}
              label={t("Shows sem contrato")}
              valor={alertas.showsSemContrato}
              sub={t("Precisam de contrato")}
              tone="danger"
              ativo={alertas.showsSemContrato > 0}
              onClick={() => navegar(`${BASE}/contratos`)}
            />
          </div>

          {/* ── Rankings (filtrados pelo período) ── */}
          <div className="flex items-center gap-2 mt-8 mb-4">
            <div className="section-title">{t("Rankings")}</div>
            <span className="badge badge-neutral">{tituloPeriodo}</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <RankingCard
              icon={<TrendingUp size={16} />}
              titulo={t("Faturamento por artista")}
              linhas={r1}
              metricas={[
                m(t("Bruto"), "a", brl),
                m(t("Taxa de agência"), "b", brl),
              ]}
              vazioLabel={t("Sem dados no período.")}
            />
            <RankingCard
              icon={<Users size={16} />}
              titulo={t("Contratantes")}
              linhas={r2}
              metricas={[m(t("Valor"), "a", brl), m(t("Shows"), "b", num)]}
              vazioLabel={t("Sem dados no período.")}
            />
            <RankingCard
              icon={<Building2 size={16} />}
              titulo={t("Casas")}
              linhas={r3}
              metricas={[m(t("Shows"), "a", num), m(t("Valor"), "b", brl)]}
              vazioLabel={t("Sem dados no período.")}
            />
            <RankingCard
              icon={<MapPin size={16} />}
              titulo={t("Cidades")}
              linhas={r4}
              metricas={[m(t("Valor"), "a", brl), m(t("Shows"), "b", num)]}
              vazioLabel={t("Sem dados no período.")}
            />
            <RankingCard
              icon={<ShoppingBag size={16} />}
              titulo={t("Vendas por usuário")}
              linhas={r5}
              metricas={[
                m(t("Valor"), "a", brl),
                m(t("Nº de vendas"), "b", num),
              ]}
              vazioLabel={t("Sem dados no período.")}
            />
            <RankingCard
              icon={<FileText size={16} />}
              titulo={t("Orçamentos por usuário")}
              linhas={r6}
              metricas={[m(t("Valor"), "a", brl), m(t("Nº"), "b", num)]}
              vazioLabel={t("Sem dados no período.")}
            />
          </div>

          {/* ── Últimas ações ── */}
          <div className="card mt-8">
            <div className="flex items-center gap-2 mb-4">
              <History size={16} style={{ color: accent }} />
              <div className="section-title">{t("Últimas ações")}</div>
            </div>

            {carregandoAcoes ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <span className="h-8 w-8 rounded-md bg-elevated animate-pulse flex-shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <span className="h-3 w-2/3 rounded bg-elevated animate-pulse" />
                      <span className="h-2.5 w-1/3 rounded bg-elevated animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : acoes.length === 0 ? (
              <div className="text-sm text-muted text-center py-8">
                {t("Nenhuma ação recente ainda.")}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {acoes.map((acao) => {
                  const info = MODULO_HISTORICO[acao.modulo] ?? {
                    icon: History,
                    cor: "var(--text-muted)",
                  };
                  const Icon = info.icon;
                  return (
                    <div
                      key={acao.id}
                      className="flex items-start gap-3 p-2 rounded-md"
                    >
                      <span
                        className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${info.cor} 11%, transparent)`,
                          color: info.cor,
                        }}
                      >
                        <Icon size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-primary">{acao.descricao}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted">
                          <span className="truncate">
                            {acao.actorNome ?? acao.actorEmail ?? t("Sistema")}
                          </span>
                          <span>·</span>
                          <span className="flex-shrink-0">
                            {tempoRelativo(acao.criadoEm, t)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Card de alerta clicável — acento colorido quando ativo, apagado quando 0. */
function AlertaCard({
  icon,
  label,
  valor,
  sub,
  tone,
  ativo,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  valor: string | number;
  sub?: string;
  tone: "danger" | "warning";
  ativo: boolean;
  onClick: () => void;
}) {
  const cor = ativo
    ? tone === "danger"
      ? "var(--danger)"
      : "var(--warning)"
    : "var(--text-muted)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-interactive flex flex-col gap-3 text-left min-h-[120px]"
      style={ativo ? { borderColor: cor } : undefined}
    >
      <div className="flex items-start justify-between">
        <span className="stat-label">{label}</span>
        <span
          className="h-[30px] w-[30px] rounded-chip flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: `color-mix(in srgb, ${cor} 14%, transparent)`,
            color: cor,
          }}
        >
          {icon}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="stat-value" style={{ color: cor }}>
          {valor}
        </div>
        {sub && <div className="text-xs text-muted">{sub}</div>}
      </div>
    </button>
  );
}

/** Tempo relativo curto: "agora há pouco", "há 5 min", "há 2h", "há 3 dias" ou data. */
function tempoRelativo(
  iso: string,
  t: (s: string, p?: Record<string, string | number>) => string
): string {
  const data = new Date(iso);
  const diffMs = Date.now() - data.getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return t("agora há pouco");
  if (minutos < 60) return t("há {n} min", { n: minutos });
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return t("há {n}h", { n: horas });
  const dias = Math.floor(horas / 24);
  if (dias < 7) return t("há {n} dia{s}", { n: dias, s: dias === 1 ? "" : "s" });
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
