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

const STATUS_LABEL: Record<ContratoStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  assinado: "Assinado",
  cancelado: "Cancelado",
};

/** Classe do badge por status (segue a paleta do globals.css). */
const STATUS_BADGE: Record<ContratoStatus, string> = {
  rascunho: "badge-neutral",
  enviado: "badge-info",
  assinado: "badge-success",
  cancelado: "badge-danger",
};

/** ISO/YYYY-MM-DD → DD/MM/AAAA (só a parte da data). "—" se vazio/ inválido. */
function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export default function HistoricoPage({
  abrirId = null,
  statusInicial = null,
}: {
  /** Abre este contrato já no detalhe ao montar (vindo da dashboard). */
  abrirId?: string | null;
  /** Filtro de status inicial (vindo de um card da dashboard). */
  statusInicial?: ContratoStatus | null;
} = {}) {
  const t = useT();
  const { contratos, carregando, erro, atualizarContrato, removerContrato } =
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

  const [selecionadoId, setSelecionadoId] = useState<string | null>(abrirId);
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

  // Ordena por criadoEm desc (mais recente primeiro).
  const ordenados = useMemo(
    () =>
      contratos
        .filter((c) => dataNoMes(c.criadoEm, periodo))
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
    [contratos, periodo]
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

  const selecionado = useMemo(
    () => ordenados.find((c) => c.id === selecionadoId) ?? null,
    [ordenados, selecionadoId]
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
      // Se estava aberto no detalhe, volta pra lista.
      setSelecionadoId((atual) => (atual === contrato.id ? null : atual));
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

  // ---- Render: estados base ----

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Contratos"
        subtitle={`${t("Histórico")} · ${tituloPeriodo}`}
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

      {carregando ? (
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
      ) : selecionado ? (
        <DetalheContrato
          contrato={selecionado}
          folhaRef={folhaRef}
          conteudoRef={conteudoRef}
          gerandoPdf={gerandoPdf}
          salvandoStatus={salvandoStatus}
          podeEditar={podeEditar(selecionado)}
          podeExcluir={podeExcluir(selecionado)}
          podeCancelar={podeCancelar(selecionado)}
          onVoltar={() => setSelecionadoId(null)}
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
            <ListaContratos
              contratos={filtrados}
              nomeModelo={nomeModelo}
              desc={(c) => descreverContrato(c, vendas, artistas)}
              podeExcluir={podeExcluir}
              onAbrir={(c) => setSelecionadoId(c.id)}
              onExcluir={excluir}
            />
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

// ---------------- Lista / tabela ----------------

function ListaContratos({
  contratos,
  nomeModelo,
  desc,
  podeExcluir,
  onAbrir,
  onExcluir,
}: {
  contratos: Contrato[];
  nomeModelo: (c: Contrato) => string;
  desc: (c: Contrato) => ReturnType<typeof descreverContrato>;
  podeExcluir: (c: Contrato) => boolean;
  onAbrir: (c: Contrato) => void;
  onExcluir: (c: Contrato) => void;
}) {
  const t = useT();
  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-muted">
              <th className="font-medium px-4 py-3">{t("Contrato")}</th>
              <th className="font-medium px-4 py-3">{t("Status")}</th>
              <th className="font-medium px-4 py-3">{t("Emissão")}</th>
              <th className="font-medium px-4 py-3">{t("Modelo")}</th>
              <th className="font-medium px-4 py-3 text-right">{t("Seções")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {contratos.map((c) => {
              const d = desc(c);
              return (
              <tr
                key={c.id}
                onClick={() => onAbrir(c)}
                className="cursor-pointer border-t transition-colors hover:bg-elevated"
                style={{ borderColor: "var(--border-color)" }}
              >
                <td className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText
                      size={15}
                      className="flex-shrink-0"
                      style={{ color: ACCENT }}
                    />
                    <div className="min-w-0">
                      <div className="text-primary truncate max-w-[260px]" title={d.titulo}>
                        {d.titulo}
                      </div>
                      <div className="text-xs text-muted font-normal truncate">
                        {[d.artista, d.temEvento ? d.numero : null].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${STATUS_BADGE[c.status]}`}>
                    {t(STATUS_LABEL[c.status])}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-secondary">
                  {formatarData(c.dataEmissao)}
                </td>
                <td className="px-4 py-3 text-secondary max-w-[220px] truncate">
                  {nomeModelo(c)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-secondary">
                  {c.conteudo.secoes.length}
                </td>
                <td className="px-4 py-3 text-right">
                  {/* Excluir é ADMIN-ONLY (D4): escondido pra não-admin. */}
                  {podeExcluir(c) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onExcluir(c);
                      }}
                      title={t("Excluir contrato")}
                      aria-label={t("Excluir contrato")}
                      className="btn-ghost p-2 rounded hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------- Detalhe (preview + ações) ----------------

function DetalheContrato({
  contrato,
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

  return (
    <div className="flex flex-col gap-5">
      {/* Barra de ações do detalhe */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onVoltar}
          className="btn btn-secondary"
        >
          <ArrowLeft size={15} />
          {t("Voltar")}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBaixarPdf}
            disabled={gerandoPdf}
            className="btn"
            style={{ backgroundColor: ACCENT, color: "#fff" }}
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

          {podeCancelar && !jaCancelado && (
            <button
              type="button"
              onClick={onCancelar}
              disabled={salvandoStatus}
              className="btn btn-secondary hover:text-danger disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Ban size={15} />
              {t("Cancelar contrato")}
            </button>
          )}

          {/* Excluir é ADMIN-ONLY (D4): escondido pra não-admin. */}
          {podeExcluir && (
            <button
              type="button"
              onClick={onExcluir}
              className="btn btn-secondary hover:text-danger"
            >
              <Trash2 size={15} />
              {t("Excluir")}
            </button>
          )}
        </div>
      </div>

      {/* Cabeçalho do contrato + troca de status */}
      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText size={16} style={{ color: ACCENT }} />
            <span className="section-title">{contrato.numero}</span>
          </div>
          <div className="section-subtitle mt-1">
            {t("Emissão")} {formatarData(contrato.dataEmissao)}
            {contrato.dataAssinatura
              ? ` · ${t("Assinatura")} ${formatarData(contrato.dataAssinatura)}`
              : ""}
          </div>
        </div>

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
                  style={
                    ativo
                      ? { boxShadow: "0 0 0 1px var(--border-color)" }
                      : undefined
                  }
                >
                  {t(STATUS_LABEL[s])}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Painel de assinatura — signatários, links/WhatsApp, PDF assinado */}
      <PainelAssinatura contrato={contrato} />

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
