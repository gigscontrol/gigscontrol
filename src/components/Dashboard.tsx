"use client";

import { useMemo, useState } from "react";
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
import DateRangeSelector from "./DateRangeSelector";
import {
  ClickableStat,
  ResumoModal,
  ResumoNumero,
  ResumoLinha,
  ResumoLista,
  ResumoFooter,
  type ResumoListaItem,
} from "./DashboardResumo";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas, useWorkspace } from "@/lib/workspace-context";
import { gradienteSutil } from "@/lib/gradiente";
import { formatBRL } from "@/lib/whatsapp";
import {
  LABELS_STATUS_PARCELA,
  statusEfetivoParcela,
  type Parcela,
} from "@/types";
import type { ActiveTab, ActivePage, AgendaDateRange } from "@/types";
import { useT } from "@/lib/i18n";

const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ATALHOS_FIN: AgendaDateRange[] = ["Visão geral", "Mês anterior", "Mês atual", "Próximo mês", "Personalizado"];

/** Resolve {ano, mes(0-based), tudo}. "Visão geral" = all-time. */
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

/** A data (vencimento) cai no período? Em "Visão geral", tudo passa. */
function dataNoMes(dataISO: string | undefined, p: { ano: number; mes: number; tudo: boolean }): boolean {
  if (p.tudo) return true;
  if (!dataISO) return false;
  const d = dataISO.length <= 10 ? new Date(`${dataISO}T12:00:00`) : new Date(dataISO);
  return d.getFullYear() === p.ano && d.getMonth() === p.mes;
}

function fmtData(dataISO: string): string {
  return new Date(dataISO + "T12:00:00").toLocaleDateString("pt-BR");
}

type Props = {
  selectedArtistas: string[];
  onNavigate?: (tab: ActiveTab, page: ActivePage) => void;
  onAbrirVenda?: (id: string) => void;
};

type LinhaParcela = {
  vendaId: string;
  vendaNumero: string;
  parcela: Parcela;
  indice: number;
  total: number;
  artistaId: string;
  artistaNome: string;
  artistaColor: string;
  contratante: string;
};

/** Qual card está com o popup de resumo aberto. */
type ResumoAberto = null | "total" | "recebido" | "areceber" | "atrasado";

