"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { useShows } from "@/lib/shows-context";
import { useNavegacao } from "@/components/NavOverlay";
import { ehEmailInterno } from "@/lib/email-interno";
import { formatBRL } from "@/lib/whatsapp";
import { totaisPorMoeda, formatarMoeda, formatarDataBR } from "@/lib/formatters";
import {
  resolverPeriodo,
  contarStatCards,
  calcularAlertas,
  showDispensadoDeContrato,
  rankingFaturamentoPorArtista,
  rankingContratantes,
  rankingCasas,
  rankingCidades,
  rankingVendasPorUsuario,
  rankingOrcamentosPorUsuario,
  MESES_LONGO,
} from "@/lib/agencia-dashboard";
import type { AgendaDateRange, Moeda, Show } from "@/types";
import { statusEfetivoParcela } from "@/types";
import type { HistoricoAcao, ModuloHistorico } from "@/lib/mappers/historico";
import PageHeader from "../PageHeader";
import StatCard from "../StatCard";
import DateRangeSelector from "../DateRangeSelector";
import RankingCard, { type MetricaConfig } from "./RankingCard";
import {
  ClickableStat,
  ResumoModal,
  ResumoNumero,
  ResumoLista,
  ResumoFooter,
  type ResumoListaItem,
} from "../DashboardResumo";
import AlertaDetalheModal, { type LinhaAlerta } from "./AlertaDetalheModal";

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

