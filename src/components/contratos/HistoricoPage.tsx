"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  Download,
  Trash2,
  Ban,
  Loader2,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import PageHeader from "../PageHeader";
import DateRangeSelector from "../DateRangeSelector";
import { FolhaA4, gerarPdfFolha, type AssinaturaInfo } from "./folhaA4";
import PainelAssinatura from "./PainelAssinatura";
import TabelaDados, { type Coluna } from "../lista/TabelaDados";
import Vinculos from "../detalhes/Vinculos";
import { FichaHeroPagina } from "../detalhes/FichaUI";
import {
  buscarSignatarios,
  paraAssinaturaInfo,
  urlPdfAssinado,
} from "@/lib/contratos/signatarios-api";
import { useContratos } from "@/lib/contratos-context";
import { useModelos } from "@/lib/modelos-context";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas, useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { temPdfLayout, type Contrato, type ContratoStatus } from "@/lib/mappers/contrato";
import { descreverContrato } from "@/lib/contratoTitulo";
import { useT } from "@/lib/i18n";
import { useConfirmar, useAviso } from "../ConfirmarModal";
import { MODULE_THEMES } from "@/types";
import type { AgendaDateRange } from "@/types";
import { STATUS_CONTRATO } from "@/lib/statusUI";
import { useFiltroArtistas } from "../FiltroArtistas";

const ACCENT = MODULE_THEMES.contratos.color;

const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ATALHOS_CTR: AgendaDateRange[] = ["Visão geral", "Mês anterior", "Mês atual", "Próximo mês", "Personalizado"];

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

/** Status na ordem em que aparecem no pill-group de troca de status. */
const STATUS_ORDEM: ContratoStatus[] = [
  "rascunho",
  "enviado",
  "assinado",
  "cancelado",
];

/** Nome e classe do badge por status — fonte única em lib/statusUI. */
const STATUS_LABEL = Object.fromEntries(
  Object.entries(STATUS_CONTRATO).map(([k, v]) => [k, v.label])
) as Record<ContratoStatus, string>;
const STATUS_BADGE = Object.fromEntries(
  Object.entries(STATUS_CONTRATO).map(([k, v]) => [k, v.badge])
) as Record<ContratoStatus, string>;