export default function Dashboard({ selectedArtistas, onNavigate, onAbrirVenda }: Props) {
  const t = useT();
  const accent = "var(--brand)";
  const { vendas } = useVendas();
  const artistas = useArtistas();
  const { workspaceCriadoEm } = useWorkspace();

  // ---- Seletor de período (padrão: Mês atual) ----
  const [range, setRange] = useState<AgendaDateRange>("Mês atual");
  const [customMonth, setCustomMonth] = useState<string | null>(null);
  const [customYear, setCustomYear] = useState<number | null>(null);
  const periodo = useMemo(
    () => resolverMes(range, customMonth, customYear),
    [range, customMonth, customYear]
  );
  const tituloPeriodo = periodo.tudo ? t("Visão geral") : `${MESES_LONGO[periodo.mes]} ${periodo.ano}`;

  // ---- Popup de resumo por card (padrão dos outros dashboards) ----
  const [resumo, setResumo] = useState<ResumoAberto>(null);
  const irParaPagamentos = () => {
    setResumo(null);
    onNavigate?.("financeiro", "financeiro-pagamentos");
  };
  // O id do item é "vendaId::parcelaId" (único p/ key); ao clicar, abre a venda.
  const abrirVendaDoItem = (id: string) => {
    setResumo(null);
    onAbrirVenda?.(id.split("::")[0]);
  };

  const vendasVisiveis = useMemo(
    () => vendas.filter((v) => selectedArtistas.includes(v.artistaId)),
    [vendas, selectedArtistas]
  );

  // Achata parcelas
  const parcelas = useMemo<LinhaParcela[]>(() => {
    const linhas: LinhaParcela[] = [];
    for (const v of vendasVisiveis) {
      const artista = artistas.find((d) => d.id === v.artistaId);
      v.parcelas.forEach((parcela, idx) => {
        linhas.push({
          vendaId: v.id,
          vendaNumero: v.numero,
          parcela,
          indice: idx + 1,
          total: v.parcelas.length,
          artistaId: v.artistaId,
          artistaNome: artista?.name ?? "—",
          artistaColor: artista?.color ?? "#888",
          contratante: v.contratanteNome,
        });
      });
    }
    return linhas;
  }, [vendasVisiveis, artistas]);

  // Parcelas do período (por data de vencimento).
  const parcelasPeriodo = useMemo(
    () => parcelas.filter((l) => dataNoMes(l.parcela.dataVencimento, periodo)),
    [parcelas, periodo]
  );

  const totais = useMemo(() => {
    let recebido = 0;
    let aReceber = 0;
    let atrasado = 0;
    for (const l of parcelasPeriodo) {
      const st = statusEfetivoParcela(l.parcela);
      if (st === "cancelado") continue; // baixada/isenta sai do a-receber
      if (st === "pago") recebido += l.parcela.valor;
      else if (st === "atrasado") atrasado += l.parcela.valor;
      else aReceber += l.parcela.valor;
    }
    return { recebido, aReceber, atrasado, total: recebido + aReceber + atrasado };
  }, [parcelasPeriodo]);

  // Próximos vencimentos (pendentes/atrasados, ordenado por data)
  const proximosVencimentos = useMemo(() => {
    return parcelasPeriodo
      .filter((l) => {
        const st = statusEfetivoParcela(l.parcela);
        return st !== "pago" && st !== "cancelado";
      })
      .sort(
        (a, b) =>
          new Date(a.parcela.dataVencimento).getTime() -
          new Date(b.parcela.dataVencimento).getTime()
      )
      .slice(0, 6);
  }, [parcelasPeriodo]);

  // ---- Listas dos popups (por status), como ResumoListaItem ----
  const paraItem = (l: LinhaParcela): ResumoListaItem => ({
    id: `${l.vendaId}::${l.parcela.id}`,
    titulo: l.contratante,
    subtitulo: `${l.vendaNumero} · ${t("parc")} ${l.indice}/${l.total} · ${fmtData(l.parcela.dataVencimento)}`,
    valor: formatBRL(l.parcela.valor),
  });
  const itensRecebidos = useMemo(
    () =>
      parcelasPeriodo
        .filter((l) => statusEfetivoParcela(l.parcela) === "pago")
        .sort((a, b) => new Date(b.parcela.dataVencimento).getTime() - new Date(a.parcela.dataVencimento).getTime())
        .map(paraItem),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parcelasPeriodo, t]
  );
  const itensAReceber = useMemo(
    () =>
      parcelasPeriodo
        .filter((l) => {
          const st = statusEfetivoParcela(l.parcela);
          return st !== "pago" && st !== "atrasado" && st !== "cancelado";
        })
        .sort((a, b) => new Date(a.parcela.dataVencimento).getTime() - new Date(b.parcela.dataVencimento).getTime())
        .map(paraItem),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parcelasPeriodo, t]
  );
  const itensAtrasados = useMemo(
    () =>
      parcelasPeriodo
        .filter((l) => statusEfetivoParcela(l.parcela) === "atrasado")
        .sort((a, b) => new Date(a.parcela.dataVencimento).getTime() - new Date(b.parcela.dataVencimento).getTime())
        .map(paraItem),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parcelasPeriodo, t]
  );

  // Faturamento por artista — soma as parcelas do período (exclui canceladas).
  const porArtista = useMemo(() => {
    return artistas.filter((d) => selectedArtistas.includes(d.id))
      .map((artista) => ({
        artista,
        valor: parcelasPeriodo
          .filter((l) => l.artistaId === artista.id && statusEfetivoParcela(l.parcela) !== "cancelado")
          .reduce((acc, l) => acc + l.parcela.valor, 0),
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [parcelasPeriodo, selectedArtistas, artistas]);

  const maxArtista = Math.max(1, ...porArtista.map((p) => p.valor));
  const pctRecebido =
    totais.total > 0 ? Math.round((totais.recebido / totais.total) * 100) : 0;

  const vazio = (msg: string) => (
    <div className="text-sm text-muted text-center py-4">{msg}</div>
  );

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Financeiro"
        subtitle={`${t("Recebimentos, pendências e faturamento")} · ${tituloPeriodo}`}
        accentColor={accent}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeSelector
              options={ATALHOS_FIN}
              value={range}
              onChange={setRange}
              selectedCustomMonth={customMonth}
              setSelectedCustomMonth={setCustomMonth}
              selectedCustomYear={customYear}
              setSelectedCustomYear={setCustomYear}
              accountCreatedAt={workspaceCriadoEm}
            />
            <button
              onClick={() => onNavigate?.("financeiro", "financeiro-pagamentos")}
              className="btn btn-primary whitespace-nowrap"
            >
              <Wallet size={14} />
              {t("Controle de Pagamentos")}
            </button>
          </div>
        }
      />

      {/* Cards clicáveis — abrem um popup de resumo na própria página; o rodapé do
          popup leva ao Controle de Pagamentos. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <ClickableStat onClick={() => setResumo("total")} ariaLabel={t("Resumo do total em vendas")}>
          <StatCard
            title={t("Total em Vendas")}
            value={formatBRL(totais.total)}
            icon={<DollarSign size={16} />}
            accentColor={accent}
            subtitle={t("Soma de todas as parcelas")}
          />
        </ClickableStat>
        <ClickableStat onClick={() => setResumo("recebido")} ariaLabel={t("Resumo do recebido")}>
          <StatCard
            title={t("Recebido")}
            value={formatBRL(totais.recebido)}
            icon={<CheckCircle2 size={16} />}
            accentColor="var(--success)"
            subtitle={t("{pct}% do total", { pct: pctRecebido })}
          />
        </ClickableStat>
        <ClickableStat onClick={() => setResumo("areceber")} ariaLabel={t("Resumo do a receber")}>
          <StatCard
            title={t("A Receber")}
            value={formatBRL(totais.aReceber)}
            icon={<CalendarClock size={16} />}
            accentColor="var(--warning)"
            subtitle={t("Parcelas pendentes")}
          />
        </ClickableStat>
        <ClickableStat onClick={() => setResumo("atrasado")} ariaLabel={t("Resumo do atrasado")}>
          <StatCard
            title={t("Atrasado")}
            value={formatBRL(totais.atrasado)}
            icon={<AlertTriangle size={16} />}
            accentColor="var(--danger)"
            subtitle={t("Vencidas e não pagas")}
          />
        </ClickableStat>
      </div>

      {/* Barra de progresso de recebimento */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="section-title">{t("Progresso de recebimento")}</div>
          <span className="text-sm font-bold tabular-nums" style={{ color: accent }}>
            {pctRecebido}%
          </span>
        </div>
        <div className="h-3 rounded-full bg-elevated overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pctRecebido}%`, background: "var(--grad-signal)" }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted">
          <span>{t("Recebido")} {formatBRL(totais.recebido)}</span>
          <span>{t("Falta")} {formatBRL(totais.aReceber + totais.atrasado)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Próximos vencimentos */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="section-title">{t("Próximos vencimentos")}</div>
            <button
              onClick={() => onNavigate?.("financeiro", "financeiro-pagamentos")}
              className="btn-ghost text-xs inline-flex items-center gap-1"
            >
              {t("Ver todos")}
              <ChevronRight size={12} />
            </button>
          </div>
          {proximosVencimentos.length === 0 ? (
            <div className="text-sm text-muted text-center py-8">
              {t("Nenhuma parcela pendente. Tudo em dia!")}
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
                      style={{ backgroundColor: l.artistaColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary truncate">
                        {l.contratante}
                        <span className="text-muted text-xs ml-1.5">
                          {l.vendaNumero} · {t("parc")} {l.indice}/{l.total}
                        </span>
                      </div>
                      <div className="text-xs text-muted">
                        {t("Vence")} {fmtData(l.parcela.dataVencimento)}
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-primary flex-shrink-0">
                      {formatBRL(l.parcela.valor)}
                    </span>
                    <span className={`badge ${label.badge}`}>{t(label.label)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Faturamento por artista */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} style={{ color: accent }} />
            <div className="section-title">{t("Faturamento")}</div>
          </div>
          {porArtista.every((p) => p.valor === 0) ? (
            <div className="text-sm text-muted text-center py-8">
              {t("Sem vendas registradas.")}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {porArtista.map(({ artista, valor }) => (
                <div key={artista.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-primary">{artista.name}</span>
                    <span className="tabular-nums text-secondary">
                      {formatBRL(valor)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(valor / maxArtista) * 100}%`,
                        background: gradienteSutil(artista.color),
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
          onClick={() => setResumo("atrasado")}
          className="card mt-4 flex items-center gap-3 w-full text-left hover:border-border-strong transition-colors"
          style={{
            borderColor: "var(--danger)",
            backgroundColor: "var(--danger-weak)",
          }}
        >
          <AlertTriangle
            size={18}
            className="flex-shrink-0"
            style={{ color: "var(--danger)" }}
          />
          <div className="flex-1 text-sm text-secondary">
            {t("Você tem")} <strong>{formatBRL(totais.atrasado)}</strong> {t("em parcelas atrasadas. Toque para resolver no Controle de Pagamentos.")}
          </div>
          <ChevronRight size={16} className="text-muted flex-shrink-0" />
        </button>
      )}

      {/* ── Popups de resumo (padrão card->popup->detalhe) ── */}
      <ResumoModal
        isOpen={resumo === "total"}
        onClose={() => setResumo(null)}
        title={t("Total em Vendas")}
        subtitle={tituloPeriodo}
        accentColor={accent}
      >
        <ResumoNumero valor={formatBRL(totais.total)} label={t("Soma de todas as parcelas")} accentColor={accent} />
        <ResumoLinha label={t("Recebido")} valor={formatBRL(totais.recebido)} />
        <ResumoLinha label={t("A Receber")} valor={formatBRL(totais.aReceber)} />
        <ResumoLinha label={t("Atrasado")} valor={formatBRL(totais.atrasado)} />
        <ResumoLinha label={t("Progresso de recebimento")} valor={`${pctRecebido}%`} destaque />
        <ResumoFooter label={t("Ver no Controle de Pagamentos")} onClick={irParaPagamentos} />
      </ResumoModal>

      <ResumoModal
        isOpen={resumo === "recebido"}
        onClose={() => setResumo(null)}
        title={t("Recebido")}
        subtitle={tituloPeriodo}
        accentColor="var(--success)"
      >
        <ResumoNumero valor={formatBRL(totais.recebido)} label={t("{pct}% do total", { pct: pctRecebido })} accentColor="var(--success)" />
        {itensRecebidos.length > 0 ? (
          <ResumoLista itens={itensRecebidos} onItemClick={abrirVendaDoItem} />
        ) : (
          vazio(t("Nenhuma parcela recebida no período."))
        )}
        <ResumoFooter label={t("Ver no Controle de Pagamentos")} onClick={irParaPagamentos} />
      </ResumoModal>

      <ResumoModal
        isOpen={resumo === "areceber"}
        onClose={() => setResumo(null)}
        title={t("A Receber")}
        subtitle={tituloPeriodo}
        accentColor="var(--warning)"
      >
        <ResumoNumero valor={formatBRL(totais.aReceber)} label={t("Parcelas pendentes")} accentColor="var(--warning)" />
        {itensAReceber.length > 0 ? (
          <ResumoLista itens={itensAReceber} onItemClick={abrirVendaDoItem} />
        ) : (
          vazio(t("Nada a receber no período."))
        )}
        <ResumoFooter label={t("Ver no Controle de Pagamentos")} onClick={irParaPagamentos} />
      </ResumoModal>

      <ResumoModal
        isOpen={resumo === "atrasado"}
        onClose={() => setResumo(null)}
        title={t("Atrasado")}
        subtitle={tituloPeriodo}
        accentColor="var(--danger)"
      >
        <ResumoNumero valor={formatBRL(totais.atrasado)} label={t("Vencidas e não pagas")} accentColor="var(--danger)" />
        {itensAtrasados.length > 0 ? (
          <ResumoLista itens={itensAtrasados} onItemClick={abrirVendaDoItem} />
        ) : (
          vazio(t("Nenhuma parcela atrasada. Tudo em dia!"))
        )}
        <ResumoFooter label={t("Ver no Controle de Pagamentos")} onClick={irParaPagamentos} />
      </ResumoModal>
    </div>
  );
}
