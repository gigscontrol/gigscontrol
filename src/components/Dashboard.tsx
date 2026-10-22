"use client";

import { useMemo, useState } from "react";
import { resolverMes, dataNoMes } from "@/lib/periodo";
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
import { formatarMoeda, totaisPorMoeda, formatarData } from "@/lib/formatters";
import { calcularTotaisFinanceiro } from "@/lib/financeiro/totais";
import {
  LABELS_STATUS_PARCELA,
  statusEfetivoParcela,
  type Parcela,
  type Moeda,
} from "@/types";
import type { ActiveTab, ActivePage, AgendaDateRange } from "@/types";
import { useT } from "@/lib/i18n";
import { useNavegacao } from "./NavOverlay";
import { useFiltroArtistas } from "./FiltroArtistas";

const MESES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ATALHOS_FIN: AgendaDateRange[] = ["Visão geral", "Mês anterior", "Mês atual", "Próximo mês", "Personalizado"];

/** A data (vencimento) cai no período? Em "Visão geral", tudo passa. */

/** Mais antigo primeiro. */
function porVencimento(a: LinhaParcela, b: LinhaParcela): number {
  return new Date(a.parcela.dataVencimento).getTime() - new Date(b.parcela.dataVencimento).getTime();
}

/** Quando o dinheiro entrou: pagamento; lançamento antigo sem data cai no vencimento. */
function entrouEm(l: LinhaParcela): string {
  return l.parcela.dataPagamento || l.parcela.dataVencimento;
}

const fmtData = (dataISO: string) => formatarData(dataISO);

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
  /** Moeda da venda dona — a parcela herda (não tem moeda própria). */
  moeda: Moeda;
};

/** Qual card está com o popup de resumo aberto. */
type ResumoAberto = null | "total" | "recebido" | "areceber" | "atrasado";