/** ISO/YYYY-MM-DD → DD/MM/AAAA (só a parte da data). "—" se vazio/ inválido. */
function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export default function HistoricoPage({
  contratoId = null,
  statusInicial = null,
  focarAssinatura = false,
  onAbrirContrato,
  onVoltar,
}: {
  /** Contrato aberto — vem do ENDEREÇO (/app/contratos/historico/<id>). */
  contratoId?: string | null;
  /** Filtro de status inicial (?status=, vindo de um card da dashboard). */
  statusInicial?: ContratoStatus | null;
  /** Abre rolado até o painel de assinatura (?assinar=1, vindo do "Mandar para assinatura"). */
  focarAssinatura?: boolean;
  onAbrirContrato: (id: string) => void;
  /** Sai do contrato aberto (volta pra onde a pessoa estava). */
  onVoltar: () => void;
}) {
  const t = useT();
  const { contratos, carregando, carregado, erro, atualizarContrato, removerContrato } =
    useContratos();
  const { modelos } = useModelos();
  const { vendas } = useVendas();
  const artistas = useArtistas();
  const { podeUI, isSuperAdmin, sessao } = useAuth();
  const { confirmar, confirmador } = useConfirmar();
  const { avisar, avisador } = useAviso();

  // artistId de um contrato vem da venda vinculada (contrato.vendaId → venda.artistaId).
  const artistaDoContrato = (c: Contrato): string | null => {
    const v = vendas.find((venda) => venda.id === c.vendaId);
    return v?.artistaId || null;
  };
  // Excluir contrato é ADMIN-ONLY (D4): saiu do catálogo delegável e do pacote
  // do artista — checa o papel direto (não uma chave).
  const ehAdmin = isSuperAdmin || sessao?.usuario.papel === "admin";
  const podeExcluir = (_c: Contrato) => ehAdmin;
  // Editar contrato = quem PODE CRIAR contrato edita (espelha podeEditarContrato
  // no servidor: chave contratos.criar, sem eixo de autoria).
  const podeEditar = (c: Contrato) => podeUI(artistaDoContrato(c), "contratos.criar");
  // Cancelar contrato distingue autoria no servidor (cancelar_proprios/_outros).
  // Sem o criado_por do contrato aqui, o espelho mostra o botão se pode cancelar
  // EM QUALQUER caso — o servidor barra o caso específico (nunca esconde a mais).
  const podeCancelar = (c: Contrato) =>
    podeUI(artistaDoContrato(c), "contratos.cancelar_proprios") ||
    podeUI(artistaDoContrato(c), "contratos.cancelar_outros");

  const [filtro, setFiltro] = useState<ContratoStatus | "todos">(
    statusInicial ?? "todos"
  );
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const { workspaceCriadoEm } = useWorkspace();
  const [range, setRange] = useState<AgendaDateRange>("Visão geral");
  const [customMonth, setCustomMonth] = useState<string | null>(null);
  const [customYear, setCustomYear] = useState<number | null>(null);
  const periodo = useMemo(
    () => resolverMes(range, customMonth, customYear),
    [range, customMonth, customYear]
  );
  const tituloPeriodo = periodo.tudo ? t("Visão geral") : `${MESES_LONGO[periodo.mes]} ${periodo.ano}`;

  const folhaRef = useRef<HTMLDivElement>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);

  // modeloId → nome (pra coluna "modelo").
  const nomePorModelo = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const m of modelos) mapa.set(m.id, m.nome);
    return mapa;
  }, [modelos]);

  function nomeModelo(contrato: Contrato): string {
    if (!contrato.modeloId) return "—";
    return nomePorModelo.get(contrato.modeloId) ?? "—";
  }

  // Filtro "Artistas" da barra lateral (lib/filtroArtistas) — vale pra LISTA;
  // o contrato aberto por endereço abre sempre (link de outro artista).
  const filtroArt = useFiltroArtistas();

  // Ordena por criadoEm desc (mais recente primeiro).
  const ordenados = useMemo(
    () =>
      contratos
        .filter((c) => dataNoMes(c.criadoEm, periodo))
        .filter((c) => filtroArt.passa(artistaDoContrato(c)))
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contratos, periodo, vendas, filtroArt.ativo, filtroArt.selecionados]
  );

  // Contagem por status (pros chips do filtro) e a lista já filtrada.
  const contagem = useMemo(() => {
    const c: Record<ContratoStatus, number> = {
      rascunho: 0,
      enviado: 0,
      assinado: 0,
      cancelado: 0,
    };
    for (const ct of ordenados) c[ct.status] += 1;
    return c;
  }, [ordenados]);

  const filtrados = useMemo(
    () =>
      filtro === "todos"
        ? ordenados
        : ordenados.filter((c) => c.status === filtro),
    [ordenados, filtro]
  );

  // Procura em TODOS (não só no período da lista): um link pro contrato de
  // outro mês tem que abrir mesmo com o filtro de período em "Mês atual".
  const selecionado = useMemo(
    () => (contratoId ? contratos.find((c) => c.id === contratoId) ?? null : null),
    [contratos, contratoId]
  );

  // ---- Ações ----

  async function baixarPdf(contrato: Contrato) {
    // Contrato POR UPLOAD (sem seções): a folha A4 sairia vazia — o PDF vem da
    // rota que carimba as assinaturas e anexa o relatório sobre o PDF-fonte.
    if (temPdfLayout(contrato.conteudo)) {
      window.open(urlPdfAssinado(contrato.id), "_blank", "noopener,noreferrer");
      return;
    }
    if (!conteudoRef.current) return;
    setGerandoPdf(true);
    try {
      await gerarPdfFolha(
        conteudoRef.current,
        contrato.conteudo.estilo,
        contrato.numero
      );
    } catch (e) {
      avisar((e as Error).message || t("Não foi possível gerar o PDF."));
    } finally {
      setGerandoPdf(false);
    }
  }

  async function mudarStatus(contrato: Contrato, status: ContratoStatus) {
    if (status === contrato.status || salvandoStatus) return;
    // Cancelar tem confirmação própria + gate de contratos.cancelar: o pill
    // "Cancelado" reusa o mesmo fluxo do botão "Cancelar contrato".
    if (status === "cancelado") {
      await cancelar(contrato);
      return;
    }
    setSalvandoStatus(true);
    try {
      await atualizarContrato(contrato.id, { status });
    } catch (e) {
      avisar((e as Error).message || t("Não foi possível alterar o status."));
    } finally {
      setSalvandoStatus(false);
    }
  }

  async function excluir(contrato: Contrato) {
    if (
      !(await confirmar({
        titulo: t("Excluir o contrato {numero}?", { numero: contrato.numero }),
        mensagem: t("Esta ação não pode ser desfeita."),
        perigo: true,
      }))
    ) {
      return;
    }
    try {
      await removerContrato(contrato.id);
      // Se estava aberto no detalhe, sai dele.
      if (contratoId === contrato.id) onVoltar();
    } catch (e) {
      avisar((e as Error).message || t("Não foi possível excluir o contrato."));
    }
  }

  async function cancelar(contrato: Contrato) {
    if (contrato.status === "cancelado" || salvandoStatus) return;
    if (
      !(await confirmar({
        titulo: t("Cancelar o contrato {numero}?", { numero: contrato.numero }),
        mensagem: t(
          "Ele fica marcado como cancelado e o link de assinatura para de funcionar para quem ainda não assinou. O contrato continua visível no histórico."
        ),
        perigo: true,
      }))
    ) {
      return;
    }
    setSalvandoStatus(true);
    try {
      await atualizarContrato(contrato.id, { status: "cancelado" });
    } catch (e) {
      avisar((e as Error).message || t("Não foi possível cancelar o contrato."));
    } finally {
      setSalvandoStatus(false);
    }
  }

  // Colunas da lista padrão — as mesmas de antes, agora ordenáveis.
  const colunasContratos = useMemo<Coluna<Contrato>[]>(
    () => [
      {
        chave: "contrato",
        titulo: "Contrato",
        classe: "font-medium",
        ordenarPor: (c) => descreverContrato(c, vendas, artistas).titulo,
        celula: (c) => {
          const d = descreverContrato(c, vendas, artistas);
          return (
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={15} className="flex-shrink-0" style={{ color: ACCENT }} />
              <div className="min-w-0">
                <div className="text-primary truncate max-w-[260px]" title={d.titulo}>
                  {d.titulo}
                </div>
                <div className="text-xs text-muted font-normal truncate">
                  {[d.artista, d.temEvento ? d.numero : null].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        chave: "status",
        titulo: "Status",
        ordenarPor: (c) => t(STATUS_LABEL[c.status]),
        celula: (c) => <span className={`badge ${STATUS_BADGE[c.status]}`}>{t(STATUS_LABEL[c.status])}</span>,
      },
      {
        chave: "emissao",
        titulo: "Emissão",
        classe: "whitespace-nowrap text-secondary",
        decrescentePrimeiro: true,
        ordenarPor: (c) => c.dataEmissao,
        celula: (c) => formatarData(c.dataEmissao),
      },
      {
        chave: "modelo",
        titulo: "Modelo",
        classe: "text-secondary max-w-[220px] truncate",
        ordenarPor: (c) => nomeModelo(c),
        celula: (c) => nomeModelo(c),
      },
      {
        chave: "secoes",
        titulo: "Seções",
        alinhar: "direita",
        classe: "tabular-nums text-secondary",
        noCelular: false,
        ordenarPor: (c) => c.conteudo.secoes.length,
        celula: (c) => c.conteudo.secoes.length,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendas, artistas, nomePorModelo, t]
  );

  // ---- Render: estados base ----

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Todos os contratos"
        subtitle={tituloPeriodo}
        accentColor={ACCENT}
        actions={
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
        }
      />

      {carregando || (contratoId && !carregado) ? (
        <div className="card flex items-center justify-center gap-2 py-12 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" />
          {t("Carregando contratos...")}
        </div>
      ) : erro ? (
        <div
          className="card flex items-center gap-2 py-6 text-sm"
          style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
        >
          <AlertCircle size={16} className="flex-shrink-0" />
          {erro}
        </div>
      ) : contratoId && !selecionado ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <div className="section-title">{t("Contrato não encontrado")}</div>
          <button type="button" onClick={onVoltar} className="btn btn-secondary">
            <ArrowLeft size={15} />
            {t("Voltar")}
          </button>
        </div>
      ) : selecionado ? (
        <DetalheContrato
          contrato={selecionado}
          descricao={descreverContrato(selecionado, vendas, artistas)}
          artista={(() => {
            const id = artistaDoContrato(selecionado);
            return id ? artistas.find((a) => a.id === id) ?? null : null;
          })()}
          focarAssinatura={focarAssinatura}
          folhaRef={folhaRef}
          conteudoRef={conteudoRef}
          gerandoPdf={gerandoPdf}
          salvandoStatus={salvandoStatus}
          podeEditar={podeEditar(selecionado)}
          podeExcluir={podeExcluir(selecionado)}
          podeCancelar={podeCancelar(selecionado)}
          onVoltar={onVoltar}
          onBaixarPdf={() => baixarPdf(selecionado)}
          onMudarStatus={(s) => mudarStatus(selecionado, s)}
          onExcluir={() => excluir(selecionado)}
          onCancelar={() => cancelar(selecionado)}
        />
      ) : ordenados.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center mb-3">
            <FileText size={18} className="text-muted" />
          </div>
          <div className="section-title mb-1">{t("Nenhum contrato gerado ainda")}</div>
          <div className="section-subtitle">
            {t("Crie um em")}{" "}<span className="font-medium">{t("Novo Contrato")}</span>.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <FiltroStatus
            valor={filtro}
            onChange={setFiltro}
            contagem={contagem}
            total={ordenados.length}
          />
          {filtrados.length === 0 ? (
            <div className="card py-10 text-center text-sm text-muted">
              {t("Nenhum contrato com esse status.")}
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <TabelaDados
                itens={filtrados}
                colunas={colunasContratos}
                chaveDe={(c) => c.id}
                onAbrir={(c) => onAbrirContrato(c.id)}
                rotuloItens="contratos"
                acoes={(c) =>
                  // Excluir é ADMIN-ONLY (D4): escondido pra não-admin.
                  podeExcluir(c) ? (
                    <button
                      type="button"
                      onClick={() => excluir(c)}
                      title={t("Excluir contrato")}
                      aria-label={t("Excluir contrato")}
                      className="btn-ghost p-2 rounded hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null
                }
              />
            </div>
          )}
        </div>
      )}
      {confirmador}
      {avisador}
    </div>
  );
}

// ---------------- Filtro por status ----------------

/** Chips de filtro: Todos + um por status, cada um com a contagem. */
function FiltroStatus({
  valor,
  onChange,
  contagem,
  total,
}: {
  valor: ContratoStatus | "todos";
  onChange: (v: ContratoStatus | "todos") => void;
  contagem: Record<ContratoStatus, number>;
  total: number;
}) {
  const t = useT();
  const chips: { key: ContratoStatus | "todos"; label: string; n: number }[] = [
    { key: "todos", label: t("Todos"), n: total },
    ...STATUS_ORDEM.map((s) => ({ key: s, label: t(STATUS_LABEL[s]), n: contagem[s] })),
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => {
        const ativo = valor === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors"
            style={
              ativo
                ? {
                    backgroundColor: `color-mix(in srgb, ${ACCENT} 15%, transparent)`,
                    borderColor: ACCENT,
                    color: ACCENT,
                  }
                : { borderColor: "var(--border-color)", color: "var(--text-secondary)" }
            }
          >
            {c.label}
            <span className="text-xs opacity-70 tabular-nums">{c.n}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------- Detalhe (preview + ações) ----------------

function DetalheContrato({
  contrato,
  descricao,
  artista,
  focarAssinatura,
  folhaRef,
  conteudoRef,
  gerandoPdf,
  salvandoStatus,
  podeEditar,
  podeExcluir,
  podeCancelar,
  onVoltar,
  onBaixarPdf,
  onMudarStatus,
  onExcluir,
  onCancelar,
}: {
  contrato: Contrato;
  descricao: ReturnType<typeof descreverContrato>;
  artista: { name: string; color?: string } | null;
  focarAssinatura: boolean;
  folhaRef: React.Ref<HTMLDivElement>;
  conteudoRef: React.Ref<HTMLDivElement>;
  gerandoPdf: boolean;
  salvandoStatus: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
  podeCancelar: boolean;
  onVoltar: () => void;
  onBaixarPdf: () => void;
  onMudarStatus: (status: ContratoStatus) => void;
  onExcluir: () => void;
  onCancelar: () => void;
}) {
  const t = useT();
  const jaCancelado = contrato.status === "cancelado";

  // Assinaturas do contrato → o preview e o "Baixar PDF" mostram o relatório
  // (mesmos dados/mapa que o PainelAssinatura, pra gerar o MESMO PDF).
  const [assinaturas, setAssinaturas] = useState<AssinaturaInfo[]>([]);
  useEffect(() => {
    let vivo = true;
    buscarSignatarios(contrato.id)
      .then((lista) => {
        if (!vivo) return;
        setAssinaturas(
          lista.filter((s) => s.status === "assinado").map(paraAssinaturaInfo)
        );
      })
      .catch(() => {
        /* silencioso — sem relatório é o comportamento antigo */
      });
    return () => {
      vivo = false;
    };
  }, [contrato.id]);

  // Veio do "Mandar para assinatura" (Novo contrato): já mostra o painel.
  const painelAssinaturaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focarAssinatura) return;
    const id = setTimeout(
      () => painelAssinaturaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      150
    );
    return () => clearTimeout(id);
  }, [focarAssinatura, contrato.id]);

  return (
    <div className="flex flex-col gap-5">
      {/* Topo de FICHA padrão (igual venda/orçamento): artista, evento, número,
          status e ações; a troca de status e as ações destrutivas no rodapé. */}
      <div>
        <button
          type="button"
          onClick={onVoltar}
          className="btn-ghost mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft size={14} />
          {t("Voltar")}
        </button>
        <FichaHeroPagina
          artistaNome={artista?.name ?? t("Contrato avulso")}
          artistaCor={artista?.color}
          linhaSuperior={
            <>
              {t("Emissão")} {formatarData(contrato.dataEmissao)}
              {contrato.dataAssinatura
                ? ` · ${t("Assinatura")} ${formatarData(contrato.dataAssinatura)}`
                : ""}
            </>
          }
          titulo={
            <>
              {descricao.temEvento ? descricao.titulo : t("Contrato")}
              <span className="text-secondary font-normal">
                {" "}· {descricao.temEvento ? `${t("Contrato")} ` : ""}
                <span className="font-mono tabular-nums" style={{ color: ACCENT }}>
                  {contrato.numero}
                </span>
              </span>
            </>
          }
          badges={
            <span className={`badge ${STATUS_BADGE[contrato.status]}`}>
              {t(STATUS_LABEL[contrato.status])}
            </span>
          }
          acoes={
            <button
              type="button"
              onClick={onBaixarPdf}
              disabled={gerandoPdf}
              className="btn btn-primary"
            >
              {gerandoPdf ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {t("Gerando…")}
                </>
              ) : (
                <>
                  <Download size={15} />
                  {t("Baixar PDF")}
                </>
              )}
            </button>
          }
          rodape={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="stat-label">{t("Status")}</span>
                <div
                  className="inline-flex rounded-md p-0.5 gap-0.5"
                  style={{ backgroundColor: "var(--bg-elevated)" }}
                >
                  {STATUS_ORDEM.map((s) => {
                    const ativo = s === contrato.status;
                    // A transição → "cancelado" usa contratos.cancelar (permissão
                    // própria, D4); as demais mudanças de status usam contratos.editar.
                    const virarCancelado = s === "cancelado" && !jaCancelado;
                    const permitido = virarCancelado ? podeCancelar : podeEditar;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onMudarStatus(s)}
                        disabled={salvandoStatus || !permitido}
                        title={!permitido ? t("Você não tem permissão para isso.") : undefined}
                        className={`badge ${
                          ativo ? STATUS_BADGE[s] : "text-muted"
                        } transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}
                        style={ativo ? { boxShadow: "0 0 0 1px var(--border-color)" } : undefined}
                      >
                        {t(STATUS_LABEL[s])}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {podeCancelar && !jaCancelado && (
                  <button
                    type="button"
                    onClick={onCancelar}
                    disabled={salvandoStatus}
                    className="btn btn-danger-outline px-3 py-1.5 text-xs"
                  >
                    <Ban size={13} />
                    {t("Cancelar contrato")}
                  </button>
                )}
                {/* Excluir é ADMIN-ONLY (D4): escondido pra não-admin. */}
                {podeExcluir && (
                  <button
                    type="button"
                    onClick={onExcluir}
                    className="btn btn-danger-outline px-3 py-1.5 text-xs"
                  >
                    <Trash2 size={13} />
                    {t("Excluir")}
                  </button>
                )}
              </div>
            </div>
          }
        />
      </div>

      {/* Venda, show, orçamento e contratante deste contrato — cada um abre. */}
      {contrato.vendaId && (
        <Vinculos
          vendaId={contrato.vendaId}
          ocultar={["contrato"]}
          titulo={t("Ligado a este contrato")}
        />
      )}

      {/* Painel de assinatura — signatários, links/WhatsApp, PDF assinado */}
      <div ref={painelAssinaturaRef} className="scroll-mt-4">
        <PainelAssinatura contrato={contrato} />
      </div>

      {/* Preview da folha A4 (com o relatório de assinaturas quando houver) */}
      <FolhaA4
        secoes={contrato.conteudo.secoes}
        estilo={contrato.conteudo.estilo}
        folhaRef={folhaRef}
        conteudoRef={conteudoRef}
        assinaturas={assinaturas}
        numeroContrato={contrato.numero}
      />
    </div>
  );
}
