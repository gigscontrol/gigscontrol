"use client";

import { useMemo, useState } from "react";
import { resolverMes, dataNoMes } from "@/lib/periodo";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  Clock,
  ChevronRight,
} from "lucide-react";
import PageHeader from "../PageHeader";
import StatCard from "../StatCard";
import DateRangeSelector from "../DateRangeSelector";
import {
  ClickableStat,
  ResumoModal,
  ResumoNumero,
  ResumoLinha,
  ResumoFooter,
} from "../DashboardResumo";
import { useContratos } from "@/lib/contratos-context";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas, useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import type { Contrato, ContratoStatus } from "@/lib/mappers/contrato";
import { descreverContrato, formatarDataCurta } from "@/lib/contratoTitulo";
import { useT } from "@/lib/i18n";
import { MODULE_THEMES } from "@/types";
import type { ActiveTab, ActivePage, AgendaDateRange } from "@/types";
import { STATUS_CONTRATO } from "@/lib/statusUI";
import { useFiltroArtistas } from "../FiltroArtistas";

const ACCENT = MODULE_THEMES.contratos.color;

/** Rótulo + classe de badge + cor por status. */
const STATUS_INFO = STATUS_CONTRATO;

const STATUS_ORDEM: ContratoStatus[] = ["rascunho", "enviado", "assinado", "cancelado"];

const MESES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ATALHOS_CTR: AgendaDateRange[] = ["Visão geral", "Mês anterior", "Mês atual", "Próximo mês", "Personalizado"];


/** Qual card está aberto no modal de resumo (null = fechado).
 *  "total" = Contratos criados (inclui Taxa de assinatura + Rascunhos + Vendas sem contrato).
 *  "aguardando" = subconjunto de enviados sem nenhuma assinatura coletada (cálculo preservado). */
type Resumo = null | "total" | "aguardando" | ContratoStatus;

type Props = {
  onNavigate?: (tab: ActiveTab, page: ActivePage) => void;
  /** Abre o histórico filtrado por um status (null = todos). */
  onVerStatus?: (status: ContratoStatus | null) => void;
  /** Abre um contrato específico no histórico. */
  onAbrirContrato?: (id: string) => void;
};

