"use client";

import { useMemo, useState } from "react";
import {
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wallet,
  CalendarClock,
  DollarSign,
  Ban,
  BellRing,
  Paperclip,
  Pin,
  ChevronRight,
} from "lucide-react";
import PageHeader from "./PageHeader";
import StatCard from "./StatCard";
import DateRangeSelector from "./DateRangeSelector";
import ParcelaDetalheModal from "./ParcelaDetalheModal";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas, useWorkspace } from "@/lib/workspace-context";
import { formatBRL } from "@/lib/whatsapp";
import {
  LABELS_STATUS_PARCELA,
  statusEfetivoParcela,
  type StatusParcela,
  type Parcela,
  type AgendaDateRange,
} from "@/types";
import { useT } from "@/lib/i18n";

const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ATALHOS_FIN: AgendaDateRange[] = ["Visão geral", "Mês anterior", "Mês atual", "Próximo mês", "Personalizado"];

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

function dataNoMes(dataISO: string | undefined, p: { ano: number; mes: number; tudo: boolean }): boolean {
  if (p.tudo) return true;
  if (!dataISO) return false;
  const d = dataISO.length <= 10 ? new Date(`${dataISO}T12:00:00`) : new Date(dataISO);
  return d.getFullYear() === p.ano && d.getMonth() === p.mes;
}

/** Linha achatada: uma parcela + dados da venda dona */
type LinhaParcela = {
  vendaId: string;
  vendaNumero: string;
  parcela: Parcela;
  indiceParcela: number;
  totalParcelas: number;
  djId: string;
  djNome: string;
  djColor: string;
  contratante: string;
  nomeEvento: string;
  status: StatusParcela;
};

