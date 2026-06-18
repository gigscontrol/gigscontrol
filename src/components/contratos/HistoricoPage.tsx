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
import type { Contrato, ContratoStatus } from "@/lib/mappers/contrato";

const ACCENT = "var(--module-contratos)";

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

export default function HistoricoPage() {
  const { contratos, carregando, erro, atualizarContrato, removerContrato } =
    useContratos();
  const { modelos } = useModelos();

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
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
      window.alert((e as Error).message || "Não foi possível gerar o PDF.");
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
      window.alert((e as Error).message || "Não foi possível alterar o status.");
    } finally {
      setSalvandoStatus(false);
    }
  }

  async function excluir(contrato: Contrato) {
    if (
      !window.confirm(
        `Excluir o contrato ${contrato.numero}? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    try {
      await removerContrato(contrato.id);
      // Se estava aberto no detalhe, volta pra lista.
      setSelecionadoId((atual) => (atual === contrato.id ? null : atual));
    } catch (e) {
      window.alert((e as Error).message || "Não foi possível excluir o contrato.");
    }
  }

  // ---- Render: estados base ----

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader title="Contratos" subtitle="Histórico" accentColor={ACCENT} />

      {carregando ? (
        <div className="card flex items-center justify-center gap-2 py-12 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" />
          Carregando contratos...
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
          <div className="section-title mb-1">Nenhum contrato gerado ainda</div>
          <div className="section-subtitle">
            Crie um em <span className="font-medium">Novo Contrato</span>.
          </div>
        </div>
      ) : (
        <ListaContratos
          contratos={ordenados}
          nomeModelo={nomeModelo}
          onAbrir={(c) => setSelecionadoId(c.id)}
          onExcluir={excluir}
        />
      )}
    </div>
  );
}

// ---------------- Lista / tabela ----------------

function ListaContratos({
  contratos,
  nomeModelo,
  onAbrir,
  onExcluir,
}: {
  contratos: Contrato[];
  nomeModelo: (c: Contrato) => string;
  onAbrir: (c: Contrato) => void;
  onExcluir: (c: Contrato) => void;
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-muted">
              <th className="font-medium px-4 py-3">Número</th>
              <th className="font-medium px-4 py-3">Status</th>
              <th className="font-medium px-4 py-3">Emissão</th>
              <th className="font-medium px-4 py-3">Modelo</th>
              <th className="font-medium px-4 py-3 text-right">Seções</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {contratos.map((c) => (
              <tr
                key={c.id}
                onClick={() => onAbrir(c)}
                className="cursor-pointer border-t transition-colors hover:bg-elevated"
                style={{ borderColor: "var(--border-color)" }}
              >
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <FileText
                      size={15}
                      className="flex-shrink-0"
                      style={{ color: ACCENT }}
                    />
                    {c.numero}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${STATUS_BADGE[c.status]}`}>
                    {STATUS_LABEL[c.status]}
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
                    title="Excluir contrato"
                    aria-label="Excluir contrato"
                    className="btn-ghost p-2 rounded hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
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
  onVoltar: () => void;
  onBaixarPdf: () => void;
  onMudarStatus: (status: ContratoStatus) => void;
  onExcluir: () => void;
}) {
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
          Voltar
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
                Gerando…
              </>
            ) : (
              <>
                <Download size={15} />
                Baixar PDF
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onExcluir}
            className="btn btn-secondary hover:text-danger"
          >
            <Trash2 size={15} />
            Excluir
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
            Emissão {formatarData(contrato.dataEmissao)}
            {contrato.dataAssinatura
              ? ` · Assinatura ${formatarData(contrato.dataAssinatura)}`
              : ""}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="stat-label">Status</span>
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
                  disabled={salvandoStatus}
                  className={`badge ${
                    ativo ? STATUS_BADGE[s] : "text-muted"
                  } transition-colors disabled:opacity-60`}
                  style={
                    ativo
                      ? { boxShadow: "0 0 0 1px var(--border-color)" }
                      : undefined
                  }
                >
                  {STATUS_LABEL[s]}
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
