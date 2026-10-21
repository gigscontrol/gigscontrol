"use client";

import { useMemo, useState } from "react";
import { resolverMes } from "@/lib/periodo";
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
} from "lucide-react";
import PageHeader from "./PageHeader";
import { EstadoCarga } from "./EstadoCarga";
import StatCard from "./StatCard";
import DateRangeSelector from "./DateRangeSelector";
import { useNavegacao } from "./NavOverlay";
import { useFiltroArtistas } from "./FiltroArtistas";
import TabelaDados, { type Coluna } from "./lista/TabelaDados";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas, useWorkspace } from "@/lib/workspace-context";
import { formatarMoeda, totaisPorMoeda } from "@/lib/formatters";
import { calcularTotaisFinanceiro } from "@/lib/financeiro/totais";
import {
  LABELS_STATUS_PARCELA,
  statusEfetivoParcela,
  type StatusParcela,
  type Parcela,
  type AgendaDateRange,
  type Moeda,
} from "@/types";
import { useT } from "@/lib/i18n";

const MESES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ATALHOS_FIN: AgendaDateRange[] = ["Visão geral", "Mês anterior", "Mês atual", "Próximo mês", "Personalizado"];

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
  artistaId: string;
  artistaNome: string;
  artistaColor: string;
  contratante: string;
  nomeEvento: string;
  status: StatusParcela;
  /** Moeda da venda dona — a parcela herda (não tem moeda própria). */
  moeda: Moeda;
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
  buscaInicial = null,
}: {
  modo?: "completo" | "cobrancas";
  /** Busca já preenchida ao abrir (ex.: o número da venda, vindo do alerta
   *  "Parcelas atrasadas" da Agência) — leva o admin direto à parcela em vez
   *  de despejá-lo na lista inteira de cobranças. */
  buscaInicial?: string | null;
}) {
  const t = useT();
  const ehCobrancas = modo === "cobrancas";
  const accent = "var(--brand)";
  const { vendas, acaoParcela, carregando: carregandoVendas, erro: erroVendas, recarregar: recarregarVendas } = useVendas();
  const artistas = useArtistas();
  const { workspaceCriadoEm } = useWorkspace();

  const [search, setSearch] = useState(buscaInicial ?? "");
  const [filtroStatus, setFiltroStatus] = useState<StatusParcela | "todos">("todos");
  // A parcela abre no modal GLOBAL com endereço (?parcela=<id>, ver layout):
  // F5 mantém aberta e o link pode ser mandado pra alguém.
  const { abrirSobreposicao } = useNavegacao();
  const abrirParcela = (l: LinhaParcela) => abrirSobreposicao("parcela", l.parcela.id);
  // Seletor de período (padrão: Visão geral). Filtra por data de vencimento.
  const [range, setRange] = useState<AgendaDateRange>("Visão geral");
  const [customMonth, setCustomMonth] = useState<string | null>(null);
  const [customYear, setCustomYear] = useState<number | null>(null);
  const periodo = useMemo(
    () => resolverMes(range, customMonth, customYear),
    [range, customMonth, customYear]
  );
  const tituloPeriodo = periodo.tudo ? t("Visão geral") : `${MESES_LONGO[periodo.mes]} ${periodo.ano}`;

  // Filtro "Artistas" da barra lateral (regra única: lib/filtroArtistas).
  const filtro = useFiltroArtistas();
  const todasParcelas = useMemo<LinhaParcela[]>(() => {
    const linhas: LinhaParcela[] = [];
    for (const v of vendas) {
      if (!filtro.passa(v.artistaId)) continue;
      const artista = artistas.find((d) => d.id === v.artistaId);
      v.parcelas.forEach((parcela, idx) => {
        linhas.push({
          vendaId: v.id,
          vendaNumero: v.numero,
          parcela,
          indiceParcela: idx + 1,
          totalParcelas: v.parcelas.length,
          artistaId: v.artistaId,
          artistaNome: artista?.name ?? "—",
          artistaColor: artista?.color ?? "#888",
          contratante: v.contratanteNome,
          nomeEvento: v.nomeEvento,
          status: statusEfetivoParcela(parcela),
          moeda: v.moeda,
        });
      });
    }
    return linhas.sort(
      (a, b) =>
        new Date(a.parcela.dataVencimento).getTime() -
        new Date(b.parcela.dataVencimento).getTime()
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendas, artistas, filtro.selecionados, filtro.ativo]);

  // Recorte do período (por data de vencimento). "Visão geral" = todas.
  const parcelasPeriodo = useMemo(
    () => todasParcelas.filter((l) => dataNoMes(l.parcela.dataVencimento, periodo)),
    [todasParcelas, periodo]
  );

  // Totais dos cards — cada um com sua própria régua de data. A lógica mora
  // em `@/lib/financeiro/totais` (pura, com bateria): foi justamente ela que
  // já produziu três números errados de uma vez, então merece prova por
  // execução em vez de conferência no olho.
  const totais = useMemo(
    () =>
      calcularTotaisFinanceiro(
        todasParcelas.map((l) => ({
          status: l.status,
          moeda: l.moeda,
          valor: l.parcela.valor,
          dataVencimento: l.parcela.dataVencimento,
          dataPagamento: l.parcela.dataPagamento,
        })),
        periodo,
        new Date()
      ),
    [todasParcelas, periodo]
  );

  const lista = useMemo(() => {
    return parcelasPeriodo.filter((l) => {
      if (filtroStatus !== "todos" && l.status !== filtroStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [l.vendaNumero, l.contratante, l.nomeEvento, l.artistaNome]
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

  // Fila da página "Cobranças": fixadas + atrasadas (em aberto). A busca vale
  // aqui também — o "Cobrar" da Agência chega com o nº da venda preenchido e
  // antes era ignorado (a fila inteira aparecia).
  const filaCobrancas = useMemo(
    () =>
      todasParcelas.filter((l) => {
        if (!(l.parcela.meta?.fixada || l.status === "atrasado")) return false;
        if (l.status === "pago" || l.status === "cancelado") return false;
        if (search.trim()) {
          const hay = [l.vendaNumero, l.contratante, l.nomeEvento, l.artistaNome]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(search.toLowerCase())) return false;
        }
        return true;
      }),
    [todasParcelas, search]
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

  // LISTA PADRÃO (a mesma de Vendas/Orçamentos): uma tabela só, colunas que
  // ordenam, 50 por página, cartão no celular. Antes cada parcela era um card
  // solto — o único lugar do painel com esse desenho.
  const colunasParcelas = useMemo<Coluna<LinhaParcela>[]>(
    () => [
      {
        chave: "vencimento",
        titulo: "Vencimento",
        classe: "whitespace-nowrap tabular-nums",
        ordenarPor: (l) => l.parcela.dataVencimento,
        celula: (l) => (
          <div>
            <div className="font-semibold text-primary">{fmtData(l.parcela.dataVencimento)}</div>
            {l.status === "pago" && l.parcela.dataPagamento ? (
              <div className="text-[0.7rem] text-success">
                {t("pago em")} {fmtData(l.parcela.dataPagamento)}
              </div>
            ) : (
              <div className="text-[0.7rem] text-muted">
                {t("parcela {i}/{n}", { i: l.indiceParcela, n: l.totalParcelas })}
              </div>
            )}
          </div>
        ),
      },
      {
        chave: "contratante",
        titulo: "Contratante",
        classe: "font-medium text-primary max-w-[240px] truncate",
        ordenarPor: (l) => l.contratante,
        celula: (l) => l.contratante || "—",
      },
      {
        chave: "venda",
        titulo: "Venda",
        ordenarPor: (l) => l.vendaNumero,
        celula: (l) => (
          <div className="min-w-0 max-w-[260px]">
            <div className="font-mono text-xs" style={{ color: accent }}>
              {l.vendaNumero}
            </div>
            {l.nomeEvento && <div className="text-xs text-muted truncate">{l.nomeEvento}</div>}
          </div>
        ),
      },
      {
        chave: "artista",
        titulo: "Artista",
        classe: "text-secondary whitespace-nowrap",
        ordenarPor: (l) => l.artistaNome,
        celula: (l) => (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: l.artistaColor }} />
            {l.artistaNome}
          </span>
        ),
      },
      {
        chave: "valor",
        titulo: "Valor",
        alinhar: "direita",
        classe: "font-bold text-primary tabular-nums whitespace-nowrap",
        decrescentePrimeiro: true,
        ordenarPor: (l) => l.parcela.valor,
        celula: (l) => formatarMoeda(l.parcela.valor, l.moeda),
      },
      {
        chave: "status",
        titulo: "Status",
        ordenarPor: (l) => t(LABELS_STATUS_PARCELA[l.status].label),
        celula: (l) => {
          const st = LABELS_STATUS_PARCELA[l.status];
          const meta = l.parcela.meta;
          const nCobrancas = meta?.cobrancas?.length ?? 0;
          return (
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <span className={`badge ${st.badge}`}>
                {l.status === "pago" && <CheckCircle2 size={11} />}
                {l.status === "pendente" && <Clock size={11} />}
                {l.status === "atrasado" && <AlertTriangle size={11} />}
                {l.status === "cancelado" && <Ban size={11} />}
                {t(st.label)}
              </span>
              {nCobrancas > 0 && l.status !== "pago" && l.status !== "cancelado" && (
                <span
                  className="text-[0.7rem] inline-flex items-center gap-1"
                  style={{ color: "var(--warning)" }}
                  title={t("cobrado {n}x", { n: nCobrancas })}
                >
                  <BellRing size={11} /> {nCobrancas}
                </span>
              )}
              {meta?.pagamento?.comprovantePath && (
                <Paperclip size={13} className="text-muted" aria-label={t("Comprovante")} />
              )}
            </span>
          );
        },
      },
    ],
    [t, accent]
  );

  // 📌 Fixar — cobrança prioritária (o clique não abre a parcela).
  const acoesParcela = (l: LinhaParcela) => {
    const fixada = !!l.parcela.meta?.fixada;
    const podeFixar = l.status !== "pago" && l.status !== "cancelado";
    return (
      <button
        type="button"
        onClick={() => toggleFixar(l)}
        disabled={!podeFixar && !fixada}
        title={fixada ? t("Desafixar") : t("Fixar cobrança")}
        aria-label={fixada ? t("Desafixar") : t("Fixar cobrança")}
        className="btn-ghost p-2 rounded disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Pin
          size={15}
          style={{
            color: fixada ? "var(--warning)" : "var(--text-muted)",
            fill: fixada ? "var(--warning)" : "none",
          }}
        />
      </button>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title={ehCobrancas ? "Cobranças" : "Pagamentos"}
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

      {/* Falha de API deixa de parecer financeiro zerado (auditoria 27/08/2026). */}
      <div className="mb-6 empty:hidden">
        <EstadoCarga
          carregando={carregandoVendas && vendas.length === 0}
          erro={erroVendas}
          aoTentar={recarregarVendas}
          rotulo={t("parcelas")}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Cada card diz por qual DATA ele recorta — era a ausência disso que
            fazia "Total em vendas" parecer o total vendido (e não era). */}
        <StatCard
          title={t("Recebido")}
          value={totais.recebido}
          icon={<CheckCircle2 size={18} />}
          accentColor="var(--success)"
          subtitle={t("Pelo dia do pagamento")}
        />
        <StatCard
          title={t("A receber")}
          value={totais.aReceber}
          icon={<CalendarClock size={18} />}
          accentColor="var(--warning)"
          subtitle={t("Vence no período")}
        />
        <StatCard
          title={t("Atrasado")}
          value={totais.atrasado}
          icon={<AlertTriangle size={18} />}
          accentColor="var(--danger)"
          subtitle={t("Vencido, de todos os meses")}
        />
        <StatCard
          title={t("Previsto (90 dias)")}
          value={totais.previsto}
          icon={<DollarSign size={18} />}
          accentColor={accent}
          subtitle={t("Vence a partir de hoje")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex h-[42px] items-center gap-2 bg-surface border border-border rounded-md px-3 flex-1 min-w-[240px] max-w-md focus-within:border-border-strong transition-colors">
          <Search size={15} className="text-muted flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Buscar por venda, contratante, evento, artista...")}
            className="input"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted hover:text-primary text-xs">
              {t("Limpar")}
            </button>
          )}
        </div>

        {!ehCobrancas && (
        <div className="pill-group h-[42px] items-center">
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
        )}
      </div>

      {!ehCobrancas && fixadas.length > 0 && (
        <div className="card mb-4 overflow-hidden" style={{ borderColor: "var(--warning)" }}>
          <div className="section-title mb-3 inline-flex items-center gap-2">
            <Pin size={15} style={{ color: "var(--warning)" }} />
            {t("Fixadas — cobranças a fazer")} · {fixadas.length}
          </div>
          <div className="-mx-5 -mb-5 border-t border-border">
            <TabelaDados
              itens={fixadas}
              colunas={colunasParcelas}
              chaveDe={(l) => `fix-${l.vendaId}-${l.parcela.id}`}
              onAbrir={abrirParcela}
              acoes={acoesParcela}
              rotuloItens="parcelas"
            />
          </div>
        </div>
      )}

      {itensLista.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center mb-3">
            <Wallet size={18} className="text-muted" />
          </div>
          <div className="section-title mb-1">
            {ehCobrancas && search.trim()
              ? t("Nenhum resultado")
              : ehCobrancas
              ? t("Nenhuma cobrança pendente 🎉")
              : todasParcelas.length === 0
                ? t("Nenhuma parcela registrada")
                : t("Nenhum resultado")}
          </div>
          <div className="section-subtitle">
            {ehCobrancas && search.trim()
              ? t("Ajuste os filtros ou a busca")
              : ehCobrancas
              ? t("Nada fixado nem atrasado — tudo em dia!")
              : todasParcelas.length === 0
                ? t("As parcelas aparecem aqui quando você concretiza uma venda")
                : t("Ajuste os filtros ou a busca")}
          </div>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <TabelaDados
            itens={itensLista}
            colunas={colunasParcelas}
            chaveDe={(l) => `${l.vendaId}-${l.parcela.id}`}
            onAbrir={abrirParcela}
            acoes={acoesParcela}
            rotuloItens="parcelas"
          />
        </div>
      )}

      {!ehCobrancas && totais.atrasadoNum > 0 && (
        <div className="mt-4 card flex items-start gap-3" style={{ borderColor: "var(--danger)", backgroundColor: "rgba(239,68,68,0.06)" }}>
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--danger)" }} />
          <div className="text-sm text-secondary">
            {t("Você tem")} <strong>{totais.atrasado}</strong>{" "}
            {t("em parcelas atrasadas ({n} {parcela}). Filtre por \"Atrasadas\" para ver e cobrar.", {
              n: contadores.atrasado,
              parcela: contadores.atrasado === 1 ? t("parcela") : t("parcelas"),
            })}
          </div>
        </div>
      )}

    </div>
  );
}
