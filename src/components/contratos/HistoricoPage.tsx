"use client";

import { useMemo, useRef, useState } from "react";
import {
  FileText,
  Download,
  Trash2,
  Loader2,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import PageHeader from "../PageHeader";
import { FolhaA4, gerarPdfFolha } from "./folhaA4";
import PainelAssinatura from "./PainelAssinatura";
import { useContratos } from "@/lib/contratos-context";
import { useModelos } from "@/lib/modelos-context";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import type { Contrato, ContratoStatus } from "@/lib/mappers/contrato";
import { descreverContrato } from "@/lib/contratoTitulo";
import { useT } from "@/lib/i18n";
import { MODULE_THEMES } from "@/types";

const ACCENT = MODULE_THEMES.contratos.color;

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
  const { podeUI } = useAuth();

  // artistId de um contrato vem da venda vinculada (contrato.vendaId → venda.djId).
  const artistaDoContrato = (c: Contrato): string | null => {
    const v = vendas.find((venda) => venda.id === c.vendaId);
    return v?.djId || null;
  };
  const podeExcluir = (c: Contrato) => podeUI(artistaDoContrato(c), "contratos.excluir");
  const podeEditar = (c: Contrato) =>
    podeUI(artistaDoContrato(c), "contratos.editar") ||
    podeUI(artistaDoContrato(c), "contratos.editar_todos");

  const [selecionadoId, setSelecionadoId] = useState<string | null>(abrirId);
  const [filtro, setFiltro] = useState<ContratoStatus | "todos">(
    statusInicial ?? "todos"
  );
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [salvandoStatus, setSalvandoStatus] = useState(false);

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
      [...contratos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
    [contratos]
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
    if (!conteudoRef.current) return;
    setGerandoPdf(true);
    try {
      await gerarPdfFolha(
        conteudoRef.current,
        contrato.conteudo.estilo,
        contrato.numero
      );
    } catch (e) {
      window.alert((e as Error).message || t("Não foi possível gerar o PDF."));
    } finally {
      setGerandoPdf(false);
    }
  }

  async function mudarStatus(contrato: Contrato, status: ContratoStatus) {
    if (status === contrato.status || salvandoStatus) return;
    setSalvandoStatus(true);
    try {
      await atualizarContrato(contrato.id, { status });
    } catch (e) {
      window.alert((e as Error).message || t("Não foi possível alterar o status."));
    } finally {
      setSalvandoStatus(false);
    }
  }

  async function excluir(contrato: Contrato) {
    if (
      !window.confirm(
        t("Excluir o contrato {numero}? Esta ação não pode ser desfeita.", { numero: contrato.numero })
      )
    ) {
      return;
    }
    try {
      await removerContrato(contrato.id);
      // Se estava aberto no detalhe, volta pra lista.
      setSelecionadoId((atual) => (atual === contrato.id ? null : atual));
    } catch (e) {
      window.alert((e as Error).message || t("Não foi possível excluir o contrato."));
    }
  }

  // ---- Render: estados base ----

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader title="Contratos" subtitle="Histórico" accentColor={ACCENT} />

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
          onVoltar={() => setSelecionadoId(null)}
          onBaixarPdf={() => baixarPdf(selecionado)}
          onMudarStatus={(s) => mudarStatus(selecionado, s)}
          onExcluir={() => excluir(selecionado)}
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExcluir(c);
                    }}
                    disabled={!podeExcluir(c)}
                    title={
                      !podeExcluir(c)
                        ? t("Você não tem permissão para isso.")
                        : t("Excluir contrato")
                    }
                    aria-label={t("Excluir contrato")}
                    className="btn-ghost p-2 rounded hover:text-danger disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={15} />
                  </button>
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
  onVoltar,
  onBaixarPdf,
  onMudarStatus,
  onExcluir,
}: {
  contrato: Contrato;
  folhaRef: React.Ref<HTMLDivElement>;
  conteudoRef: React.Ref<HTMLDivElement>;
  gerandoPdf: boolean;
  salvandoStatus: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
  onVoltar: () => void;
  onBaixarPdf: () => void;
  onMudarStatus: (status: ContratoStatus) => void;
  onExcluir: () => void;
}) {
  const t = useT();
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

          <button
            type="button"
            onClick={onExcluir}
            disabled={!podeExcluir}
            title={!podeExcluir ? t("Você não tem permissão para isso.") : undefined}
            className="btn btn-secondary hover:text-danger disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={15} />
            {t("Excluir")}
          </button>
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
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onMudarStatus(s)}
                  disabled={salvandoStatus || !podeEditar}
                  title={!podeEditar ? t("Você não tem permissão para isso.") : undefined}
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

      {/* Preview da folha A4 */}
      <FolhaA4
        secoes={contrato.conteudo.secoes}
        estilo={contrato.conteudo.estilo}
        folhaRef={folhaRef}
        conteudoRef={conteudoRef}
      />
    </div>
  );
}
