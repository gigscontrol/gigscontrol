"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolverMes, dataNoMes } from "@/lib/periodo";
import {
  FileText,
  Download,
  Trash2,
  Ban,
  Loader2,
  ArrowLeft,
  AlertCircle,
  Send,
  PenLine,
  RotateCcw,
  Undo2,
} from "lucide-react";
import PageHeader from "../PageHeader";
import DateRangeSelector from "../DateRangeSelector";
import { FolhaA4, gerarPdfFolha, type AssinaturaInfo } from "./folhaA4";
import PainelAssinatura from "./PainelAssinatura";
import MarcarAssinadoModal from "./MarcarAssinadoModal";
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
import { urls } from "@/lib/navegacao/rotas";
import { formatarData as formatarDataLib } from "@/lib/formatters";
import { comportamentoRolagem } from "@/lib/movimento";
import { BarraLista, BuscaLista, FiltroPilulas } from "../lista/BarraLista";

const ACCENT = MODULE_THEMES.contratos.color;

const MESES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const ATALHOS_CTR: AgendaDateRange[] = ["Visão geral", "Mês anterior", "Mês atual", "Próximo mês", "Personalizado"];


/** Status na ordem em que aparecem nos filtros da lista. */
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

/** Só a parte da data, na ordem da preferência. "—" se vazio/ inválido. */
const formatarData = (iso: string | null) => formatarDataLib(iso?.slice(0, 10)) || "—";

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
  // Cabeçalho da ficha quando não há artista pra mostrar. "Avulso" só quando
  // não há venda; com venda cujo artista saiu da conta, diz isso.
  const rotuloSemArtista = (c: Contrato): string => {
    if (!c.vendaId) return t("Contrato avulso");
    const v = vendas.find((venda) => venda.id === c.vendaId);
    return v?.artistaId ? t("Artista removido") : t("Contrato");
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

  // Busca por número, título (evento/artista) e contratante — a lista de
  // contratos era a única sem busca.
  const [busca, setBusca] = useState("");
  const filtrados = useMemo(() => {
    const porStatus = filtro === "todos" ? ordenados : ordenados.filter((c) => c.status === filtro);
    const q = busca.trim().toLowerCase();
    if (!q) return porStatus;
    return porStatus.filter((c) => {
      const d = descreverContrato(c, vendas, artistas);
      const contratante = c.vendaId ? vendas.find((v) => v.id === c.vendaId)?.contratanteNome : null;
      return [c.numero, d.titulo, d.artista, contratante]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenados, filtro, busca, vendas, artistas]);

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

  /** Troca manual de status (as ações do rodapé da ficha). O caminho normal
   *  é o status andar sozinho pelas assinaturas; cancelar tem fluxo próprio. */
  async function mudarStatus(
    contrato: Contrato,
    status: ContratoStatus,
    motivo?: string
  ): Promise<boolean> {
    if (status === contrato.status || salvandoStatus) return false;
    setSalvandoStatus(true);
    try {
      await atualizarContrato(contrato.id, { status, motivoStatus: motivo });
      return true;
    } catch (e) {
      avisar((e as Error).message || t("Não foi possível alterar o status."));
      return false;
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
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendas, artistas, nomePorModelo, t]
  );

  // ---- Render: estados base ----

  return (
    <div className="pagina">
      {/* Com um contrato aberto, a ficha tem o próprio título: o cabeçalho da
          lista ficava em cima dela (dois h1) e o "Voltar" saía embaixo. */}
      {!contratoId && (
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
      )}

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
          <h2 className="section-title">{t("Contrato não encontrado")}</h2>
          <button type="button" onClick={onVoltar} className="btn btn-secondary">
            <ArrowLeft size={15} />
            {t("Voltar")}
          </button>
        </div>
      ) : selecionado ? (
        <DetalheContrato
          contrato={selecionado}
          descricao={descreverContrato(selecionado, vendas, artistas)}
          rotuloSemArtista={rotuloSemArtista(selecionado)}
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
          onMudarStatus={(s, motivo) => mudarStatus(selecionado, s, motivo)}
          onExcluir={() => excluir(selecionado)}
          onCancelar={() => cancelar(selecionado)}
        />
      ) : ordenados.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center mb-3">
            <FileText size={18} className="text-muted" />
          </div>
          <h2 className="section-title mb-1">{t("Nenhum contrato gerado ainda")}</h2>
          <div className="section-subtitle">
            {t("Crie um em")}{" "}<span className="font-medium">{t("Novo contrato")}</span>.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <BarraLista>
            <BuscaLista
              valor={busca}
              onMudar={setBusca}
              rotulo={t("Buscar contratos")}
              placeholder={t("Buscar por número, evento, artista, contratante...")}
            />
            <FiltroPilulas
              opcoes={[
                { valor: "todos" as const, rotulo: t("Todos"), n: ordenados.length },
                ...STATUS_ORDEM.map((s) => ({ valor: s, rotulo: t(STATUS_LABEL[s]), n: contagem[s] })),
              ]}
              valor={filtro}
              onMudar={setFiltro}
            />
          </BarraLista>
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
                hrefDe={(c) => urls.contrato(c.id)}
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


// ---------------- Detalhe (preview + ações) ----------------

function DetalheContrato({
  contrato,
  descricao,
  rotuloSemArtista,
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
  rotuloSemArtista: string;
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
  onMudarStatus: (status: ContratoStatus, motivo?: string) => Promise<boolean>;
  onExcluir: () => void;
  onCancelar: () => void;
}) {
  const t = useT();
  const jaCancelado = contrato.status === "cancelado";

  // Assinaturas do contrato → o preview e o "Baixar PDF" mostram o relatório
  // (mesmos dados/mapa que o PainelAssinatura, pra gerar o MESMO PDF). O total
  // de signatários alimenta o resumo do status. Relê quando o status muda
  // (mandar pra assinatura e cada assinatura mexem nele).
  const [assinaturas, setAssinaturas] = useState<AssinaturaInfo[]>([]);
  // null = ainda carregando (guardado por id pra não valer de outro contrato).
  const [sigs, setSigs] = useState<{ id: string; total: number } | null>(null);
  const totalSignatarios = sigs?.id === contrato.id ? sigs.total : null;
  useEffect(() => {
    let vivo = true;
    buscarSignatarios(contrato.id)
      .then((lista) => {
        if (!vivo) return;
        setAssinaturas(
          lista.filter((s) => s.status === "assinado").map(paraAssinaturaInfo)
        );
        setSigs({ id: contrato.id, total: lista.length });
      })
      .catch(() => {
        /* silencioso — sem relatório é o comportamento antigo */
      });
    return () => {
      vivo = false;
    };
  }, [contrato.id, contrato.status]);

  // O status vem das assinaturas; à mão só o que a assinatura eletrônica não
  // cobre (enviado/assinado fora do sistema), sempre com volta.
  const finalizado = !!contrato.finalizadoEm;
  const assinadoFora = contrato.status === "assinado" && !finalizado;
  // Pra onde volta quem desfaz o "assinado" manual ou reativa um cancelado.
  const statusSemMarcacao: ContratoStatus = (totalSignatarios ?? 0) > 0 ? "enviado" : "rascunho";
  const resumoStatus =
    contrato.status === "cancelado"
      ? t("Cancelado. O link de assinatura não funciona mais.")
      : finalizado
      ? t("Todas as assinaturas concluídas.")
      : assinadoFora
      ? t("Marcado como assinado fora do sistema.")
      : totalSignatarios === null
      ? t("Conferindo as assinaturas…")
      : totalSignatarios > 0
      ? t("{a} de {n} assinaturas.", { a: assinaturas.length, n: totalSignatarios })
      : contrato.status === "enviado"
      ? t("Enviado fora do sistema, sem assinatura eletrônica.")
      : t("Ainda não foi mandado para assinatura.");
  const [marcandoAssinado, setMarcandoAssinado] = useState(false);

  // Veio do "Mandar para assinatura" (Novo contrato): já mostra o painel.
  const painelAssinaturaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focarAssinatura) return;
    const id = setTimeout(
      () => painelAssinaturaRef.current?.scrollIntoView({ behavior: comportamentoRolagem(), block: "start" }),
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
          artistaNome={artista?.name ?? rotuloSemArtista}
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
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="stat-label">{t("Status")}</span>
                <span className="text-sm text-secondary">{resumoStatus}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {podeEditar && contrato.status === "rascunho" && (
                  <button
                    type="button"
                    onClick={() => onMudarStatus("enviado")}
                    disabled={salvandoStatus}
                    className="btn btn-secondary px-3 py-1.5 text-xs"
                  >
                    <Send size={13} />
                    {t("Marcar como enviado")}
                  </button>
                )}
                {podeEditar && (contrato.status === "rascunho" || contrato.status === "enviado") && (
                  <button
                    type="button"
                    onClick={() => setMarcandoAssinado(true)}
                    disabled={salvandoStatus}
                    className="btn btn-secondary px-3 py-1.5 text-xs"
                  >
                    <PenLine size={13} />
                    {t("Marcar como assinado")}
                  </button>
                )}
                {podeEditar && assinadoFora && (
                  <button
                    type="button"
                    onClick={() => onMudarStatus(statusSemMarcacao)}
                    disabled={salvandoStatus || totalSignatarios === null}
                    className="btn btn-secondary px-3 py-1.5 text-xs"
                  >
                    <Undo2 size={13} />
                    {t("Desmarcar assinado")}
                  </button>
                )}
                {podeEditar && jaCancelado && (
                  <button
                    type="button"
                    onClick={() => onMudarStatus(finalizado ? "assinado" : statusSemMarcacao)}
                    disabled={salvandoStatus || (!finalizado && totalSignatarios === null)}
                    className="btn btn-secondary px-3 py-1.5 text-xs"
                  >
                    <RotateCcw size={13} />
                    {t("Reativar contrato")}
                  </button>
                )}
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

      <MarcarAssinadoModal
        aberto={marcandoAssinado}
        numero={contrato.numero}
        salvando={salvandoStatus}
        onCancelar={() => setMarcandoAssinado(false)}
        onConfirmar={async (motivo) => {
          if (await onMudarStatus("assinado", motivo)) setMarcandoAssinado(false);
        }}
      />

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
