"use client";

import { useMemo, useState } from "react";
import {
  FolderOpen,
  Archive,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Check,
  X,
  FolderInput,
} from "lucide-react";
import PageHeader from "../PageHeader";
import { useConfirmar } from "../ConfirmarModal";
import { useContratos, type AssinanteResumo } from "@/lib/contratos-context";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas } from "@/lib/workspace-context";
import Assinantes from "./Assinantes";
import type { Contrato, ContratoStatus, ContratoPasta } from "@/lib/mappers/contrato";
import { MAX_PASTAS } from "@/lib/mappers/contrato";
import { descreverContrato, formatarDataCurta } from "@/lib/contratoTitulo";
import { useT } from "@/lib/i18n";
import { MODULE_THEMES } from "@/types";
import type { ActiveTab, ActivePage } from "@/types";

const ACCENT = MODULE_THEMES.contratos.color;
const DND_TIPO = "text/contrato-id";
/** Pasta padrão "Arquivados" — sempre presente (id reservado, não editável). */
const PASTA_ARQUIVADOS = "arquivados";

const STATUS_INFO: Record<ContratoStatus, { label: string; badge: string }> = {
  rascunho: { label: "Rascunho", badge: "badge-neutral" },
  enviado: { label: "Enviado", badge: "badge-info" },
  assinado: { label: "Assinado", badge: "badge-success" },
  cancelado: { label: "Cancelado", badge: "badge-danger" },
};