export default function Dashboard({ onNavigate, onAbrirVenda }: Props) {
  const t = useT();
  const filtro = useFiltroArtistas();
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
  // O id do item é "vendaId::parcelaId" (único p/ key). Clicar abre a PARCELA
  // (modal com endereço: informar pagamento, cobrar…), que tem link pra venda.
  const { abrirSobreposicao } = useNavegacao();
  const abrirParcelaDoItem = (id: string) => {
    setResumo(null);
    const parcelaId = id.split("::")[1];
    if (parcelaId) abrirSobreposicao("parcela", parcelaId);
    else onAbrirVenda?.(id.split("::")[0]);
  };

  const vendasVisiveis = useMemo(
    // Regra ÚNICA do filtro de artistas (a mesma de Pagamentos): filtro
    // desligado = tudo, inclusive venda de artista que saiu da conta. O
    // `selectedArtistas.includes` daqui escondia essas vendas sempre, e o
    // "Atrasado" daqui não batia com o de Pagamentos.
    () => vendas.filter((v) => filtro.passa(v.artistaId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendas, filtro.selecionados, filtro.ativo]
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
          artistaNome: artista?.name ?? (artistas.length > 0 && v.artistaId ? t("Artista removido") : "—"),
          artistaColor: artista?.color ?? "#888",
          contratante: v.contratanteNome,
          moeda: v.moeda,
        });
      });
    }
    return linhas;
  }, [vendasVisiveis, artistas, t]);

  // Parcelas do período (por data de vencimento).
  const parcelasPeriodo = useMemo(
    () => parcelas.filter((l) => dataNoMes(l.parcela.dataVencimento, periodo)),
    [parcelas, periodo]
  );

  // Totais pela MESMA lógica pura do Controle de Pagamentos (lib/financeiro/
  // totais.ts, com bateria). Antes esta tela tinha um cálculo inline por
  // VENCIMENTO que a auditoria pegou: "Recebido" contava a parcela no mês em
  // que ela vencia (não no que o dinheiro entrou) e "Atrasado" escondia o
  // vencido de meses anteriores. Agora Recebido vai pela data de pagamento e
  // Atrasado agrega todos os meses — percorre `parcelas` (tudo), não o recorte.
  const totais = useMemo(
    () =>
      calcularTotaisFinanceiro(
        parcelas.map((l) => ({
          status: statusEfetivoParcela(l.parcela),
          moeda: l.moeda,
          valor: l.parcela.valor,
          dataVencimento: l.parcela.dataVencimento,
          dataPagamento: l.parcela.dataPagamento,
        })),
        periodo,
        new Date()
      ),
    [parcelas, periodo]
  );

  // Vencimentos, separados como os cards: VENCIDAS de todos os meses (igual
  // ao card Atrasado) e A VENCER no período, em dia. Antes uma lista só
  // ("Próximos vencimentos") misturava atrasadas do período com as futuras.
  const vencidas = useMemo(
    () => parcelas.filter((l) => statusEfetivoParcela(l.parcela) === "atrasado").sort(porVencimento),
    [parcelas]
  );
  const aVencer = useMemo(
    () => parcelasPeriodo.filter((l) => statusEfetivoParcela(l.parcela) === "pendente").sort(porVencimento),
    [parcelasPeriodo]
  );

  // ---- Listas dos popups (por status), como ResumoListaItem ----
  const paraItem = (l: LinhaParcela): ResumoListaItem => ({
    id: `${l.vendaId}::${l.parcela.id}`,
    titulo: l.contratante,
    subtitulo: `${l.vendaNumero} · ${t("parc")} ${l.indice}/${l.total} · ${fmtData(l.parcela.dataVencimento)}`,
    valor: formatarMoeda(l.parcela.valor, l.moeda),
  });
  // Mesma régua do card: entra no mês em que o dinheiro entrou.
  const itensRecebidos = useMemo(
    () =>
      parcelas
        .filter((l) => statusEfetivoParcela(l.parcela) === "pago" && dataNoMes(entrouEm(l), periodo))
        .sort((a, b) => new Date(entrouEm(b)).getTime() - new Date(entrouEm(a)).getTime())
        .map(paraItem),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parcelas, periodo, t]
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
    () => vencidas.map(paraItem),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vencidas, t]
  );

  // Faturamento por artista — soma as parcelas do período (exclui canceladas).
  // `valor` (soma crua) só ordena e dimensiona a barra; a exibição usa `valorStr`
  // agrupado por moeda (um artista pode ter vendas em moedas diferentes).
  const porArtista = useMemo(() => {
    const somar = (linhas: LinhaParcela[]) => ({
      valor: linhas.reduce((acc, l) => acc + l.parcela.valor, 0),
      valorStr: totaisPorMoeda(linhas.map((l) => ({ valor: l.parcela.valor, moeda: l.moeda }))),
    });
    const ativas = parcelasPeriodo.filter((l) => statusEfetivoParcela(l.parcela) !== "cancelado");
    const barras = artistas
      .filter((d) => filtro.passa(d.id))
      .map((artista) => ({
        id: artista.id,
        nome: artista.name,
        cor: artista.color,
        ...somar(ativas.filter((l) => l.artistaId === artista.id)),
      }));
    // Venda de artista que saiu da conta (ou sem artista) também é dinheiro:
    // uma barra própria, pra soma das barras bater com o total.
    const semArtista = ativas.filter((l) => !artistas.some((a) => a.id === l.artistaId));
    // (Com a lista de artistas ainda carregando, tudo pareceria "removido".)
    if (artistas.length > 0 && semArtista.length > 0) {
      barras.push({ id: "__sem-artista", nome: t("Artistas removidos"), cor: "#6B7280", ...somar(semArtista) });
    }
    return barras.sort((a, b) => b.valor - a.valor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelasPeriodo, filtro.selecionados, filtro.ativo, artistas, t]);

  const maxArtista = Math.max(1, ...porArtista.map((p) => p.valor));
  const pctRecebido =
    totais.totalNum > 0 ? Math.round((totais.recebidoNum / totais.totalNum) * 100) : 0;

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
              {t("Pagamentos")}
            </button>
          </div>
        }
      />

      {/* Cards clicáveis — abrem um popup de resumo na própria página; o rodapé do
          popup leva ao Controle de Pagamentos. */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <ClickableStat onClick={() => setResumo("total")} ariaLabel={t("Resumo do total do período")}>
          <StatCard
            title={t("Total do período")}
            value={totais.total}
            icon={<DollarSign size={16} />}
            accentColor={accent}
            subtitle={t("Recebido + a receber + atrasado")}
          />
        </ClickableStat>
        <ClickableStat onClick={() => setResumo("recebido")} ariaLabel={t("Resumo do recebido")}>
          <StatCard
            title={t("Recebido")}
            value={totais.recebido}
            icon={<CheckCircle2 size={16} />}
            accentColor="var(--success)"
            subtitle={t("Pela data do pagamento · {pct}% do total", { pct: pctRecebido })}
          />
        </ClickableStat>
        <ClickableStat onClick={() => setResumo("areceber")} ariaLabel={t("Resumo do a receber")}>
          <StatCard
            title={t("A Receber")}
            value={totais.aReceber}
            icon={<CalendarClock size={16} />}
            accentColor="var(--warning)"
            subtitle={t("Vencem no período, em dia")}
          />
        </ClickableStat>
        <ClickableStat onClick={() => setResumo("atrasado")} ariaLabel={t("Resumo do atrasado")}>
          <StatCard
            title={t("Atrasado")}
            value={totais.atrasado}
            icon={<AlertTriangle size={16} />}
            accentColor="var(--danger)"
            subtitle={t("Vencidas, de todos os meses")}
          />
        </ClickableStat>
      </div>

      {/* Barra de progresso de recebimento */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="section-title">{t("Progresso de recebimento")}</h2>
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
          <span>{t("Recebido")} {totais.recebido}</span>
          <span>{t("Falta")} {totais.falta}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Vencimentos: vencidas (todos os meses) separadas das a vencer */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">{t("Vencimentos")}</h2>
            <button
              onClick={() => onNavigate?.("financeiro", "financeiro-pagamentos")}
              className="btn-ghost text-xs inline-flex items-center gap-1"
            >
              {t("Ver todos")}
              <ChevronRight size={12} />
            </button>
          </div>
          {vencidas.length === 0 && aVencer.length === 0 ? (
            <div className="text-sm text-muted text-center py-8">
              {t("Nenhuma parcela pendente. Tudo em dia!")}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {vencidas.length > 0 && (
                <GrupoVencimentos
                  titulo={t("Vencidas")}
                  total={vencidas.length}
                  cor="var(--danger)"
                  linhas={vencidas.slice(0, 3)}
                  prefixoData={t("Venceu")}
                  onAbrir={(id) => abrirSobreposicao("parcela", id)}
                />
              )}
              <GrupoVencimentos
                titulo={t("A vencer · {periodo}", { periodo: tituloPeriodo })}
                total={aVencer.length}
                linhas={aVencer.slice(0, vencidas.length > 0 ? 3 : 6)}
                prefixoData={t("Vence")}
                vazio={t("Nada mais a vencer no período.")}
                onAbrir={(id) => abrirSobreposicao("parcela", id)}
              />
            </div>
          )}
        </div>

        {/* Faturamento por artista */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} style={{ color: accent }} />
            <div className="min-w-0">
              <h2 className="section-title">{t("Parcelas por artista")}</h2>
              <div className="text-xs text-muted">
                {t("Pelo vencimento · {periodo}", { periodo: tituloPeriodo })}
              </div>
            </div>
          </div>
          {porArtista.every((p) => p.valor === 0) ? (
            <div className="text-sm text-muted text-center py-8">
              {t("Sem vendas registradas.")}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {porArtista.map(({ id, nome, cor, valor, valorStr }) => (
                <div key={id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-primary">{nome}</span>
                    <span className="tabular-nums text-secondary">
                      {valorStr}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(valor / maxArtista) * 100}%`,
                        background: gradienteSutil(cor),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {totais.atrasadoNum > 0 && (
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
            {t("Você tem")} <strong>{totais.atrasado}</strong> {t("em parcelas atrasadas. Resolva em Pagamentos.")}
          </div>
          <ChevronRight size={16} className="text-muted flex-shrink-0" />
        </button>
      )}

      {/* ── Popups de resumo (padrão card->popup->detalhe) ── */}
      <ResumoModal
        isOpen={resumo === "total"}
        onClose={() => setResumo(null)}
        title={t("Total do período")}
        subtitle={tituloPeriodo}
        accentColor={accent}
      >
        <ResumoNumero valor={totais.total} label={t("Recebido + a receber + atrasado")} accentColor={accent} />
        <ResumoLinha label={t("Recebido")} valor={totais.recebido} />
        <ResumoLinha label={t("A Receber")} valor={totais.aReceber} />
        <ResumoLinha label={t("Atrasado")} valor={totais.atrasado} />
        <ResumoLinha label={t("Progresso de recebimento")} valor={`${pctRecebido}%`} destaque />
        <ResumoFooter label={t("Ver em Pagamentos")} onClick={irParaPagamentos} />
      </ResumoModal>

      <ResumoModal
        isOpen={resumo === "recebido"}
        onClose={() => setResumo(null)}
        title={t("Recebido")}
        subtitle={tituloPeriodo}
        accentColor="var(--success)"
      >
        <ResumoNumero valor={totais.recebido} label={t("{pct}% do total", { pct: pctRecebido })} accentColor="var(--success)" />
        {itensRecebidos.length > 0 ? (
          <ResumoLista itens={itensRecebidos} onItemClick={abrirParcelaDoItem} />
        ) : (
          vazio(t("Nenhuma parcela recebida no período."))
        )}
        <ResumoFooter label={t("Ver em Pagamentos")} onClick={irParaPagamentos} />
      </ResumoModal>

      <ResumoModal
        isOpen={resumo === "areceber"}
        onClose={() => setResumo(null)}
        title={t("A Receber")}
        subtitle={tituloPeriodo}
        accentColor="var(--warning)"
      >
        <ResumoNumero valor={totais.aReceber} label={t("Vencem no período, em dia")} accentColor="var(--warning)" />
        {itensAReceber.length > 0 ? (
          <ResumoLista itens={itensAReceber} onItemClick={abrirParcelaDoItem} />
        ) : (
          vazio(t("Nada a receber no período."))
        )}
        <ResumoFooter label={t("Ver em Pagamentos")} onClick={irParaPagamentos} />
      </ResumoModal>

      <ResumoModal
        isOpen={resumo === "atrasado"}
        onClose={() => setResumo(null)}
        title={t("Atrasado")}
        subtitle={t("Vencidas, de todos os meses")}
        accentColor="var(--danger)"
      >
        <ResumoNumero valor={totais.atrasado} label={t("Vencidas e não pagas")} accentColor="var(--danger)" />
        {itensAtrasados.length > 0 ? (
          <ResumoLista itens={itensAtrasados} onItemClick={abrirParcelaDoItem} />
        ) : (
          vazio(t("Nenhuma parcela atrasada. Tudo em dia!"))
        )}
        <ResumoFooter label={t("Ver em Pagamentos")} onClick={irParaPagamentos} />
      </ResumoModal>
    </div>
  );
}

/** Um grupo da lista de vencimentos (Vencidas / A vencer). */
function GrupoVencimentos({
  titulo,
  total,
  cor,
  linhas,
  prefixoData,
  vazio,
  onAbrir,
}: {
  titulo: string;
  total: number;
  cor?: string;
  linhas: LinhaParcela[];
  prefixoData: string;
  vazio?: string;
  onAbrir: (parcelaId: string) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="stat-label" style={cor ? { color: cor } : undefined}>
          {titulo}
        </span>
        {total > linhas.length && (
          <span className="text-xs text-muted">{t("{n} de {total}", { n: linhas.length, total })}</span>
        )}
      </div>
      {linhas.length === 0 && vazio ? (
        <div className="text-sm text-muted py-2">{vazio}</div>
      ) : (
        linhas.map((l) => {
          const label = LABELS_STATUS_PARCELA[statusEfetivoParcela(l.parcela)];
          return (
            <button
              key={`${l.vendaId}-${l.parcela.id}`}
              onClick={() => onAbrir(l.parcela.id)}
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
                  {prefixoData} {fmtData(l.parcela.dataVencimento)}
                </div>
              </div>
              <span className="text-sm font-semibold tabular-nums text-primary flex-shrink-0">
                {formatarMoeda(l.parcela.valor, l.moeda)}
              </span>
              <span className={`badge ${label.badge}`}>{t(label.label)}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
