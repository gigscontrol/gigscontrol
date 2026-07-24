"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  FileText,
  CalendarCheck2,
  Handshake,
  XCircle,
  TrendingUp,
  ChevronRight,
  Plus,
} from "lucide-react";
import PageHeader from "./PageHeader";
import StatCard from "./StatCard";
import DateRangeSelector from "./DateRangeSelector";
import {
  ClickableStat,
  ResumoModal,
  ResumoNumero,
  ResumoLinha,
  ResumoLista,
  ResumoFooter,
} from "./DashboardResumo";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas, useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { formatarMoeda, totaisPorMoeda } from "@/lib/formatters";
import { MODULE_THEMES, LABELS_STATUS_ORCAMENTO, statusEfetivoParcela } from "@/types";
import type { ActiveTab, ActivePage, OrcamentoStatus, AgendaDateRange, Moeda } from "@/types";

type Props = {
  selectedArtistas: string[];
  onNavigate?: (tab: ActiveTab, page: ActivePage) => void;
  onAbrirOrcamento?: (id: string) => void;
  onAbrirVenda?: (id: string) => void;
};

/** Qual resumo está aberto no modal (null = fechado). */
type ResumoTipo = null | "orcamentos" | "vendas" | "negociacao" | "perdidos";

const ATALHOS_MES: AgendaDateRange[] = ["Visão geral", "Mês anterior", "Mês atual", "Próximo mês", "Personalizado"];
const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/**
 * Resolve {ano, mes(0-based), tudo} a partir do seletor — mesma lógica da Agenda.
 * "Visão geral" = all-time (tudo=true), sem filtro de mês.
 */
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

/**
 * A data cai no mês/ano selecionado? Aceita date-only ("YYYY-MM-DD",
 * ancorada ao meio-dia pra evitar fuso) ou timestamp completo (criadoEm).
 */
function mesAnoBate(dataISO: string | undefined, ano: number, mes: number): boolean {
  if (!dataISO) return false;
  const d = dataISO.length <= 10 ? new Date(`${dataISO}T12:00:00`) : new Date(dataISO);
  return d.getFullYear() === ano && d.getMonth() === mes;
}