export default function DashboardContratos({
  onNavigate,
  onVerStatus,
  onAbrirContrato,
}: Props) {
  const t = useT();
  const { contratos: contratosTodos, assinantesPorContrato, carregando, erro } = useContratos();
  const { vendas: vendasTodas } = useVendas();
  // Filtro "Artistas" da barra lateral: contrato herda o artista da venda;
  // contrato avulso (sem venda) aparece sempre (lib/filtroArtistas).
  const filtro = useFiltroArtistas();
  const contratos = useMemo(() => {
    if (!filtro.ativo) return contratosTodos;
    const artistaDaVenda = new Map(vendasTodas.map((v) => [v.id, v.artistaId]));
    return contratosTodos.filter((c) =>
      filtro.passa(c.vendaId ? artistaDaVenda.get(c.vendaId) : null)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratosTodos, vendasTodas, filtro.ativo, filtro.selecionados]);
  const vendas = useMemo(
    () => (filtro.ativo ? vendasTodas.filter((v) => filtro.passa(v.artistaId)) : vendasTodas),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendasTodas, filtro.ativo, filtro.selecionados]
  );
  const artistas = useArtistas();
  const { workspaceCriadoEm } = useWorkspace();
  const { podeUI } = useAuth();
  const [resumo, setResumo] = useState<Resumo>(null);

  // Seletor de período (padrão: Mês atual). Filtra por data de criação.
  const [range, setRange] = useState<AgendaDateRange>("Mês atual");
  const [customMonth, setCustomMonth] = useState<string | null>(null);
  const [customYear, setCustomYear] = useState<number | null>(null);
  const periodo = useMemo(
    () => resolverMes(range, customMonth, customYear),
    [range, customMonth, customYear]
  );
  const tituloPeriodo = periodo.tudo ? t("Visão geral") : `${MESES_LONGO[periodo.mes]} ${periodo.ano}`;
  const contratosPeriodo = useMemo(
    () => contratos.filter((c) => dataNoMes(c.criadoEm, periodo)),
    [contratos, periodo]
  );

  // "Novo Contrato" não fixa artista (é escolhido no wizard) → habilita se
  // o usuário PODE criar contrato em algum artista.
  const podeCriar = artistas.some((a) => podeUI(a.id, "contratos.criar"));

  // Total + contagem por status + a lista (ordenada) por status.
  const { total, porStatus, listaPorStatus } = useMemo(() => {
    const contagem: Record<ContratoStatus, number> = {
      rascunho: 0,
      enviado: 0,
      assinado: 0,
      cancelado: 0,
    };
    const lista: Record<ContratoStatus, Contrato[]> = {
      rascunho: [],
      enviado: [],
      assinado: [],
      cancelado: [],
    };
    const ordenados = [...contratosPeriodo].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    for (const c of ordenados) {
      contagem[c.status] += 1;
      lista[c.status].push(c);
    }
    return { total: contratosPeriodo.length, porStatus: contagem, listaPorStatus: lista };
  }, [contratosPeriodo]);

  // Taxa de assinatura = assinados / (enviados + assinados).
  const taxa = useMemo(() => {
    const denom = porStatus.enviado + porStatus.assinado;
    return denom > 0 ? Math.round((porStatus.assinado / denom) * 100) : 0;
  }, [porStatus]);

  // Aguardando = enviados que ainda NÃO têm nenhuma assinatura coletada.
  const contratosAguardandoLista = useMemo(
    () =>
      contratosPeriodo.filter(
        (c) =>
          c.status === "enviado" &&
          !(assinantesPorContrato[c.id] ?? []).some((a) => a.status === "assinado")
      ),
    [contratosPeriodo, assinantesPorContrato]
  );
  const aguardando = contratosAguardandoLista.length;

  // Vendas do período SEM contrato ativo — precisam gerar um.
  const vendasSemContrato = useMemo(() => {
    const comContrato = new Set(
      contratos.filter((c) => c.status !== "cancelado" && c.vendaId).map((c) => c.vendaId)
    );
    return vendas.filter((v) => dataNoMes(v.criadoEm, periodo) && !comContrato.has(v.id)).length;
  }, [vendas, contratos, periodo]);

  // Últimos 5 do período por criadoEm desc.
  const recentes = useMemo<Contrato[]>(
    () =>
      [...contratosPeriodo]
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
        .slice(0, 5),
    [contratosPeriodo]
  );

  return (
    <div className="pagina">
      <PageHeader
        title="Contratos"
        subtitle={tituloPeriodo}
        accentColor={ACCENT}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeSelector
              options={ATALHOS_CTR}
              value={range}
              onChange={setRange}
              selectedCustomMonth={customMonth}
              setSelectedCustomMonth={setCustomMonth}
              selectedCustomYear={customYear}
              setSelectedCustomYear={setCustomYear}
              accountCreatedAt={workspaceCriadoEm}
            />
            <button
              onClick={() => onNavigate?.("contratos", "contratos-novo")}
              disabled={!podeCriar}
              title={!podeCriar ? t("Você não tem permissão para isso.") : undefined}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--brand-solid)", color: "#fff" }}
            >
              <Plus size={14} />
              {t("Novo contrato")}
            </button>
          </div>
        }
      />

      {carregando ? (
        <div className="card flex items-center justify-center gap-2 py-12 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" />
          {t("Carregando contratos...")}
        </div>
      ) : erro ? (
        <div className="card flex items-center justify-center py-12 text-center text-sm text-danger">
          {erro}
        </div>
      ) : contratos.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center mb-3">
            <FileText size={18} className="text-muted" />
          </div>
          <h2 className="section-title mb-1">{t("Nenhum contrato ainda")}</h2>
          <div className="section-subtitle mb-4">
            {t("Gere o primeiro em Novo Contrato.")}
          </div>
          <button
            onClick={() => onNavigate?.("contratos", "contratos-novo")}
            disabled={!podeCriar}
            title={!podeCriar ? t("Você não tem permissão para isso.") : undefined}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--brand-solid)", color: "#fff" }}
          >
            <Plus size={14} />
            {t("Novo contrato")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* 4 cards — um de cada cor (azul, verde, âmbar, vermelho). */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <ClickableStat onClick={() => setResumo("aguardando")} ariaLabel={t("Ver resumo de aguardando assinatura")}>
              <StatCard title={t("Aguardando assinatura")} value={aguardando} icon={<Clock size={16} />} accentColor="var(--warning)" subtitle={t("Sem nenhuma assinatura")} destaque={aguardando > 0} />
            </ClickableStat>
            <ClickableStat onClick={() => setResumo("total")} ariaLabel={t("Ver resumo de contratos criados")}>
              <StatCard title={t("Contratos criados")} value={total} icon={<FileText size={16} />} accentColor={ACCENT} subtitle={tituloPeriodo} />
            </ClickableStat>
            <ClickableStat onClick={() => setResumo("assinado")} ariaLabel={t("Ver resumo de assinados")}>
              <StatCard title={t("Contratos assinados")} value={porStatus.assinado} icon={<CheckCircle2 size={16} />} accentColor="var(--success)" subtitle={t("Finalizados")} />
            </ClickableStat>
            <ClickableStat onClick={() => setResumo("cancelado")} ariaLabel={t("Ver resumo de cancelados")}>
              <StatCard title={t("Contratos cancelados")} value={porStatus.cancelado} icon={<XCircle size={16} />} accentColor="var(--danger)" subtitle={t("Ver resumo")} />
            </ClickableStat>
          </div>

          {/* Contratos recentes */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">{t("Contratos recentes")}</h2>
              <button
                onClick={() => onNavigate?.("contratos", "contratos-historico")}
                className="btn-ghost text-xs inline-flex items-center gap-1"
              >
                {t("Ver todos")}
                <ChevronRight size={12} />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {recentes.map((c) => (
                <LinhaContrato
                  key={c.id}
                  contrato={c}
                  desc={descreverContrato(c, vendas, artistas)}
                  onClick={() => onAbrirContrato?.(c.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de resumo — aberto pelos cards (visualizador na mesma página) */}
      <ResumoModal
        isOpen={resumo !== null}
        onClose={() => setResumo(null)}
        title={
          resumo === "total"
            ? t("Contratos criados")
            : resumo === "aguardando"
              ? t("Aguardando assinatura")
              : resumo === "assinado"
                ? t("Contratos assinados")
                : resumo === "cancelado"
                  ? t("Contratos cancelados")
                  : resumo
                    ? t(STATUS_INFO[resumo].label)
                    : ""
        }
        subtitle={resumo === "total" ? tituloPeriodo : undefined}
        accentColor={
          resumo === "total"
            ? ACCENT
            : resumo === "aguardando"
              ? "var(--warning)"
              : resumo
                ? STATUS_INFO[resumo].cor === "var(--text-muted)"
                  ? undefined
                  : STATUS_INFO[resumo].cor
                : undefined
        }
      >
        {resumo === "total" ? (
          <>
            <ResumoNumero label={t("Contratos criados")} valor={total} accentColor={ACCENT} />
            <div className="flex flex-col gap-2">
              <div className="stat-label">{t("Por status")}</div>
              {STATUS_ORDEM.map((s) => (
                <ResumoLinha
                  key={s}
                  onClick={() => setResumo(s === "enviado" ? "aguardando" : s)}
                  label={<span className={`badge ${STATUS_INFO[s].badge}`}>{t(STATUS_INFO[s].label)}</span>}
                  valor={porStatus[s]}
                />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <div className="stat-label">{t("Métricas")}</div>
              <ResumoLinha label={t("Taxa de assinatura")} valor={`${taxa}%`} destaque />
              <ResumoLinha
                label={t("Rascunhos")}
                valor={porStatus.rascunho}
                onClick={() => setResumo("rascunho")}
              />
              <ResumoLinha label={t("Vendas sem contrato")} valor={vendasSemContrato} destaque />
            </div>
            <ResumoFooter
              label={t("Ver todos no histórico")}
              onClick={() => {
                setResumo(null);
                onVerStatus?.(null);
              }}
            />
          </>
        ) : resumo === "aguardando" ? (
          <>
            <ResumoNumero label={t("Aguardando assinatura")} valor={aguardando} accentColor="var(--warning)" />
            {aguardando === 0 ? (
              <div className="text-sm text-muted text-center py-6">
                {t("Nenhum contrato aguardando assinatura.")}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {contratosAguardandoLista.slice(0, 5).map((c) => (
                  <LinhaContrato
                    key={c.id}
                    contrato={c}
                    desc={descreverContrato(c, vendas, artistas)}
                    semBadge
                    onClick={() => {
                      setResumo(null);
                      onAbrirContrato?.(c.id);
                    }}
                  />
                ))}
              </div>
            )}
            <ResumoFooter
              label={t("Ver no histórico")}
              onClick={() => {
                setResumo(null);
                onVerStatus?.("enviado");
              }}
            />
          </>
        ) : resumo ? (
          <>
            <ResumoNumero
              label={
                resumo === "assinado"
                  ? t("Contratos assinados")
                  : resumo === "cancelado"
                    ? t("Contratos cancelados")
                    : t(STATUS_INFO[resumo].label)
              }
              valor={porStatus[resumo]}
              accentColor={STATUS_INFO[resumo].cor === "var(--text-muted)" ? undefined : STATUS_INFO[resumo].cor}
            />
            {resumo === "assinado" && (
              <ResumoLinha label={t("Vendas sem contrato")} valor={vendasSemContrato} destaque />
            )}
            {porStatus[resumo] === 0 ? (
              <div className="text-sm text-muted text-center py-6">
                {t("Nenhum contrato com esse status.")}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {listaPorStatus[resumo].slice(0, 5).map((c) => (
                  <LinhaContrato
                    key={c.id}
                    contrato={c}
                    desc={descreverContrato(c, vendas, artistas)}
                    semBadge
                    onClick={() => {
                      setResumo(null);
                      onAbrirContrato?.(c.id);
                    }}
                  />
                ))}
              </div>
            )}
            <ResumoFooter
              label={t("Ver no histórico")}
              onClick={() => {
                const s = resumo;
                setResumo(null);
                onVerStatus?.(s);
              }}
            />
          </>
        ) : null}
      </ResumoModal>
    </div>
  );
}

/** Linha de um contrato (numero + emissão + badge), clicável. */
function LinhaContrato({
  contrato,
  desc,
  onClick,
  semBadge,
}: {
  contrato: Contrato;
  desc: ReturnType<typeof descreverContrato>;
  onClick: () => void;
  semBadge?: boolean;
}) {
  const t = useT();
  const info = STATUS_INFO[contrato.status];
  const partes: string[] = [];
  if (desc.artista) partes.push(desc.artista);
  if (desc.temEvento) partes.push(desc.numero);
  partes.push(formatarDataCurta(desc.data));
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-2.5 rounded-md border border-border bg-elevated hover:border-border-strong transition-colors text-left w-full"
    >
      <div
        className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: `color-mix(in srgb, ${ACCENT} 13%, transparent)`,
          color: ACCENT,
        }}
      >
        <FileText size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-primary truncate" title={desc.titulo}>
          {desc.titulo}
        </div>
        <div className="text-xs text-muted truncate">{partes.join(" · ")}</div>
      </div>
      {!semBadge && (
        <span className={`badge ${info.badge} flex-shrink-0`}>{t(info.label)}</span>
      )}
      <ChevronRight size={14} className="text-muted flex-shrink-0" />
    </button>
  );
}