export default function AgenciaDashboard({
  onFazerContratoDaVenda,
  onVerCobrancaDaVenda,
  onAbrirContrato,
}: {
  /** "Fazer contrato" de uma venda sem contrato → Novo Contrato COM ela
   *  pré-selecionada. Sem a prop, cai no formulário em branco (degradação). */
  onFazerContratoDaVenda?: (vendaId: string) => void;
  /** "Resolver" uma parcela atrasada → Cobranças já filtradas por aquela venda. */
  onVerCobrancaDaVenda?: (termo: string) => void;
  /** "Resolver" um contrato aguardando assinatura → abre o contrato no Histórico. */
  onAbrirContrato?: (contratoId: string) => void;
} = {}) {
  const t = useT();
  const { artistas, equipe, workspaceCriadoEm } = useWorkspace();
  const { sessao } = useAuth();
  const { vendas } = useVendas();
  const { orcamentos } = useOrcamentos();
  const { contratantes, casas, cidades } = useContatos();
  const { contratos } = useContratos();
  const { shows, updateShow, carregando: carregandoShows } = useShows();
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
  // `shows` entra só pra excluir da contagem as vendas DISPENSADAS de contrato
  // (shows.meta.contratoDispensado — J5/"Ignorar").
  const alertas = useMemo(
    () => calcularAlertas(vendas, orcamentos, contratos, new Date(), shows),
    [vendas, orcamentos, contratos, shows]
  );

  // =========================================================================
  // J5 — Alertas acionáveis (popup com os itens por trás do número)
  // =========================================================================
  // TODO ESTADO NOVO MORA AQUI, no componente EXTERNO: as linhas/modais são
  // componentes aninhados, recriados a cada render.
  type AlertaId = "parcelas" | "contratos" | "orcamentos" | "semContrato";
  const [alertaAberto, setAlertaAberto] = useState<AlertaId | null>(null);
  /** Toggle do "desfazer": mostra também as vendas já dispensadas de contrato. */
  const [mostrarDispensadas, setMostrarDispensadas] = useState(false);
  /** id do show cujo PATCH de dispensa está em voo (desabilita o botão). */
  const [dispensando, setDispensando] = useState<string | null>(null);
  const [erroDispensa, setErroDispensa] = useState<string | null>(null);

  // J6 — qual StatCard do topo está com o resumo aberto.
  type StatId = "artistas" | "equipe" | "suspensos" | "bloqueados";
  const [statAberto, setStatAberto] = useState<StatId | null>(null);

  /** Navega fechando qualquer popup aberto (senão o modal fica por cima da tela nova). */
  const irPara = useCallback(
    (href: string) => {
      setAlertaAberto(null);
      setStatAberto(null);
      navegar(href);
    },
    [navegar]
  );

  const nomeArtista = useCallback(
    (id: string) => artistas.find((a) => a.id === id)?.name ?? "—",
    [artistas]
  );

  // (a) Parcelas atrasadas — uma linha por PARCELA (venda + parcela).
  const linhasParcelas = useMemo<LinhaAlerta[]>(() => {
    const hoje = new Date();
    const out: (LinhaAlerta & { _ord: number })[] = [];
    for (const v of vendas) {
      if (v.status === "cancelada") continue;
      for (const p of v.parcelas) {
        if (statusEfetivoParcela(p, hoje) !== "atrasado") continue;
        const venc = new Date(`${p.dataVencimento}T23:59:59`).getTime();
        const dias = Math.max(
          0,
          Math.floor((hoje.getTime() - venc) / 86_400_000)
        );
        out.push({
          _ord: dias,
          id: `${v.id}-${p.id}`,
          titulo: `${v.numero} · ${v.contratanteNome || "—"}`,
          subtitulo: `${nomeArtista(v.artistaId)} · ${v.nomeEvento || "—"}`,
          detalhe: `${t("Venceu em")} ${formatarDataBR(p.dataVencimento)} · ${t(
            "{n} dia{s} de atraso",
            { n: dias, s: dias === 1 ? "" : "s" }
          )}`,
          valor: formatarMoeda(p.valor, v.moeda),
          acoes: [
            {
              label: t("Ver"),
              onClick: () => irPara(`${BASE}/vendas/vendas/${v.id}`),
            },
            {
              label: t("Cobrar"),
              tone: "acao",
              // Leva o NÚMERO da venda como busca: Cobranças abre já filtrada
              // naquela venda (o campo de busca casa com `vendaNumero`).
              onClick: () => {
                setAlertaAberto(null);
                setStatAberto(null);
                if (onVerCobrancaDaVenda) onVerCobrancaDaVenda(v.numero);
                else irPara(`${BASE}/financeiro/cobrancas`);
              },
            },
          ],
        });
      }
    }
    // Mais atrasada primeiro.
    return out.sort((x, y) => y._ord - x._ord);
  }, [vendas, nomeArtista, irPara, onVerCobrancaDaVenda, t]);

  // (b) Contratos aguardando assinatura — status "enviado".
  const linhasContratos = useMemo<LinhaAlerta[]>(
    () =>
      contratos
        .filter((c) => c.status === "enviado")
        .map((c) => {
          const v = c.vendaId ? vendas.find((x) => x.id === c.vendaId) : undefined;
          return {
            id: c.id,
            titulo: `${c.numero}${v ? ` · ${v.contratanteNome || "—"}` : ""}`,
            subtitulo: v
              ? `${nomeArtista(v.artistaId)} · ${v.nomeEvento || "—"}`
              : t("Sem venda vinculada"),
            detalhe: c.dataEmissao
              ? `${t("Emitido em")} ${formatarDataBR(c.dataEmissao)}`
              : undefined,
            valor: v ? formatarMoeda(v.cache, v.moeda) : undefined,
            acoes: [
              ...(v
                ? [
                    {
                      label: t("Ver"),
                      onClick: () => irPara(`${BASE}/vendas/vendas/${v.id}`),
                    },
                  ]
                : []),
              {
                label: t("Abrir contrato"),
                tone: "acao" as const,
                // Abre ESTE contrato no Histórico (o Histórico já aceita
                // `abrirId`), em vez de despejar na lista inteira.
                onClick: () => {
                  setAlertaAberto(null);
                  setStatAberto(null);
                  if (onAbrirContrato) onAbrirContrato(c.id);
                  else irPara(`${BASE}/contratos/historico`);
                },
              },
            ],
          };
        }),
    [contratos, vendas, nomeArtista, irPara, onAbrirContrato, t]
  );

  // (c) Orçamentos parados — pendente/negociação criados há ≥ 7 dias.
  const linhasOrcamentos = useMemo<LinhaAlerta[]>(() => {
    const hoje = Date.now();
    const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;
    return orcamentos
      .filter((o) => {
        if (o.status !== "pendente" && o.status !== "negociacao") return false;
        const criado = new Date(o.criadoEm).getTime();
        return !Number.isNaN(criado) && hoje - criado >= SETE_DIAS;
      })
      .map((o) => ({
        id: o.id,
        titulo: `${o.numero} · ${
          contratantes.find((c) => c.id === o.contratanteId)?.nome ?? "—"
        }`,
        subtitulo: `${nomeArtista(o.artistaId)}${
          o.dataShow ? ` · ${formatarDataBR(o.dataShow)}` : ""
        }`,
        detalhe: `${t("Criado")} ${tempoRelativo(o.criadoEm, t)}`,
        valor: formatarMoeda(o.valorCache, o.moeda),
        acoes: [
          {
            label: t("Ver"),
            onClick: () => irPara(`${BASE}/vendas/orcamentos/${o.id}`),
          },
          {
            label: t("Resolver"),
            tone: "acao" as const,
            onClick: () => irPara(`${BASE}/vendas/orcamentos`),
          },
        ],
      }));
  }, [orcamentos, contratantes, nomeArtista, irPara, t]);

  // (d) Shows sem contrato — ITERA VENDAS (não shows). O show só entra pra
  // saber se aquela venda foi DISPENSADA de contrato.
  /** vendaId → show (o vínculo pelo lado que sempre existe). */
  const showPorVenda = useMemo(() => {
    const mapa = new Map<string, Show>();
    for (const s of shows) if (s.vendaId) mapa.set(s.vendaId, s);
    return mapa;
  }, [shows]);

  /**
   * Liga/desliga shows.meta.contratoDispensado (o servidor carimba em/por).
   * O campo é TRANSIENTE (só trafega no PATCH), como o `cancelamentoMotivo`.
   */
  const alternarDispensa = useCallback(
    async (showId: string, dispensar: boolean) => {
      setDispensando(showId);
      setErroDispensa(null);
      try {
        await updateShow(showId, { contratoDispensado: dispensar });
      } catch (e) {
        setErroDispensa((e as Error).message);
      } finally {
        setDispensando(null);
      }
    },
    [updateShow]
  );

  const linhasSemContrato = useMemo<LinhaAlerta[]>(() => {
    const comContrato = new Set(
      contratos
        .filter((c) => c.status !== "cancelado" && c.vendaId)
        .map((c) => c.vendaId)
    );
    return vendas
      .filter((v) => v.status !== "cancelada" && !comContrato.has(v.id))
      .map((v) => {
        const show = showPorVenda.get(v.id);
        const dispensada = show ? showDispensadoDeContrato(show) : false;
        return { v, show, dispensada };
      })
      // Sem o toggle, dispensadas somem (é o que "sai da contagem" significa).
      .filter(({ dispensada }) => mostrarDispensadas || !dispensada)
      .map(({ v, show, dispensada }) => {
        const acoes: LinhaAlerta["acoes"] = [
          {
            label: t("Ver"),
            onClick: () => irPara(`${BASE}/vendas/vendas/${v.id}`),
          },
        ];
        if (!dispensada) {
          acoes.push({
            label: t("Fazer contrato"),
            tone: "acao",
            // Vai pro Novo Contrato COM esta venda já selecionada — o popup
            // existe justamente pra poupar o admin de reencontrar a venda.
            onClick: () => {
              setAlertaAberto(null);
              setStatAberto(null);
              if (onFazerContratoDaVenda) onFazerContratoDaVenda(v.id);
              else irPara(`${BASE}/contratos/novo`);
            },
          });
        }
        // Venda sem show (criada sem data) não tem onde guardar a dispensa —
        // o botão fica desabilitado com a explicação, nunca some silenciosamente.
        acoes.push(
          show
            ? {
                label: dispensada ? t("Desfazer") : t("Ignorar"),
                tone: dispensada ? "neutro" : "perigo",
                disabled: dispensando === show.id,
                onClick: () => void alternarDispensa(show.id, !dispensada),
              }
            : {
                label: t("Ignorar"),
                tone: "perigo",
                disabled: true,
                title: t("Venda sem show na agenda (sem data) — não dá pra dispensar."),
                onClick: () => {},
              }
        );

        // O motivo do "Ignorar" desabilitado vai TAMBÉM no texto da linha:
        // botão disabled não dispara mouseenter no Chrome/Safari, então um
        // `title` sozinho é invisível — o admin veria um botão cinza e mudo.
        const detalheSemShow = !show
          ? t("Sem show na agenda (venda sem data) — não dá pra dispensar de contrato.")
          : null;

        return {
          id: v.id,
          titulo: `${v.numero} · ${v.contratanteNome || "—"}`,
          subtitulo: `${nomeArtista(v.artistaId)} · ${v.nomeEvento || "—"}`,
          detalhe: dispensada
            ? `${t("Dispensada de contrato em")} ${formatarDataBR(
                show?.contratoDispensado?.em ?? ""
              )}${
                show?.contratoDispensado?.porNome
                  ? ` ${t("por")} ${show.contratoDispensado.porNome}`
                  : ""
              }`
            : (detalheSemShow ??
              (v.dataShow
                ? `${t("Show em")} ${formatarDataBR(v.dataShow)}`
                : undefined)),
          valor: formatarMoeda(v.cache, v.moeda),
          esmaecida: dispensada,
          badge: dispensada
            ? { label: t("Dispensada"), className: "badge-neutral" }
            : undefined,
          acoes,
        };
      });
  }, [
    vendas,
    contratos,
    showPorVenda,
    mostrarDispensadas,
    dispensando,
    alternarDispensa,
    nomeArtista,
    irPara,
    onFazerContratoDaVenda,
    t,
  ]);

  /** Quantas vendas estão dispensadas (habilita o "mostrar dispensadas"). */
  const totalDispensadas = useMemo(() => {
    const comContrato = new Set(
      contratos
        .filter((c) => c.status !== "cancelado" && c.vendaId)
        .map((c) => c.vendaId)
    );
    return vendas.filter((v) => {
      if (v.status === "cancelada" || comContrato.has(v.id)) return false;
      const s = showPorVenda.get(v.id);
      return s ? showDispensadoDeContrato(s) : false;
    }).length;
  }, [vendas, contratos, showPorVenda]);

  // =========================================================================
  // J6 — itens por trás de cada StatCard do topo
  // =========================================================================
  const itensArtistas = useMemo<ResumoListaItem[]>(
    () =>
      artistas.map((a) => ({
        id: a.id,
        titulo: a.name,
        subtitulo: a.acessoSuspenso ? t("Acesso suspenso") : (a.username ?? undefined),
      })),
    [artistas, t]
  );
  const itensSuspensos = useMemo<ResumoListaItem[]>(
    () => itensArtistas.filter((i) => artistas.find((a) => a.id === i.id)?.acessoSuspenso),
    [itensArtistas, artistas]
  );
  const itensEquipe = useMemo<ResumoListaItem[]>(
    () =>
      equipe.map((u) => {
        // Membro criado pelo admin nasce com e-mail sintético
        // `{handle}@interno.gigscontrol.app` — endereço INTERNO, nunca exibido
        // (a aba Equipe mostra "Sem e-mail"). `email` também vem "" pra quem
        // não pode vê-lo (redigirUsuario), e aí o subtítulo é só o status.
        const semEmail = !u.email || ehEmailInterno(u.email);
        const base = semEmail ? t("Sem e-mail") : u.email;
        return {
          id: u.id,
          titulo: u.nome,
          subtitulo: u.ativo ? base : `${base} · ${t("Bloqueado")}`,
        };
      }),
    [equipe, t]
  );
  const itensBloqueados = useMemo<ResumoListaItem[]>(
    () => itensEquipe.filter((i) => equipe.find((u) => u.id === i.id)?.ativo === false),
    [itensEquipe, equipe]
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

  // Formatação das métricas dos rankings. `brl` é só o fallback 1-moeda; quando
  // `moeda: true`, o RankingCard exibe por moeda (totaisPorMoeda) usando a
  // quebra que cada linha carrega — nunca soma moedas diferentes (regra-mãe).
  const brl = (n: number) => formatBRL(n);
  const num = (n: number) => String(n);
  const m = (
    label: string,
    campo: "a" | "b",
    formato: (n: number) => string,
    moeda = false
  ): MetricaConfig => ({ label, campo, formato, moeda });

  // Formata um mapa {moeda → valor} pra exibição (mesmas 2 casas do formatBRL).
  const fmtMoedaMapa = (mapa: Partial<Record<Moeda, number>>) =>
    totaisPorMoeda(
      (Object.entries(mapa) as [Moeda, number][]).map(([moeda, valor]) => ({ valor, moeda })),
      2
    );

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

      {/* 4 StatCards — um de cada cor. Visíveis a qualquer papel.
          J6: clicáveis (ClickableStat) → ResumoModal com os itens da categoria. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ClickableStat
          onClick={() => setStatAberto("artistas")}
          ariaLabel={t("Ver artistas")}
        >
          <StatCard
            title={t("Artistas")}
            value={contagem.artistas}
            icon={<Music size={15} />}
            accentColor="var(--success)"
            subtitle={t("Total de artistas")}
          />
        </ClickableStat>
        <ClickableStat
          onClick={() => setStatAberto("equipe")}
          ariaLabel={t("Ver equipe")}
        >
          <StatCard
            title={t("Equipe")}
            value={contagem.equipe}
            icon={<Users size={15} />}
            accentColor="var(--brand)"
            subtitle={t("Total da equipe")}
          />
        </ClickableStat>
        <ClickableStat
          onClick={() => setStatAberto("suspensos")}
          ariaLabel={t("Ver artistas suspensos")}
        >
          <StatCard
            title={t("Suspensos")}
            value={contagem.suspensos}
            icon={<PauseCircle size={15} />}
            accentColor="var(--warning)"
            subtitle={t("Artistas com acesso suspenso")}
          />
        </ClickableStat>
        <ClickableStat
          onClick={() => setStatAberto("bloqueados")}
          ariaLabel={t("Ver membros bloqueados")}
        >
          <StatCard
            title={t("Bloqueados")}
            value={contagem.bloqueados}
            icon={<Ban size={15} />}
            accentColor="var(--danger)"
            subtitle={t("Membros da equipe bloqueados")}
          />
        </ClickableStat>
      </div>

      {isAdmin && (
        <>
          {/* ── Faixa de alertas (estado atual) ── */}
          <div className="section-title mt-8 mb-4">{t("Alertas")}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AlertaCard
              icon={<AlertTriangle size={15} />}
              label={t("Parcelas atrasadas")}
              valor={fmtMoedaMapa(alertas.parcelasAtrasadasPorMoeda)}
              sub={`${alertas.parcelasAtrasadasContagem} ${
                alertas.parcelasAtrasadasContagem === 1 ? t("parcela") : t("parcelas")
              }`}
              tone="danger"
              ativo={alertas.parcelasAtrasadasContagem > 0}
              onClick={() => setAlertaAberto("parcelas")}
            />
            <AlertaCard
              icon={<Clock size={15} />}
              label={t("Aguardando assinatura")}
              valor={alertas.contratosAguardando}
              sub={t("Contratos enviados")}
              tone="warning"
              ativo={alertas.contratosAguardando > 0}
              onClick={() => setAlertaAberto("contratos")}
            />
            <AlertaCard
              icon={<Hourglass size={15} />}
              label={t("Orçamentos parados")}
              valor={alertas.orcamentosParados}
              sub={t("Há 7 dias ou mais")}
              tone="warning"
              ativo={alertas.orcamentosParados > 0}
              onClick={() => setAlertaAberto("orcamentos")}
            />
            {/* Enquanto os shows não chegaram, o conjunto de DISPENSADAS é
                vazio e a contagem sairia inflada — mostra "—" em vez de um
                número que já estava resolvido e vai pular sozinho. */}
            <AlertaCard
              icon={<FileWarning size={15} />}
              label={t("Shows sem contrato")}
              valor={carregandoShows ? "—" : alertas.showsSemContrato}
              sub={t("Precisam de contrato")}
              tone="danger"
              ativo={!carregandoShows && alertas.showsSemContrato > 0}
              onClick={() => setAlertaAberto("semContrato")}
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
                m(t("Bruto"), "a", brl, true),
                m(t("Taxa de agência"), "b", brl, true),
              ]}
              vazioLabel={t("Sem dados no período.")}
            />
            <RankingCard
              icon={<Users size={16} />}
              titulo={t("Contratantes")}
              linhas={r2}
              metricas={[m(t("Valor"), "a", brl, true), m(t("Shows"), "b", num)]}
              vazioLabel={t("Sem dados no período.")}
            />
            <RankingCard
              icon={<Building2 size={16} />}
              titulo={t("Casas")}
              linhas={r3}
              metricas={[m(t("Shows"), "a", num), m(t("Valor"), "b", brl, true)]}
              vazioLabel={t("Sem dados no período.")}
            />
            <RankingCard
              icon={<MapPin size={16} />}
              titulo={t("Cidades")}
              linhas={r4}
              metricas={[m(t("Valor"), "a", brl, true), m(t("Shows"), "b", num)]}
              vazioLabel={t("Sem dados no período.")}
            />
            <RankingCard
              icon={<ShoppingBag size={16} />}
              titulo={t("Vendas por usuário")}
              linhas={r5}
              metricas={[
                m(t("Valor"), "a", brl, true),
                m(t("Nº de vendas"), "b", num),
              ]}
              vazioLabel={t("Sem dados no período.")}
            />
            <RankingCard
              icon={<FileText size={16} />}
              titulo={t("Orçamentos por usuário")}
              linhas={r6}
              metricas={[m(t("Valor"), "a", brl, true), m(t("Nº"), "b", num)]}
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

          {/* ── J5: popups dos 4 alertas (só admin, como a faixa) ── */}
          <AlertaDetalheModal
            isOpen={alertaAberto === "parcelas"}
            onClose={() => setAlertaAberto(null)}
            title={t("Parcelas atrasadas")}
            subtitle={t("Parcelas vencidas de vendas não canceladas.")}
            accentColor="var(--danger)"
            numeroLabel={t("Total atrasado")}
            numeroValor={fmtMoedaMapa(alertas.parcelasAtrasadasPorMoeda)}
            linhas={linhasParcelas}
            vazioLabel={t("Nenhuma parcela atrasada.")}
          />

          <AlertaDetalheModal
            isOpen={alertaAberto === "contratos"}
            onClose={() => setAlertaAberto(null)}
            title={t("Aguardando assinatura")}
            subtitle={t("Contratos enviados e ainda não assinados.")}
            accentColor="var(--warning)"
            numeroLabel={t("Contratos enviados")}
            numeroValor={alertas.contratosAguardando}
            linhas={linhasContratos}
            vazioLabel={t("Nenhum contrato aguardando assinatura.")}
          />

          <AlertaDetalheModal
            isOpen={alertaAberto === "orcamentos"}
            onClose={() => setAlertaAberto(null)}
            title={t("Orçamentos parados")}
            subtitle={t("Pendentes ou em negociação há 7 dias ou mais.")}
            accentColor="var(--warning)"
            numeroLabel={t("Orçamentos parados")}
            numeroValor={alertas.orcamentosParados}
            linhas={linhasOrcamentos}
            vazioLabel={t("Nenhum orçamento parado.")}
          />

          <AlertaDetalheModal
            isOpen={alertaAberto === "semContrato"}
            onClose={() => setAlertaAberto(null)}
            title={t("Shows sem contrato")}
            subtitle={t("Vendas não canceladas sem contrato ativo.")}
            accentColor="var(--danger)"
            numeroLabel={t("Vendas sem contrato")}
            numeroValor={alertas.showsSemContrato}
            linhas={linhasSemContrato}
            vazioLabel={
              mostrarDispensadas
                ? t("Nenhuma venda sem contrato.")
                : t("Nenhuma venda sem contrato (fora as dispensadas).")
            }
            erro={erroDispensa}
            topo={
              totalDispensadas > 0 ? (
                <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mostrarDispensadas}
                    onChange={(e) => setMostrarDispensadas(e.target.checked)}
                  />
                  {t("Mostrar dispensadas ({n}) para desfazer", {
                    n: totalDispensadas,
                  })}
                </label>
              ) : undefined
            }
          />
        </>
      )}

      {/* ── J6: resumos dos 4 StatCards do topo (todos os papéis) ── */}
      <ResumoModal
        isOpen={statAberto === "artistas"}
        onClose={() => setStatAberto(null)}
        title={t("Artistas")}
        subtitle={t("Todos os artistas da agência.")}
        accentColor="var(--success)"
      >
        <ResumoNumero
          valor={contagem.artistas}
          label={t("Total de artistas")}
          accentColor="var(--success)"
        />
        {itensArtistas.length > 0 && (
          <ResumoLista itens={itensArtistas} maxItens={100} />
        )}
        <ResumoFooter
          label={t("Ver mais detalhes")}
          onClick={() => irPara(`${BASE}/agencia/artistas`)}
        />
      </ResumoModal>

      <ResumoModal
        isOpen={statAberto === "equipe"}
        onClose={() => setStatAberto(null)}
        title={t("Equipe")}
        subtitle={t("Todos os membros da equipe.")}
        accentColor="var(--brand)"
      >
        <ResumoNumero
          valor={contagem.equipe}
          label={t("Total da equipe")}
          accentColor="var(--brand)"
        />
        {itensEquipe.length > 0 && (
          <ResumoLista itens={itensEquipe} maxItens={100} />
        )}
        <ResumoFooter
          label={t("Ver mais detalhes")}
          onClick={() => irPara(`${BASE}/agencia/equipe`)}
        />
      </ResumoModal>

      <ResumoModal
        isOpen={statAberto === "suspensos"}
        onClose={() => setStatAberto(null)}
        title={t("Suspensos")}
        subtitle={t("Artistas com acesso suspenso")}
        accentColor="var(--warning)"
      >
        <ResumoNumero
          valor={contagem.suspensos}
          label={t("Artistas com acesso suspenso")}
          accentColor="var(--warning)"
        />
        {itensSuspensos.length > 0 ? (
          <ResumoLista itens={itensSuspensos} maxItens={100} />
        ) : (
          <div className="text-sm text-muted text-center py-4">
            {t("Nenhum artista suspenso.")}
          </div>
        )}
        <ResumoFooter
          label={t("Ver mais detalhes")}
          onClick={() => irPara(`${BASE}/agencia/artistas`)}
        />
      </ResumoModal>

      <ResumoModal
        isOpen={statAberto === "bloqueados"}
        onClose={() => setStatAberto(null)}
        title={t("Bloqueados")}
        subtitle={t("Membros da equipe bloqueados")}
        accentColor="var(--danger)"
      >
        <ResumoNumero
          valor={contagem.bloqueados}
          label={t("Membros da equipe bloqueados")}
          accentColor="var(--danger)"
        />
        {itensBloqueados.length > 0 ? (
          <ResumoLista itens={itensBloqueados} maxItens={100} />
        ) : (
          <div className="text-sm text-muted text-center py-4">
            {t("Nenhum membro bloqueado.")}
          </div>
        )}
        <ResumoFooter
          label={t("Ver mais detalhes")}
          onClick={() => irPara(`${BASE}/agencia/equipe`)}
        />
      </ResumoModal>
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