function novoId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `p_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
}

export default function MeusContratosPage({
  onAbrirContrato,
  onNavigate,
}: {
  onAbrirContrato?: (id: string) => void;
  onNavigate?: (tab: ActiveTab, page: ActivePage) => void;
}) {
  const t = useT();
  const {
    contratos,
    carregando,
    erro,
    pastas,
    salvarPastas,
    moverContrato,
    assinantesPorContrato,
  } = useContratos();
  const { vendas } = useVendas();
  const artistas = useArtistas();
  const { confirmar, confirmador } = useConfirmar();

  const [hover, setHover] = useState<string | null>(null); // pasta com drag em cima
  const [aberta, setAberta] = useState<string | null>(null); // pasta aberta (mostra conteúdo)
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  const ordenados = useMemo(
    () => [...contratos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
    [contratos]
  );
  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of contratos) if (c.pastaId) m.set(c.pastaId, (m.get(c.pastaId) ?? 0) + 1);
    return m;
  }, [contratos]);
  const nomePorPasta = useMemo(() => {
    const m = new Map<string, string>();
    m.set(PASTA_ARQUIVADOS, t("Arquivados"));
    for (const p of pastas) m.set(p.id, p.nome);
    return m;
  }, [pastas, t]);
  const conteudoAberta = useMemo(
    () => (aberta ? ordenados.filter((c) => c.pastaId === aberta) : []),
    [ordenados, aberta]
  );
  // Contratos fora de qualquer pasta (pasta_id nulo ou de pasta já excluída).
  const semPasta = useMemo(() => {
    const ids = new Set<string>([PASTA_ARQUIVADOS, ...pastas.map((p) => p.id)]);
    return ordenados.filter((c) => !c.pastaId || !ids.has(c.pastaId));
  }, [ordenados, pastas]);
  const desc = (c: Contrato) => descreverContrato(c, vendas, artistas);

  async function comOcupado(fn: () => Promise<void>) {
    setOcupado(true);
    setErroLocal(null);
    try {
      await fn();
    } catch (e) {
      setErroLocal((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function criarPasta() {
    if (pastas.length >= MAX_PASTAS) return;
    const nova: ContratoPasta = { id: novoId(), nome: t("Nova pasta"), ordem: pastas.length };
    await comOcupado(() => salvarPastas([...pastas, nova]));
    setAberta(nova.id);
    setEditando(nova.id);
    setNomeEdit(nova.nome);
  }
  async function renomear(id: string) {
    const nome = nomeEdit.trim();
    setEditando(null);
    if (!nome) return;
    await comOcupado(() =>
      salvarPastas(pastas.map((p) => (p.id === id ? { ...p, nome } : p)))
    );
  }
  async function excluirPasta(p: ContratoPasta) {
    const dentro = contratos.filter((c) => c.pastaId === p.id);
    const msg =
      dentro.length > 0
        ? t("Excluir a pasta “{nome}”? Os {n} contratos saem da pasta.", { nome: p.nome, n: dentro.length })
        : t("Excluir a pasta “{nome}”?", { nome: p.nome });
    const ok = await confirmar({ titulo: t("Excluir pasta"), mensagem: msg, perigo: true });
    if (!ok) return;
    if (aberta === p.id) setAberta(null);
    await comOcupado(async () => {
      // Os contratos NÃO são apagados — voltam pra "sem pasta".
      await Promise.all(dentro.map((c) => moverContrato(c.id, null)));
      await salvarPastas(pastas.filter((x) => x.id !== p.id));
    });
  }
  function dropNaPasta(pastaId: string | null) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      setHover(null);
      const id = e.dataTransfer.getData(DND_TIPO);
      if (id) void comOcupado(() => moverContrato(id, pastaId));
    };
  }

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Contratos"
        subtitle={t("Organizador de contratos")}
        accentColor={ACCENT}
      />

      <p className="text-sm text-muted -mt-2 mb-5">
        {t("Aqui você só organiza: arraste os contratos para as pastas. Excluir uma pasta NÃO apaga os contratos — eles voltam para “sem pasta”.")}{" "}
        <button
          type="button"
          onClick={() => onNavigate?.("contratos", "contratos-historico")}
          className="underline hover:text-primary"
        >
          {t("Ver todos os contratos no Histórico")}
        </button>
      </p>

      {erroLocal && <div className="text-xs text-danger mb-3">{erroLocal}</div>}

      {carregando ? (
        <div className="card flex items-center justify-center gap-2 py-12 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> {t("Carregando contratos...")}
        </div>
      ) : erro ? (
        <div className="card flex items-center justify-center py-12 text-center text-sm text-danger">
          {erro}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* ---- PASTAS (topo) ---- */}
          <section>
            <div className="section-title mb-3">{t("Pastas")}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
              {[
                { id: PASTA_ARQUIVADOS, nome: t("Arquivados"), sistema: true },
                ...pastas.map((p) => ({ id: p.id, nome: p.nome, sistema: false })),
              ].map((slot) => {
                const ativo = hover === slot.id;
                const selec = aberta === slot.id;
                const emEdicao = editando === slot.id;
                return (
                  <div
                    key={slot.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setHover(slot.id);
                    }}
                    onDragLeave={() => setHover((h) => (h === slot.id ? null : h))}
                    onDrop={dropNaPasta(slot.id)}
                    onClick={() => !emEdicao && setAberta((a) => (a === slot.id ? null : slot.id))}
                    className="card min-h-[140px] flex flex-col justify-between cursor-pointer transition-colors"
                    style={{
                      borderColor: ativo || selec ? ACCENT : undefined,
                      backgroundColor: ativo
                        ? `color-mix(in srgb, ${ACCENT} 8%, transparent)`
                        : undefined,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {emEdicao ? (
                        <input
                          autoFocus
                          value={nomeEdit}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setNomeEdit(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renomear(slot.id);
                            if (e.key === "Escape") setEditando(null);
                          }}
                          maxLength={40}
                          className="campo-input flex-1 min-w-0 py-1 text-sm"
                          placeholder={t("Nome da pasta")}
                        />
                      ) : (
                        <span className="font-semibold text-sm text-primary truncate flex-1" title={slot.nome}>
                          {slot.nome}
                        </span>
                      )}
                      <div
                        className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `color-mix(in srgb, ${ACCENT} 13%, transparent)`, color: ACCENT }}
                      >
                        {slot.sistema ? <Archive size={16} /> : <FolderOpen size={16} />}
                      </div>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <div className="stat-value leading-none">{contagem.get(slot.id) ?? 0}</div>
                        <div className="text-xs text-muted mt-1">{selec ? t("Aberta") : t("Abrir")}</div>
                      </div>
                      {emEdicao ? (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => renomear(slot.id)} className="btn-ghost p-1 rounded" aria-label={t("Salvar")}>
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditando(null)} className="btn-ghost p-1 rounded" aria-label={t("Cancelar")}>
                            <X size={14} />
                          </button>
                        </div>
                      ) : !slot.sistema ? (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setEditando(slot.id);
                              setNomeEdit(slot.nome);
                            }}
                            className="btn-ghost p-1 rounded"
                            aria-label={t("Renomear")}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => {
                              const p = pastas.find((x) => x.id === slot.id);
                              if (p) excluirPasta(p);
                            }}
                            className="btn-ghost p-1 rounded hover:text-danger"
                            aria-label={t("Excluir pasta")}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {pastas.length < MAX_PASTAS && (
                <button
                  onClick={criarPasta}
                  disabled={ocupado}
                  className="min-h-[140px] rounded-lg border border-dashed flex flex-col items-center justify-center gap-2 text-muted hover:text-primary transition-colors disabled:opacity-50"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <Plus size={22} />
                  <span className="text-sm font-medium">{t("Criar pasta")}</span>
                </button>
              )}
            </div>

            {/* Painel da pasta aberta */}
            {aberta && (
              <div
                className="card mt-3"
                onDragOver={(e) => {
                  e.preventDefault();
                  setHover(aberta);
                }}
                onDragLeave={() => setHover((h) => (h === aberta ? null : h))}
                onDrop={dropNaPasta(aberta)}
                style={{ borderColor: hover === aberta ? ACCENT : undefined }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="section-title inline-flex items-center gap-2">
                    <FolderOpen size={15} style={{ color: ACCENT }} />
                    {nomePorPasta.get(aberta)}
                  </div>
                  <button onClick={() => setAberta(null)} className="btn-ghost text-xs">
                    {t("Fechar")}
                  </button>
                </div>
                {conteudoAberta.length === 0 ? (
                  <div className="text-sm text-muted text-center py-6">
                    {t("Arraste um contrato para cá.")}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {conteudoAberta.map((c) => (
                      <ContratoCard
                        key={c.id}
                        contrato={c}
                        desc={desc(c)}
                        assinantes={assinantesPorContrato[c.id]}
                        onAbrir={onAbrirContrato}
                        onRemover={() => void comOcupado(() => moverContrato(c.id, null))}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ---- CONTRATOS SEM PASTA (embaixo) ---- */}
          <section>
            <div className="section-title mb-3">
              {t("Contratos sem pasta")}{" "}
              <span className="text-muted font-normal">({semPasta.length})</span>
            </div>
            {contratos.length === 0 ? (
              <div className="card text-sm text-muted py-8 text-center">
                {t("Nenhum contrato ainda")}
              </div>
            ) : semPasta.length === 0 ? (
              <div className="card text-sm text-muted py-8 text-center">
                {t("Todos os contratos estão em pastas. 🎉")}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {semPasta.map((c) => (
                  <ContratoCard
                    key={c.id}
                    contrato={c}
                    desc={desc(c)}
                    assinantes={assinantesPorContrato[c.id]}
                    onAbrir={onAbrirContrato}
                    arrastavel
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      {confirmador}
    </div>
  );
}

/** Card de um contrato — título por evento/artista, CTR secundário. */
function ContratoCard({
  contrato,
  desc,
  onAbrir,
  onRemover,
  pastaNome,
  arrastavel,
  assinantes,
}: {
  contrato: Contrato;
  desc: ReturnType<typeof descreverContrato>;
  onAbrir?: (id: string) => void;
  onRemover?: () => void;
  pastaNome?: string | null;
  arrastavel?: boolean;
  assinantes?: AssinanteResumo[];
}) {
  const t = useT();
  const info = STATUS_INFO[contrato.status];
  // Linha secundária: artista · (CTR se o título é o evento) · data
  const partes: string[] = [];
  if (desc.artista) partes.push(desc.artista);
  if (desc.temEvento) partes.push(desc.numero);
  partes.push(formatarDataCurta(desc.data));

  return (
    <div
      draggable={arrastavel}
      onDragStart={
        arrastavel
          ? (e) => {
              e.dataTransfer.setData(DND_TIPO, contrato.id);
              e.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
      onClick={() => onAbrir?.(contrato.id)}
      className={`rounded-md border border-border bg-elevated p-2.5 hover:border-border-strong transition-colors ${
        arrastavel ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-primary truncate" title={desc.titulo}>
            {desc.titulo}
          </div>
          <div className="text-xs text-muted truncate">{partes.join(" · ")}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {pastaNome && (
            <span
              className="hidden sm:inline-flex items-center gap-1 text-[0.65rem] px-1.5 py-0.5 rounded max-w-[110px] truncate"
              style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}
              title={pastaNome}
            >
              <FolderOpen size={10} />
              {pastaNome}
            </span>
          )}
          <span className={`badge ${info.badge}`}>{t(info.label)}</span>
          {onRemover && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemover();
              }}
              className="btn-ghost p-1 rounded"
              title={t("Tirar da pasta")}
              aria-label={t("Tirar da pasta")}
            >
              <FolderInput size={13} />
            </button>
          )}
        </div>
      </div>
      {assinantes && assinantes.length > 0 && <Assinantes assinantes={assinantes} />}
    </div>
  );
}