function fmtData(iso?: string): string {
  if (!iso) return "";
  // Uma data pura "YYYY-MM-DD" é lida como meia-noite UTC pelo JS, exibindo o
  // DIA ANTERIOR em fuso negativo (BR, UTC-3). Ancora ao meio-dia local.
  const s = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso;
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

export default function ControlePagamentos({
  modo = "completo",
}: {
  modo?: "completo" | "cobrancas";
}) {
  const t = useT();
  const ehCobrancas = modo === "cobrancas";
  const accent = "var(--brand)";
  const { vendas, acaoParcela } = useVendas();
  const artistas = useArtistas();
  const { workspaceCriadoEm } = useWorkspace();

  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusParcela | "todos">("todos");
  const [detalhe, setDetalhe] = useState<{ vendaId: string; parcelaId: string } | null>(null);
  // Seletor de período (padrão: Visão geral). Filtra por data de vencimento.
  const [range, setRange] = useState<AgendaDateRange>("Visão geral");
  const [customMonth, setCustomMonth] = useState<string | null>(null);
  const [customYear, setCustomYear] = useState<number | null>(null);
  const periodo = useMemo(
    () => resolverMes(range, customMonth, customYear),
    [range, customMonth, customYear]
  );
  const tituloPeriodo = periodo.tudo ? t("Visão geral") : `${MESES_LONGO[periodo.mes]} ${periodo.ano}`;

  const todasParcelas = useMemo<LinhaParcela[]>(() => {
    const linhas: LinhaParcela[] = [];
    for (const v of vendas) {
      const dj = artistas.find((d) => d.id === v.djId);
      v.parcelas.forEach((parcela, idx) => {
        linhas.push({
          vendaId: v.id,
          vendaNumero: v.numero,
          parcela,
          indiceParcela: idx + 1,
          totalParcelas: v.parcelas.length,
          djId: v.djId,
          djNome: dj?.name ?? "—",
          djColor: dj?.color ?? "#888",
          contratante: v.contratanteNome,
          nomeEvento: v.nomeEvento,
          status: statusEfetivoParcela(parcela),
        });
      });
    }
    return linhas.sort(
      (a, b) =>
        new Date(a.parcela.dataVencimento).getTime() -
        new Date(b.parcela.dataVencimento).getTime()
    );
  }, [vendas, artistas]);

  // Recorte do período (por data de vencimento). "Visão geral" = todas.
  const parcelasPeriodo = useMemo(
    () => todasParcelas.filter((l) => dataNoMes(l.parcela.dataVencimento, periodo)),
    [todasParcelas, periodo]
  );

  // Totais — CANCELADO (baixado/isentado) sai do a receber/atrasado.
  const totais = useMemo(() => {
    let recebido = 0;
    let aReceber = 0;
    let atrasado = 0;
    for (const l of parcelasPeriodo) {
      if (l.status === "cancelado") continue;
      if (l.status === "pago") recebido += l.parcela.valor;
      else if (l.status === "atrasado") atrasado += l.parcela.valor;
      else aReceber += l.parcela.valor;
    }
    return { recebido, aReceber, atrasado, total: recebido + aReceber + atrasado };
  }, [parcelasPeriodo]);

  const lista = useMemo(() => {
    return parcelasPeriodo.filter((l) => {
      if (filtroStatus !== "todos" && l.status !== filtroStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [l.vendaNumero, l.contratante, l.nomeEvento, l.djNome]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [parcelasPeriodo, filtroStatus, search]);

  const contadores = useMemo(() => {
    const c = { pago: 0, pendente: 0, atrasado: 0, cancelado: 0 };
    parcelasPeriodo.forEach((l) => c[l.status]++);
    return c;
  }, [parcelasPeriodo]);

  // Fixadas (📌) — fila de cobranças a fazer. Independe do período (all-time),
  // só as em aberto (não pagas/canceladas).
  const fixadas = useMemo(
    () =>
      todasParcelas.filter(
        (l) => l.parcela.meta?.fixada && l.status !== "pago" && l.status !== "cancelado"
      ),
    [todasParcelas]
  );

  // Fila da página "Fixadas / Cobranças": fixadas + atrasadas (em aberto).
  const filaCobrancas = useMemo(
    () =>
      todasParcelas.filter(
        (l) =>
          (l.parcela.meta?.fixada || l.status === "atrasado") &&
          l.status !== "pago" &&
          l.status !== "cancelado"
      ),
    [todasParcelas]
  );

  async function toggleFixar(l: LinhaParcela) {
    try {
      await acaoParcela(l.vendaId, l.parcela.id, { fixar: !l.parcela.meta?.fixada });
    } catch {
      /* silencioso — o estado não muda se falhar */
    }
  }

  // Na página "Cobranças", a lista é a fila (fixadas + atrasadas); senão, o
  // recorte por período + filtros.
  const itensLista = ehCobrancas ? filaCobrancas : lista;

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title={ehCobrancas ? "Fixados" : "Controle de Pagamentos"}
        subtitle={
          ehCobrancas
            ? t("Cobranças fixadas e parcelas atrasadas — a fila do que precisa cobrar")
            : `${t("Parcelas de todas as vendas — informe pagamento, cobre ou cancele")} · ${tituloPeriodo}`
        }
        accentColor={accent}
        actions={
          ehCobrancas ? undefined : (
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
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title={t("Total em vendas")} value={formatBRL(totais.total)} icon={<DollarSign size={18} />} accentColor={accent} />
        <StatCard title={t("Recebido")} value={formatBRL(totais.recebido)} icon={<CheckCircle2 size={18} />} accentColor="var(--success)" />
        <StatCard title={t("A receber")} value={formatBRL(totais.aReceber)} icon={<CalendarClock size={18} />} accentColor="var(--warning)" />
        <StatCard title={t("Atrasado")} value={formatBRL(totais.atrasado)} icon={<AlertTriangle size={18} />} accentColor="var(--danger)" />
      </div>

      {!ehCobrancas && (
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-2 flex-1 min-w-[240px] max-w-md focus-within:border-border-strong transition-colors">
          <Search size={15} className="text-muted flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Buscar por venda, contratante, evento, DJ...")}
            className="input"
          />
        </div>

        <div className="pill-group">
          <button type="button" className={`pill ${filtroStatus === "todos" ? "active" : ""}`} onClick={() => setFiltroStatus("todos")}>
            {t("Todas ({n})", { n: parcelasPeriodo.length })}
          </button>
          <button type="button" className={`pill ${filtroStatus === "pendente" ? "active" : ""}`} onClick={() => setFiltroStatus("pendente")}>
            <Clock size={11} />
            {t("Pendentes ({n})", { n: contadores.pendente })}
          </button>
          <button type="button" className={`pill ${filtroStatus === "atrasado" ? "active" : ""}`} onClick={() => setFiltroStatus("atrasado")}>
            <AlertTriangle size={11} />
            {t("Atrasadas ({n})", { n: contadores.atrasado })}
          </button>
          <button type="button" className={`pill ${filtroStatus === "pago" ? "active" : ""}`} onClick={() => setFiltroStatus("pago")}>
            <CheckCircle2 size={11} />
            {t("Pagas ({n})", { n: contadores.pago })}
          </button>
          {contadores.cancelado > 0 && (
            <button type="button" className={`pill ${filtroStatus === "cancelado" ? "active" : ""}`} onClick={() => setFiltroStatus("cancelado")}>
              <Ban size={11} />
              {t("Canceladas ({n})", { n: contadores.cancelado })}
            </button>
          )}
        </div>
      </div>
      )}

      {!ehCobrancas && fixadas.length > 0 && (
        <div className="card mb-4" style={{ borderColor: "var(--warning)" }}>
          <div className="section-title mb-3 inline-flex items-center gap-2">
            <Pin size={15} style={{ color: "var(--warning)" }} />
            {t("Fixadas — cobranças a fazer")} · {fixadas.length}
          </div>
          <div className="flex flex-col gap-2">
            {fixadas.map((l) => (
              <ParcelaRow
                key={`fix-${l.vendaId}-${l.parcela.id}`}
                linha={l}
                accent={accent}
                onClick={() => setDetalhe({ vendaId: l.vendaId, parcelaId: l.parcela.id })}
                onToggleFixar={() => toggleFixar(l)}
              />
            ))}
          </div>
        </div>
      )}

      {itensLista.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center mb-3">
            <Wallet size={18} className="text-muted" />
          </div>
          <div className="section-title mb-1">
            {ehCobrancas
              ? t("Nenhuma cobrança pendente 🎉")
              : todasParcelas.length === 0
                ? t("Nenhuma parcela registrada")
                : t("Nenhum resultado")}
          </div>
          <div className="section-subtitle">
            {ehCobrancas
              ? t("Nada fixado nem atrasado — tudo em dia!")
              : todasParcelas.length === 0
                ? t("As parcelas aparecem aqui quando você concretiza uma venda")
                : t("Ajuste os filtros ou a busca")}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {itensLista.map((l) => (
            <ParcelaRow
              key={`${l.vendaId}-${l.parcela.id}`}
              linha={l}
              accent={accent}
              onClick={() => setDetalhe({ vendaId: l.vendaId, parcelaId: l.parcela.id })}
              onToggleFixar={() => toggleFixar(l)}
            />
          ))}
        </div>
      )}

      {!ehCobrancas && totais.atrasado > 0 && (
        <div className="mt-4 card flex items-start gap-3" style={{ borderColor: "var(--danger)", backgroundColor: "rgba(239,68,68,0.06)" }}>
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--danger)" }} />
          <div className="text-sm text-secondary">
            {t("Você tem")} <strong>{formatBRL(totais.atrasado)}</strong>{" "}
            {t("em parcelas atrasadas ({n} {parcela}). Filtre por \"Atrasadas\" para ver e cobrar.", {
              n: contadores.atrasado,
              parcela: contadores.atrasado === 1 ? t("parcela") : t("parcelas"),
            })}
          </div>
        </div>
      )}

      <ParcelaDetalheModal
        vendaId={detalhe?.vendaId ?? null}
        parcelaId={detalhe?.parcelaId ?? null}
        onClose={() => setDetalhe(null)}
      />
    </div>
  );
}

/* ============================================================ */

function ParcelaRow({
  linha: l,
  accent,
  onClick,
  onToggleFixar,
}: {
  linha: LinhaParcela;
  accent: string;
  onClick: () => void;
  onToggleFixar: () => void;
}) {
  const t = useT();
  const st = LABELS_STATUS_PARCELA[l.status];
  const venc = new Date(l.parcela.dataVencimento + "T12:00:00");
  const meta = l.parcela.meta;
  const nCobrancas = meta?.cobrancas?.length ?? 0;
  const temComprovante = !!meta?.pagamento?.comprovantePath;
  const fixada = !!meta?.fixada;
  const podeFixar = l.status !== "pago" && l.status !== "cancelado";

  return (
    <div className="card card-interactive w-full flex items-center gap-2 py-3 px-4">
      {/* Fixar (📌) — cobrança prioritária */}
      <button
        type="button"
        onClick={onToggleFixar}
        disabled={!podeFixar && !fixada}
        title={fixada ? t("Desafixar") : t("Fixar cobrança")}
        className="flex-shrink-0 p-1 rounded hover:bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Pin
          size={15}
          style={{
            color: fixada ? "var(--warning)" : "var(--text-muted)",
            fill: fixada ? "var(--warning)" : "none",
          }}
        />
      </button>
      <button
        type="button"
        onClick={onClick}
        className="flex-1 flex items-center gap-4 text-left min-w-0"
      >
      {/* Vencimento */}
      <div className="tabular-nums whitespace-nowrap min-w-[104px]">
        <div className="font-semibold text-primary text-sm">{venc.toLocaleDateString("pt-BR")}</div>
        {l.status === "pago" && l.parcela.dataPagamento ? (
          <div className="text-[0.7rem] text-success">
            {t("pago em")} {fmtData(l.parcela.dataPagamento + "T12:00:00")}
          </div>
        ) : (
          <div className="text-[0.7rem] text-muted">
            {t("parcela {i}/{n}", { i: l.indiceParcela, n: l.totalParcelas })}
          </div>
        )}
      </div>

      {/* Contratante / evento */}
      <div className="min-w-0 flex-1">
        <div className="font-medium text-primary truncate">{l.contratante || "—"}</div>
        <div className="text-xs text-muted truncate">
          <span className="font-mono" style={{ color: accent }}>{l.vendaNumero}</span>
          {l.nomeEvento ? ` · ${l.nomeEvento}` : ""}
        </div>
      </div>

      {/* DJ */}
      <div className="hidden md:flex items-center gap-1.5 text-secondary text-sm min-w-0 max-w-[160px]">
        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: l.djColor }} />
        <span className="truncate">{l.djNome}</span>
      </div>

      {/* Indicadores (cobrança / comprovante) */}
      <div className="hidden sm:flex items-center gap-2">
        {nCobrancas > 0 && l.status !== "pago" && l.status !== "cancelado" && (
          <span
            className="text-[0.7rem] inline-flex items-center gap-1"
            style={{ color: "var(--warning)" }}
            title={t("cobrado {n}x", { n: nCobrancas })}
          >
            <BellRing size={11} /> {nCobrancas}
          </span>
        )}
        {temComprovante && <Paperclip size={13} className="text-muted" />}
      </div>

      {/* Valor */}
      <div className="text-right tabular-nums font-bold text-primary whitespace-nowrap">
        {formatBRL(l.parcela.valor)}
      </div>

      {/* Status */}
      <div className="min-w-[92px] flex justify-end">
        <span className={`badge ${st.badge}`}>
          {l.status === "pago" && <CheckCircle2 size={11} />}
          {l.status === "pendente" && <Clock size={11} />}
          {l.status === "atrasado" && <AlertTriangle size={11} />}
          {l.status === "cancelado" && <Ban size={11} />}
          {t(st.label)}
        </span>
      </div>

      <ChevronRight size={16} className="text-muted flex-shrink-0" />
      </button>
    </div>
  );
}