export default function VendasDashboard({
  selectedArtistas,
  onNavigate,
  onAbrirOrcamento,
  onAbrirVenda,
}: Props) {
  const t = useT();
  const accent = MODULE_THEMES.vendas.color;
  const { orcamentos } = useOrcamentos();
  const { vendas } = useVendas();
  const artistas = useArtistas();
  const { workspaceCriadoEm } = useWorkspace();
  const { podeUI } = useAuth();
  const podeCriarOrcamento = artistas.some((a) => podeUI(a.id, "vendas.criar"));
  const [resumo, setResumo] = useState<ResumoTipo>(null);

  // ---- Seletor de mês (igual à Agenda) ----
  const [range, setRange] = useState<AgendaDateRange>("Mês atual");
  const [customMonth, setCustomMonth] = useState<string | null>(null);
  const [customYear, setCustomYear] = useState<number | null>(null);
  const { ano, mes, tudo } = useMemo(
    () => resolverMes(range, customMonth, customYear),
    [range, customMonth, customYear]
  );
  const tituloMes = tudo ? t("Visão geral") : `${MESES_LONGO[mes]} ${ano}`;

  // Tudo pela data de CRIAÇÃO: uma venda fechada em junho para um show em
  // outubro conta em junho (foi quando vendi). Orçamentos idem (criação).
  // A data do show só é usada depois pra separar "a realizar" x "realizadas".
  const orcamentosVisiveis = useMemo(
    () =>
      orcamentos.filter(
        (o) => selectedArtistas.includes(o.artistaId) && (tudo || mesAnoBate(o.criadoEm, ano, mes))
      ),
    [orcamentos, selectedArtistas, ano, mes, tudo]
  );
  const vendasVisiveis = useMemo(
    () =>
      vendas.filter(
        (v) =>
          // Vendas canceladas (D5) saem dos dashboards e do "a receber".
          v.status !== "cancelada" &&
          selectedArtistas.includes(v.artistaId) &&
          (tudo || mesAnoBate(v.criadoEm, ano, mes))
      ),
    [vendas, selectedArtistas, ano, mes, tudo]
  );

  const stats = useMemo(() => {
    // --- Orçamentos ---
    const totalOrcamentos = orcamentosVisiveis.length;
    const porStatus: Record<OrcamentoStatus, number> = {
      pendente: 0,
      negociacao: 0,
      aceito: 0,
      recusado: 0,
    };
    for (const o of orcamentosVisiveis) {
      porStatus[o.status] = (porStatus[o.status] ?? 0) + 1;
    }
    const pendentes = porStatus.pendente + porStatus.negociacao;

    // Totais de orçamento AGRUPADOS por moeda (nunca soma moedas diferentes num
    // número só — não há câmbio no sistema). Com uma moeda só, idêntico a hoje.
    const orcItem = (o: (typeof orcamentosVisiveis)[number]) => ({ valor: o.valorCache || 0, moeda: o.moeda });
    const valorTotalOrc = totaisPorMoeda(orcamentosVisiveis.map(orcItem));
    const valorEmAberto = totaisPorMoeda(
      orcamentosVisiveis.filter((o) => o.status === "pendente" || o.status === "negociacao").map(orcItem)
    );
    const valorNegociacao = totaisPorMoeda(
      orcamentosVisiveis.filter((o) => o.status === "negociacao").map(orcItem)
    );
    const valorPerdidos = totaisPorMoeda(
      orcamentosVisiveis.filter((o) => o.status === "recusado").map(orcItem)
    );

    // --- Vendas ---
    const totalVendas = vendasVisiveis.length;
    const faturamento = totaisPorMoeda(vendasVisiveis.map((v) => ({ valor: v.cache || 0, moeda: v.moeda })));
    // Taxa de conversão: vendas / (orçamentos + vendas) — contagem, independe de moeda.
    const conversao =
      totalOrcamentos + totalVendas > 0
        ? Math.round((totalVendas / (totalOrcamentos + totalVendas)) * 100)
        : 0;

    // Ticket médio (D-TICKET): média = soma/qtd só tem sentido dentro de UMA
    // moeda. Todas as vendas na mesma moeda → média nela; mais de uma → "—".
    const moedasVendas = new Set(vendasVisiveis.map((v) => v.moeda));
    const ticketMultiMoeda = moedasVendas.size > 1;
    const faturamentoNum = vendasVisiveis.reduce((acc, v) => acc + (v.cache || 0), 0);
    // "—" fica RESERVADO ao caso multi-moeda (D-TICKET). Com uma moeda só,
    // zero vendas volta a "R$ 0,00" — idêntico ao pré-branch (D-SEGURANCA).
    const ticketMedio = ticketMultiMoeda
      ? "—"
      : formatarMoeda(totalVendas > 0 ? faturamentoNum / totalVendas : 0, [...moedasVendas][0] ?? "BRL");

    // --- Pagamentos (parcelas): recebido x a receber x atrasado, por moeda ---
    // A parcela herda a moeda da venda dona. "A receber" deriva do faturamento
    // (cobre vendas sem parcelas lançadas), calculado por moeda.
    const fatMap = new Map<Moeda, number>();
    const recMap = new Map<Moeda, number>();
    const atrMap = new Map<Moeda, number>();
    for (const v of vendasVisiveis) {
      fatMap.set(v.moeda, (fatMap.get(v.moeda) ?? 0) + (v.cache || 0));
      for (const p of v.parcelas ?? []) {
        const st = statusEfetivoParcela(p);
        if (st === "pago") recMap.set(v.moeda, (recMap.get(v.moeda) ?? 0) + (p.valor || 0));
        else if (st === "atrasado") atrMap.set(v.moeda, (atrMap.get(v.moeda) ?? 0) + (p.valor || 0));
      }
    }
    const mapToItens = (m: Map<Moeda, number>) => [...m].map(([moeda, valor]) => ({ valor, moeda }));
    const recebido = totaisPorMoeda(mapToItens(recMap));
    const atrasado = totaisPorMoeda(mapToItens(atrMap));
    const aReceber = totaisPorMoeda(
      [...fatMap].map(([moeda, fat]) => ({ moeda, valor: Math.max(0, fat - (recMap.get(moeda) ?? 0)) }))
    );

    // --- Vendas próximas (a realizar) x já realizadas (por dataShow) ---
    const hojeISO = new Date().toISOString().slice(0, 10);
    let proximas = 0;
    let realizadas = 0;
    for (const v of vendasVisiveis) {
      if (v.dataShow && v.dataShow >= hojeISO) proximas += 1;
      else realizadas += 1;
    }

    return {
      totalOrcamentos,
      porStatus,
      valorTotalOrc,
      valorEmAberto,
      valorNegociacao,
      valorPerdidos,
      pendentes,
      totalVendas,
      faturamento,
      conversao,
      ticketMedio,
      ticketMultiMoeda,
      recebido,
      aReceber,
      atrasado,
      proximas,
      realizadas,
    };
  }, [orcamentosVisiveis, vendasVisiveis]);

  // Título/subtítulo do modal conforme o resumo aberto.
  const RESUMO_META: Record<NonNullable<ResumoTipo>, { titulo: string; subtitulo: string }> = {
    orcamentos: {
      titulo: t("Resumo de orçamentos"),
      subtitulo: t("Criados em {mes}", { mes: tituloMes }),
    },
    vendas: {
      titulo: t("Resumo de vendas"),
      subtitulo: t("Fechadas em {mes}", { mes: tituloMes }),
    },
    negociacao: {
      titulo: t("Em negociação"),
      subtitulo: tituloMes,
    },
    perdidos: {
      titulo: t("Orçamentos perdidos"),
      subtitulo: tituloMes,
    },
  };
  const meta = resumo ? RESUMO_META[resumo] : { titulo: "", subtitulo: "" };

  // Orçamentos em negociação (recentes)
  const negociacaoRecentes = useMemo(
    () =>
      [...orcamentosVisiveis]
        .filter((o) => o.status === "negociacao")
        .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
        .slice(0, 5),
    [orcamentosVisiveis]
  );

  // Orçamentos perdidos (recusados) recentes
  const perdidosRecentes = useMemo(
    () =>
      [...orcamentosVisiveis]
        .filter((o) => o.status === "recusado")
        .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
        .slice(0, 5),
    [orcamentosVisiveis]
  );

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
        subtitle={`${tituloMes} — ${t("por data de criação")}`}
        accentColor={accent}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeSelector
              options={ATALHOS_MES}
              value={range}
              onChange={setRange}
              selectedCustomMonth={customMonth}
              setSelectedCustomMonth={setCustomMonth}
              selectedCustomYear={customYear}
              setSelectedCustomYear={setCustomYear}
              accountCreatedAt={workspaceCriadoEm}
            />
            <button
              onClick={() => onNavigate?.("vendas", "vendas-novo-orcamento")}
              disabled={!podeCriarOrcamento}
              title={!podeCriarOrcamento ? "Você não tem permissão para isso." : undefined}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: accent, color: "#fff" }}
            >
              <Plus size={14} />
              {t("Novo Orçamento")}
            </button>
          </div>
        }
      />

      {/* Cards clicáveis — 4 cores fixas (azul/verde/âmbar/vermelho) */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {/* Os cards lideram com DINHEIRO, não com contagem. Antes "Vendas
            fechadas" mostrava a QUANTIDADE e o valor vendido só aparecia
            dentro do popup — daí a sensação de que o total vendido não
            existia em lugar nenhum. A contagem virou subtítulo. */}
        <ClickableStat onClick={() => setResumo("vendas")} ariaLabel={t("Resumo de vendas")}>
          <StatCard
            title={t("Vendido")}
            value={stats.faturamento}
            icon={<CalendarCheck2 size={16} />}
            accentColor="var(--success)"
            subtitle={t("{n} fechadas no período", { n: stats.totalVendas })}
          />
        </ClickableStat>
        <ClickableStat onClick={() => setResumo("negociacao")} ariaLabel={t("Em negociação")}>
          <StatCard
            title={t("Em negociação")}
            value={stats.valorNegociacao}
            icon={<Handshake size={16} />}
            accentColor="var(--warning)"
            subtitle={t("{n} orçamentos abertos", { n: stats.porStatus.negociacao })}
          />
        </ClickableStat>
        <ClickableStat onClick={() => setResumo("orcamentos")} ariaLabel={t("Resumo de orçamentos")}>
          <StatCard
            title={t("Conversão")}
            value={`${stats.conversao}%`}
            icon={<FileText size={16} />}
            accentColor={accent}
            subtitle={t("{v} de {o} viraram venda", {
              v: stats.totalVendas,
              o: stats.totalOrcamentos + stats.totalVendas,
            })}
          />
        </ClickableStat>
        <ClickableStat onClick={() => setResumo("perdidos")} ariaLabel={t("Orçamentos perdidos")}>
          <StatCard
            title={t("Orçamentos perdidos")}
            value={stats.porStatus.recusado}
            icon={<XCircle size={16} />}
            accentColor="var(--danger)"
            subtitle={stats.valorPerdidos}
          />
        </ClickableStat>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Orçamentos recentes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="section-title">{t("Orçamentos recentes")}</div>
            <button
              onClick={() => onNavigate?.("vendas", "vendas-historico")}
              className="btn-ghost text-xs inline-flex items-center gap-1"
            >
              {t("Ver todos")}
              <ChevronRight size={12} />
            </button>
          </div>
          {orcamentosRecentes.length === 0 ? (
            <div className="text-sm text-muted text-center py-8">
              {t("Nenhum orçamento criado em {mes}.", { mes: tituloMes })}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {orcamentosRecentes.map((o) => {
                const artista = artistas.find((d) => d.id === o.artistaId);
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
                        {artista?.name}
                      </div>
                      <div className="text-xs text-muted tabular-nums">
                        {formatarMoeda(o.valorCache, o.moeda)}
                      </div>
                    </div>
                    <span className={`badge ${st.badge}`}>{t(st.label)}</span>
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
            <div className="section-title">{t("Vendas recentes")}</div>
            <button
              onClick={() => onNavigate?.("vendas", "vendas-historico-vendas")}
              className="btn-ghost text-xs inline-flex items-center gap-1"
            >
              {t("Ver todas")}
              <ChevronRight size={12} />
            </button>
          </div>
          {vendasRecentes.length === 0 ? (
            <div className="text-sm text-muted text-center py-8">
              {t("Nenhuma venda fechada em {mes}.", { mes: tituloMes })}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {vendasRecentes.map((v) => {
                const artista = artistas.find((d) => d.id === v.artistaId);
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
                        {artista?.name} · {v.contratanteNome}
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-primary flex-shrink-0">
                      {formatarMoeda(v.cache, v.moeda)}
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
            <div className="stat-label">{t("Ticket médio por venda")}</div>
            <div
              className="text-xl font-bold tabular-nums text-primary"
              title={stats.ticketMultiMoeda ? t("Ticket médio indisponível com múltiplas moedas") : undefined}
            >
              {stats.ticketMedio}
            </div>
          </div>
        </div>
      )}

      {/* Modal de resumo — aberto pelos cards de cima */}
      <ResumoModal
        isOpen={resumo !== null}
        onClose={() => setResumo(null)}
        title={meta.titulo}
        subtitle={meta.subtitulo}
        accentColor={
          resumo === "vendas"
            ? "var(--success)"
            : resumo === "negociacao"
            ? "var(--warning)"
            : resumo === "perdidos"
            ? "var(--danger)"
            : accent
        }
      >
        {resumo === "orcamentos" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <ResumoNumero label={t("Total")} valor={stats.totalOrcamentos} />
              <ResumoNumero label={t("Em aberto")} valor={stats.pendentes} accentColor={accent} />
            </div>
            <div className="flex flex-col gap-2">
              <div className="stat-label">{t("Por status")}</div>
              {(["pendente", "negociacao", "aceito", "recusado"] as OrcamentoStatus[]).map((s) => (
                <ResumoLinha
                  key={s}
                  label={
                    <span className={`badge ${LABELS_STATUS_ORCAMENTO[s].badge}`}>
                      {t(LABELS_STATUS_ORCAMENTO[s].label)}
                    </span>
                  }
                  valor={stats.porStatus[s]}
                />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <div className="stat-label">{t("Valores")}</div>
              <ResumoLinha label={t("Em aberto (pendentes + negociação)")} valor={stats.valorEmAberto} />
              <ResumoLinha label={t("Valor total")} valor={stats.valorTotalOrc} />
              <ResumoLinha label={t("Taxa de conversão")} valor={`${stats.conversao}%`} destaque />
            </div>
            {orcamentosRecentes.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="stat-label">{t("Recentes")}</div>
                <ResumoLista
                  itens={orcamentosRecentes.map((o) => ({
                    id: o.id,
                    titulo: artistas.find((d) => d.id === o.artistaId)?.name ?? o.numero,
                    subtitulo: o.numero,
                    valor: formatarMoeda(o.valorCache, o.moeda),
                  }))}
                  onItemClick={(id) => {
                    setResumo(null);
                    onAbrirOrcamento?.(id);
                  }}
                />
              </div>
            )}
            <ResumoFooter
              label={t("Ver histórico de orçamentos")}
              onClick={() => {
                setResumo(null);
                onNavigate?.("vendas", "vendas-historico");
              }}
            />
          </>
        )}

        {resumo === "vendas" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <ResumoNumero label={t("Vendas fechadas")} valor={stats.totalVendas} />
              <ResumoNumero label={t("Faturamento")} valor={stats.faturamento} accentColor="var(--success)" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="stat-label">{t("Pagamentos")}</div>
              <ResumoLinha label={t("Recebido")} valor={stats.recebido} destaque />
              <ResumoLinha label={t("A receber")} valor={stats.aReceber} />
              <ResumoLinha label={t("Em atraso")} valor={stats.atrasado} />
            </div>
            <div className="flex flex-col gap-2">
              <ResumoLinha label={t("Ticket médio")} valor={stats.ticketMedio} />
              <ResumoLinha label={t("Próximas (a realizar)")} valor={stats.proximas} />
              <ResumoLinha label={t("Já realizadas")} valor={stats.realizadas} />
            </div>
            {vendasRecentes.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="stat-label">{t("Recentes")}</div>
                <ResumoLista
                  itens={vendasRecentes.map((v) => ({
                    id: v.id,
                    titulo: v.nomeEvento,
                    subtitulo: `${artistas.find((d) => d.id === v.artistaId)?.name ?? ""} · ${v.contratanteNome}`,
                    valor: formatarMoeda(v.cache, v.moeda),
                  }))}
                  onItemClick={(id) => {
                    setResumo(null);
                    onAbrirVenda?.(id);
                  }}
                />
              </div>
            )}
            <ResumoFooter
              label={t("Ver histórico de vendas")}
              onClick={() => {
                setResumo(null);
                onNavigate?.("vendas", "vendas-historico-vendas");
              }}
            />
          </>
        )}

        {resumo === "negociacao" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <ResumoNumero label={t("Em negociação")} valor={stats.porStatus.negociacao} accentColor="var(--warning)" />
              <ResumoNumero label={t("Valor total")} valor={stats.valorNegociacao} />
            </div>
            {negociacaoRecentes.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="stat-label">{t("Recentes")}</div>
                <ResumoLista
                  itens={negociacaoRecentes.map((o) => ({
                    id: o.id,
                    titulo: artistas.find((d) => d.id === o.artistaId)?.name ?? o.numero,
                    subtitulo: o.numero,
                    valor: formatarMoeda(o.valorCache, o.moeda),
                  }))}
                  onItemClick={(id) => {
                    setResumo(null);
                    onAbrirOrcamento?.(id);
                  }}
                />
              </div>
            ) : (
              <div className="text-sm text-muted text-center py-4">
                {t("Nenhum orçamento em negociação em {mes}.", { mes: tituloMes })}
              </div>
            )}
            <ResumoFooter
              label={t("Ver histórico de orçamentos")}
              onClick={() => {
                setResumo(null);
                onNavigate?.("vendas", "vendas-historico");
              }}
            />
          </>
        )}

        {resumo === "perdidos" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <ResumoNumero label={t("Orçamentos perdidos")} valor={stats.porStatus.recusado} accentColor="var(--danger)" />
              <ResumoNumero label={t("Valor total")} valor={stats.valorPerdidos} />
            </div>
            {perdidosRecentes.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="stat-label">{t("Recentes")}</div>
                <ResumoLista
                  itens={perdidosRecentes.map((o) => ({
                    id: o.id,
                    titulo: artistas.find((d) => d.id === o.artistaId)?.name ?? o.numero,
                    subtitulo: o.numero,
                    valor: formatarMoeda(o.valorCache, o.moeda),
                  }))}
                  onItemClick={(id) => {
                    setResumo(null);
                    onAbrirOrcamento?.(id);
                  }}
                />
              </div>
            ) : (
              <div className="text-sm text-muted text-center py-4">
                {t("Nenhum orçamento perdido em {mes}.", { mes: tituloMes })}
              </div>
            )}
            <ResumoFooter
              label={t("Ver histórico de orçamentos")}
              onClick={() => {
                setResumo(null);
                onNavigate?.("vendas", "vendas-historico");
              }}
            />
          </>
        )}
      </ResumoModal>
    </div>
  );
}
