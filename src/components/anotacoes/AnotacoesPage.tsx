"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  ArrowLeft,
  Pin,
  Pencil,
  Trash2,
  Users,
  Lock,
  Globe,
  Check,
  Music,
  ChevronRight,
  NotebookPen,
  FileText,
} from "lucide-react";
import PageHeader from "../PageHeader";
import Modal from "../Modal";
import { useAnotacoes } from "@/lib/anotacoes-context";
import { useAuth } from "@/lib/auth-context";
import { useShows } from "@/lib/shows-context";
import { useArtistas } from "@/lib/workspace-context";
import { MODULE_THEMES } from "@/types";
import type { Show, Artista } from "@/types";
import type { AnotacaoPasta, Anotacao, VisibilidadePasta, MembroPasta } from "@/lib/mappers/anotacoes";
import { useEquipe, fmtQuando, type UsuarioResumo } from "./anotacoesShared";
import NotaCard from "./NotaCard";
import NotaEditor, { type NotaEditorDados } from "./NotaEditor";
import NotasDoShow from "./NotasDoShow";
import { useT } from "@/lib/i18n";

const ACCENT = MODULE_THEMES.agenda.color;
const MAX_PASTAS = 8;
const CORES = ["#3D7BFF", "#37D39A", "#F5B046", "#FF5C6C", "#9A7BFF", "#22B8CF", "#FF922B", "#94A3B8"];
const EMOJIS = ["📁", "📌", "💡", "📞", "✅", "🎧", "💰", "📝", "⭐", "🗺️", "🎫", "🔒"];

const VIS_INFO: Record<VisibilidadePasta, { icon: typeof Globe; label: string }> = {
  todos: { icon: Globe, label: "Todos" },
  proprio: { icon: Lock, label: "Só eu" },
  selecionados: { icon: Users, label: "Pessoas" },
};

type EditorState = { modo: "nova" } | { modo: "editar"; nota: Anotacao } | null;

export default function AnotacoesPage() {
  const t = useT();
  const { sessao } = useAuth();
  const {
    pastas,
    notas,
    podeCriarPasta,
    carregando,
    addPasta,
    updatePasta,
    removePasta,
    addNota,
    updateNota,
    removeNota,
  } = useAnotacoes();
  const { shows } = useShows();
  const artistas = useArtistas();
  const usuarios = useEquipe();

  const meuId = sessao?.usuario?.id ?? "";
  const souAdmin = sessao?.usuario?.papel === "admin" || sessao?.tipo === "super-admin";
  const nomeDe = (id?: string) =>
    id === meuId ? t("Você") : usuarios.find((u) => u.id === id)?.nome ?? "—";
  const corDe = (id?: string) => usuarios.find((u) => u.id === id)?.cor ?? "#8892a6";
  const artistaNomeDe = (id?: string | null) =>
    id ? artistas.find((a) => a.id === id)?.name ?? null : null;

  const [pastaAbertaId, setPastaAbertaId] = useState<string | null>(null);
  const [showAbertoId, setShowAbertoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [modalPasta, setModalPasta] = useState<
    { modo: "nova" } | { modo: "editar"; pasta: AnotacaoPasta } | null
  >(null);

  const pastaAberta = pastas.find((p) => p.id === pastaAbertaId) ?? null;
  const notasDaPasta = (pid: string) => notas.filter((n) => n.pastaId === pid);

  // ---- Notas de show, agrupadas por show (ordenadas pela mais recente) ----
  const gruposDeShow = useMemo(() => {
    const porShow = new Map<string, Anotacao[]>();
    for (const n of notas) {
      if (!n.showId) continue;
      const arr = porShow.get(n.showId) ?? [];
      arr.push(n);
      porShow.set(n.showId, arr);
    }
    return Array.from(porShow.entries())
      .map(([showId, ns]) => ({
        showId,
        notas: ns.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)),
        ultimaEm: ns.reduce((max, n) => (n.criadoEm > max ? n.criadoEm : max), ""),
      }))
      .sort((a, b) => b.ultimaEm.localeCompare(a.ultimaEm));
  }, [notas]);

  const showDe = (id: string): Show | undefined => shows.find((s) => s.id === id);
  const rotuloDoShow = (id: string): { titulo: string; sub: string } => {
    const s = showDe(id);
    if (!s) return { titulo: t("Show"), sub: "" };
    const artista = artistas.find((d) => d.id === s.artistaId);
    const data = s.data ? s.data.split("-").reverse().slice(0, 2).join("/") : "";
    return {
      titulo: s.venue || s.location || t("Show"),
      sub: [artista?.name, data].filter(Boolean).join(" · "),
    };
  };

  const buscaAtiva = busca.trim().length > 0 && !pastaAberta;
  const resultados = useMemo(() => {
    if (!buscaAtiva) return [];
    const q = busca.toLowerCase();
    return notas.filter(
      (n) =>
        (n.titulo ?? "").toLowerCase().includes(q) || n.conteudo.toLowerCase().includes(q)
    );
  }, [buscaAtiva, busca, notas]);

  const podeGerir = (p: AnotacaoPasta) => souAdmin || p.criadoPor === meuId;
  const podeMexerNota = (n: Anotacao) => souAdmin || n.criadoPor === meuId;
  const atingiuTeto = pastas.length >= MAX_PASTAS;

  // ---- Persistência da nota (Salvar explícito do editor) ----
  const salvarNota = async (dados: NotaEditorDados) => {
    if (editor?.modo === "editar") {
      const atual = await updateNota(editor.nota.id, {
        titulo: dados.titulo,
        conteudo: dados.conteudo,
        cor: dados.cor,
        fixada: dados.fixada,
        artistId: dados.artistId,
      });
      setEditor({ modo: "editar", nota: atual });
    } else if (pastaAberta) {
      await addNota({
        pasta_id: pastaAberta.id,
        titulo: dados.titulo,
        conteudo: dados.conteudo,
        cor: dados.cor,
        fixada: dados.fixada,
        artistId: dados.artistId,
      });
      setEditor(null);
    }
  };

  const excluirNota = async () => {
    if (editor?.modo !== "editar") return;
    await removeNota(editor.nota.id);
    setEditor(null);
  };

  const abrirNotaNoEditor = (n: Anotacao) => {
    if (!n.pastaId) return;
    setBusca("");
    setPastaAbertaId(n.pastaId);
    setEditor({ modo: "editar", nota: n });
  };

  const voltarParaPastas = () => {
    setEditor(null);
    setPastaAbertaId(null);
  };

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Anotações"
        subtitle={
          pastaAberta ? pastaAberta.nome : t("Base de conhecimento da agência — pastas e notas")
        }
        accentColor={ACCENT}
        actions={
          pastaAberta ? (
            <button onClick={voltarParaPastas} className="btn btn-secondary">
              <ArrowLeft size={15} />
              {t("Pastas")}
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-2 focus-within:border-border-strong transition-colors">
                <Search size={15} className="text-muted flex-shrink-0" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder={t("Buscar anotações...")}
                  className="input"
                />
                {busca && (
                  <button onClick={() => setBusca("")} className="text-muted hover:text-primary text-xs">
                    {t("Limpar")}
                  </button>
                )}
              </div>
              {podeCriarPasta && (
                <button
                  onClick={() => setModalPasta({ modo: "nova" })}
                  disabled={atingiuTeto}
                  title={atingiuTeto ? t("Limite de {n} pastas atingido.", { n: MAX_PASTAS }) : undefined}
                  className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={15} />
                  {t("Nova pasta")}
                </button>
              )}
            </div>
          )
        }
      />

      {pastaAberta ? (
        editor ? (
          <NotaEditor
            nota={editor.modo === "editar" ? editor.nota : null}
            artistas={artistas}
            podeExcluir={editor.modo === "editar" && podeMexerNota(editor.nota)}
            onSalvar={salvarNota}
            onExcluir={excluirNota}
            onVoltar={() => setEditor(null)}
          />
        ) : (
          <PastaView
            pasta={pastaAberta}
            notas={notasDaPasta(pastaAberta.id)}
            podeGerir={podeGerir(pastaAberta)}
            nomeDe={nomeDe}
            artistaNomeDe={artistaNomeDe}
            onEditarPasta={() => setModalPasta({ modo: "editar", pasta: pastaAberta })}
            onExcluirPasta={async () => {
              if (
                window.confirm(
                  t('Excluir a pasta "{nome}" e todas as suas anotações?', { nome: pastaAberta.nome })
                )
              ) {
                await removePasta(pastaAberta.id);
                voltarParaPastas();
              }
            }}
            onNovaNota={() => setEditor({ modo: "nova" })}
            onAbrirNota={(n) => setEditor({ modo: "editar", nota: n })}
          />
        )
      ) : buscaAtiva ? (
        <BuscaResultados
          resultados={resultados}
          pastas={pastas}
          rotuloDoShow={rotuloDoShow}
          nomeDe={nomeDe}
          artistaNomeDe={artistaNomeDe}
          onAbrirNota={abrirNotaNoEditor}
          onAbrirShow={(id) => {
            setBusca("");
            setShowAbertoId(id);
          }}
        />
      ) : (
        <>
          {/* ===== Pastas ===== */}
          {(pastas.length > 0 || carregando) && (
            <div className="stat-label mb-3 inline-flex items-center gap-1.5">
              <NotebookPen size={13} style={{ color: ACCENT }} />
              {t("Pastas")}
              {pastas.length > 0 && (
                <span className="tabular-nums">
                  {pastas.length}/{MAX_PASTAS}
                </span>
              )}
            </div>
          )}
          <PastasGrid
            pastas={pastas}
            carregando={carregando}
            contagem={(pid) => notasDaPasta(pid).length}
            podeCriar={podeCriarPasta && !atingiuTeto}
            onAbrir={(id) => {
              setEditor(null);
              setPastaAbertaId(id);
            }}
            onNova={() => setModalPasta({ modo: "nova" })}
          />

          {/* ===== Notas de show (embaixo das pastas) ===== */}
          {gruposDeShow.length > 0 && (
            <div className="mt-8">
              <div className="stat-label mb-3 inline-flex items-center gap-1.5">
                <Music size={13} style={{ color: ACCENT }} />
                {t("Notas de show")}
                <span className="tabular-nums">{gruposDeShow.length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {gruposDeShow.map((g) => {
                  const rot = rotuloDoShow(g.showId);
                  const autores = Array.from(
                    new Set(g.notas.map((n) => n.criadoPor).filter(Boolean))
                  ) as string[];
                  return (
                    <button
                      key={g.showId}
                      onClick={() => setShowAbertoId(g.showId)}
                      className="card flex items-center gap-3 text-left transition-colors hover:border-border-strong"
                    >
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}
                      >
                        <Music size={17} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-primary truncate">{rot.titulo}</div>
                        <div className="text-xs text-muted truncate">
                          {[rot.sub, `${g.notas.length} ${g.notas.length === 1 ? t("anotação") : t("anotações")}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      {/* Mini-avatares de quem anotou */}
                      <div className="flex -space-x-1.5 flex-shrink-0">
                        {autores.slice(0, 4).map((uid) => (
                          <span
                            key={uid}
                            className="h-6 w-6 rounded-full flex items-center justify-center text-[0.55rem] font-bold border-2"
                            style={{ backgroundColor: corDe(uid), color: "#fff", borderColor: "var(--surface)" }}
                            title={nomeDe(uid)}
                          >
                            {nomeDe(uid).slice(0, 2).toUpperCase()}
                          </span>
                        ))}
                      </div>
                      <span className="text-[0.65rem] text-muted tabular-nums flex-shrink-0">
                        {fmtQuando(g.ultimaEm)}
                      </span>
                      <ChevronRight size={14} className="text-muted flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty-state dedicado de Notas de show (só com o workspace já em uso) */}
          {gruposDeShow.length === 0 && pastas.length > 0 && !carregando && (
            <div className="mt-8">
              <div className="stat-label mb-3 inline-flex items-center gap-1.5">
                <Music size={13} style={{ color: ACCENT }} />
                {t("Notas de show")}
              </div>
              <div className="card flex items-center gap-3 py-6 text-left">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}
                >
                  <Music size={17} />
                </div>
                <div className="min-w-0">
                  <div className="section-title">{t("Nenhuma nota de show ainda")}</div>
                  <p className="section-subtitle">
                    {t("Anote detalhes direto no show (na Agenda) e eles aparecem aqui.")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal — notas de um show */}
      <Modal
        isOpen={!!showAbertoId}
        onClose={() => setShowAbertoId(null)}
        title={showAbertoId ? rotuloDoShow(showAbertoId).titulo : ""}
        subtitle={showAbertoId ? rotuloDoShow(showAbertoId).sub || t("Notas do show") : undefined}
        maxWidth={560}
      >
        {showAbertoId && (
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <NotasDoShow showId={showAbertoId} />
          </div>
        )}
      </Modal>

      {modalPasta && (
        <PastaFormModal
          inicial={modalPasta.modo === "editar" ? modalPasta.pasta : null}
          usuarios={usuarios}
          artistas={artistas}
          meuId={meuId}
          onClose={() => setModalPasta(null)}
          onSalvar={async (dados) => {
            if (modalPasta.modo === "editar") await updatePasta(modalPasta.pasta.id, dados);
            else await addPasta(dados);
            setModalPasta(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Grade de pastas — máx 8 (4 em cima, 4 embaixo)
// ============================================================

function PastasGrid({
  pastas,
  carregando,
  contagem,
  podeCriar,
  onAbrir,
  onNova,
}: {
  pastas: AnotacaoPasta[];
  carregando: boolean;
  contagem: (id: string) => number;
  podeCriar: boolean;
  onAbrir: (id: string) => void;
  onNova: () => void;
}) {
  const t = useT();
  if (carregando && pastas.length === 0) {
    return <div className="card text-sm text-muted text-center py-12">{t("Carregando...")}</div>;
  }
  if (pastas.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}
        >
          <NotebookPen size={26} />
        </div>
        <div className="section-title mb-1">{t("Nenhuma pasta ainda")}</div>
        <p className="section-subtitle max-w-sm mb-4">
          {t("Crie pastas por tema (contatos úteis, procedimentos, ideias...) e deixe anotações que a equipe pode consultar.")}
        </p>
        {podeCriar && (
          <button onClick={onNova} className="btn btn-primary">
            <Plus size={15} />
            {t("Criar primeira pasta")}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {pastas.map((p) => {
        const cor = p.cor || ACCENT;
        const Vis = VIS_INFO[p.visibilidade].icon;
        const n = contagem(p.id);
        return (
          <button
            key={p.id}
            onClick={() => onAbrir(p.id)}
            className="card text-left transition-transform hover:-translate-y-0.5 active:translate-y-0"
            style={{ borderLeft: `3px solid ${cor}` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: `${cor}20` }}
              >
                {p.icone || "📁"}
              </div>
              <span
                className={`badge inline-flex items-center gap-1 ${
                  p.visibilidade === "todos" ? "badge-info" : "badge-neutral"
                }`}
                title={t("Quem pode ver")}
              >
                <Vis size={11} />
                {t(VIS_INFO[p.visibilidade].label)}
              </span>
            </div>
            <div className="section-title mt-3 truncate">{p.nome}</div>
            <div className="text-xs text-muted mt-1">
              {n} {n === 1 ? t("anotação") : t("anotações")}
              {p.visibilidade === "selecionados" && p.membros.length > 0
                ? ` · ${t("{n} com acesso", { n: p.membros.length })}`
                : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// PastaView — cabeçalho da pasta + lista de notas-documento
// ============================================================

function PastaView({
  pasta,
  notas,
  podeGerir,
  nomeDe,
  artistaNomeDe,
  onEditarPasta,
  onExcluirPasta,
  onNovaNota,
  onAbrirNota,
}: {
  pasta: AnotacaoPasta;
  notas: Anotacao[];
  podeGerir: boolean;
  nomeDe: (id?: string) => string;
  artistaNomeDe: (id?: string | null) => string | null;
  onEditarPasta: () => void;
  onExcluirPasta: () => void;
  onNovaNota: () => void;
  onAbrirNota: (n: Anotacao) => void;
}) {
  const t = useT();
  const Vis = VIS_INFO[pasta.visibilidade].icon;
  const [filtroArtista, setFiltroArtista] = useState<string | null>(null);

  // Artistas presentes nas etiquetas desta pasta (pro filtro).
  const artistasNaPasta = useMemo(() => {
    const ids = new Set<string>();
    for (const n of notas) if (n.artistId) ids.add(n.artistId);
    return Array.from(ids)
      .map((id) => ({ id, nome: artistaNomeDe(id) ?? t("Artista") }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [notas, artistaNomeDe, t]);

  const visiveis = useMemo(() => {
    const base = filtroArtista ? notas.filter((n) => n.artistId === filtroArtista) : notas;
    return [...base].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
  }, [notas, filtroArtista]);

  const fixadas = visiveis.filter((n) => n.fixada);
  const demais = visiveis.filter((n) => !n.fixada);

  const cardDe = (n: Anotacao) => (
    <NotaCard
      key={n.id}
      nota={n}
      autorNome={nomeDe(n.criadoPor)}
      editorNome={n.atualizadoPor ? nomeDe(n.atualizadoPor) : null}
      artistaNome={artistaNomeDe(n.artistId)}
      corBorda={n.cor || pasta.cor || ACCENT}
      onAbrir={() => onAbrirNota(n)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho da pasta */}
      <div
        className="card flex items-center justify-between gap-3"
        style={{ borderLeft: `3px solid ${pasta.cor || ACCENT}` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ backgroundColor: `${pasta.cor || ACCENT}20` }}
          >
            {pasta.icone || "📁"}
          </div>
          <div className="min-w-0">
            <div className="section-title truncate">{pasta.nome}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className={`badge inline-flex items-center gap-1 ${
                  pasta.visibilidade === "todos" ? "badge-info" : "badge-neutral"
                }`}
              >
                <Vis size={11} />
                {t(VIS_INFO[pasta.visibilidade].label)}
              </span>
              {pasta.visibilidade === "selecionados" && pasta.membros.length > 0 && (
                <span className="text-xs text-muted">
                  {t("{n} com acesso", { n: pasta.membros.length })}
                </span>
              )}
              <span className="text-xs text-muted">
                {notas.length} {notas.length === 1 ? t("anotação") : t("anotações")}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onNovaNota} className="btn btn-primary text-sm">
            <Plus size={14} />
            {t("Nova nota")}
          </button>
          {podeGerir && (
            <>
              <button
                onClick={onEditarPasta}
                className="btn btn-secondary text-sm"
                title={t("Editar pasta")}
                aria-label={t("Editar pasta")}
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={onExcluirPasta}
                className="btn btn-secondary text-sm"
                title={t("Excluir pasta")}
                aria-label={t("Excluir pasta")}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filtro por artista (só quando há notas etiquetadas) */}
      {artistasNaPasta.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFiltroArtista(null)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs transition-colors"
            style={{
              borderColor: filtroArtista === null ? ACCENT : "var(--border)",
              backgroundColor: filtroArtista === null ? `${ACCENT}15` : "transparent",
              color: filtroArtista === null ? ACCENT : "var(--text-secondary)",
            }}
          >
            {t("Todos")}
          </button>
          {artistasNaPasta.map((a) => {
            const on = filtroArtista === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setFiltroArtista(on ? null : a.id)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs transition-colors"
                style={{
                  borderColor: on ? ACCENT : "var(--border)",
                  backgroundColor: on ? `${ACCENT}15` : "transparent",
                  color: on ? ACCENT : "var(--text-secondary)",
                }}
              >
                <Music size={11} />
                {a.nome}
              </button>
            );
          })}
        </div>
      )}

      {/* Lista */}
      {visiveis.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}
          >
            <FileText size={26} />
          </div>
          <div className="section-title mb-1">
            {filtroArtista ? t("Nenhuma nota para este artista") : t("Nenhuma nota ainda")}
          </div>
          {!filtroArtista && (
            <>
              <p className="section-subtitle max-w-sm mb-4">
                {t("Crie a primeira nota-documento desta pasta. Escreva um título e o conteúdo em markdown.")}
              </p>
              <button onClick={onNovaNota} className="btn btn-primary">
                <Plus size={15} />
                {t("Nova nota")}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {fixadas.length > 0 && (
            <div>
              <div className="stat-label mb-2 inline-flex items-center gap-1.5">
                <Pin size={12} style={{ color: ACCENT }} fill="currentColor" />
                {t("Fixadas")}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{fixadas.map(cardDe)}</div>
            </div>
          )}
          {demais.length > 0 && (
            <div>
              {fixadas.length > 0 && (
                <div className="stat-label mb-2 inline-flex items-center gap-1.5">
                  <FileText size={12} style={{ color: ACCENT }} />
                  {t("Todas")}
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{demais.map(cardDe)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Resultados de busca (cards clicáveis -> abrem no editor)
// ============================================================

function BuscaResultados({
  resultados,
  pastas,
  rotuloDoShow,
  nomeDe,
  artistaNomeDe,
  onAbrirNota,
  onAbrirShow,
}: {
  resultados: Anotacao[];
  pastas: AnotacaoPasta[];
  rotuloDoShow: (id: string) => { titulo: string; sub: string };
  nomeDe: (id?: string) => string;
  artistaNomeDe: (id?: string | null) => string | null;
  onAbrirNota: (n: Anotacao) => void;
  onAbrirShow: (id: string) => void;
}) {
  const t = useT();
  if (resultados.length === 0) {
    return <div className="card text-sm text-muted text-center py-12">{t("Nada encontrado.")}</div>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="stat-label">{t("{n} resultado(s)", { n: resultados.length })}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {resultados.map((n) => {
          const pasta = n.pastaId ? pastas.find((p) => p.id === n.pastaId) : undefined;
          const origem = n.showId
            ? `🎵 ${rotuloDoShow(n.showId).titulo}`
            : `${pasta?.icone || "📁"} ${pasta?.nome ?? "—"}`;
          return (
            <div key={n.id} className="flex flex-col gap-1">
              <span className="badge badge-neutral self-start">{origem}</span>
              <NotaCard
                nota={n}
                autorNome={nomeDe(n.criadoPor)}
                editorNome={n.atualizadoPor ? nomeDe(n.atualizadoPor) : null}
                artistaNome={artistaNomeDe(n.artistId)}
                corBorda={n.cor || pasta?.cor || ACCENT}
                onAbrir={() => (n.showId ? onAbrirShow(n.showId) : onAbrirNota(n))}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Modal criar/editar pasta
// ============================================================

function PastaFormModal({
  inicial,
  usuarios,
  artistas,
  meuId,
  onClose,
  onSalvar,
}: {
  inicial: AnotacaoPasta | null;
  usuarios: UsuarioResumo[];
  artistas: Artista[];
  meuId: string;
  onClose: () => void;
  onSalvar: (dados: {
    nome: string;
    cor?: string | null;
    icone?: string | null;
    visibilidade: VisibilidadePasta;
    membros?: MembroPasta[];
  }) => Promise<void>;
}) {
  const t = useT();
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [cor, setCor] = useState<string>(inicial?.cor ?? CORES[0]);
  const [icone, setIcone] = useState<string>(inicial?.icone ?? "📁");
  const [visibilidade, setVisibilidade] = useState<VisibilidadePasta>(inicial?.visibilidade ?? "todos");
  const [membrosUsuario, setMembrosUsuario] = useState<string[]>(
    () => (inicial?.membros ?? []).filter((m) => m.tipo === "usuario").map((m) => m.id)
  );
  const [membrosArtista, setMembrosArtista] = useState<string[]>(
    () => (inicial?.membros ?? []).filter((m) => m.tipo === "artista").map((m) => m.id)
  );
  const [salvando, setSalvando] = useState(false);

  const toggleMembro = (id: string) =>
    setMembrosUsuario((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleArtista = (id: string) =>
    setMembrosArtista((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const salvar = async () => {
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    try {
      const membros: MembroPasta[] =
        visibilidade === "selecionados"
          ? [
              ...membrosUsuario.map((id) => ({ tipo: "usuario" as const, id })),
              ...membrosArtista.map((id) => ({ tipo: "artista" as const, id })),
            ]
          : [];
      await onSalvar({ nome: nome.trim(), cor, icone, visibilidade, membros });
    } catch (e) {
      window.alert((e as Error).message || t("Falha ao salvar."));
      setSalvando(false);
    }
  };

  const opcoes: { v: VisibilidadePasta; icon: typeof Globe; label: string; desc: string }[] = [
    { v: "todos", icon: Globe, label: t("Todos do workspace"), desc: t("Qualquer pessoa da agência vê") },
    { v: "proprio", icon: Lock, label: t("Só eu"), desc: t("Ninguém mais vê") },
    { v: "selecionados", icon: Users, label: t("Pessoas específicas"), desc: t("Só quem você escolher") },
  ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={inicial ? t("Editar pasta") : t("Nova pasta")}
      subtitle={t("Um tópico pra anotações da equipe")}
      maxWidth={520}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="stat-label mb-1 block">{t("Nome")}</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={t("Ex.: Contatos úteis, Procedimentos...")}
            className="input w-full border border-border rounded-md px-3 py-2 bg-surface"
            autoFocus
          />
        </div>

        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="stat-label mb-1 block">{t("Ícone")}</label>
            <div className="flex gap-1 flex-wrap max-w-[220px]">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setIcone(e)}
                  className={`h-8 w-8 rounded-md text-lg flex items-center justify-center border ${icone === e ? "border-border-strong bg-elevated" : "border-transparent hover:bg-elevated"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="stat-label mb-1 block">{t("Cor")}</label>
            <div className="flex gap-1.5 flex-wrap">
              {CORES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCor(c)}
                  className="h-7 w-7 rounded-full border-2"
                  style={{ backgroundColor: c, borderColor: cor === c ? "#fff" : "transparent" }}
                  aria-label={t("Cor")}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="stat-label mb-1.5 block">{t("Quem pode ver")}</label>
          <div className="flex flex-col gap-2">
            {opcoes.map((o) => {
              const ativo = visibilidade === o.v;
              return (
                <button
                  key={o.v}
                  onClick={() => setVisibilidade(o.v)}
                  className="flex items-center gap-3 p-2.5 rounded-md border text-left transition-colors"
                  style={{ borderColor: ativo ? ACCENT : "var(--border)", backgroundColor: ativo ? `${ACCENT}12` : "transparent" }}
                >
                  <o.icon size={16} style={{ color: ativo ? ACCENT : "var(--text-muted)" }} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-primary">{o.label}</div>
                    <div className="text-xs text-muted">{o.desc}</div>
                  </div>
                  {ativo && <Check size={15} style={{ color: ACCENT }} className="ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>

        {visibilidade === "selecionados" && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="stat-label mb-1.5 block">{t("Equipe")}</label>
              <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto">
                {usuarios.filter((u) => u.id !== meuId).length === 0 ? (
                  <span className="text-sm text-muted">{t("Nenhum outro usuário no workspace.")}</span>
                ) : (
                  usuarios
                    .filter((u) => u.id !== meuId)
                    .map((u) => {
                      const on = membrosUsuario.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          onClick={() => toggleMembro(u.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-sm transition-colors"
                          style={{ borderColor: on ? ACCENT : "var(--border)", backgroundColor: on ? `${ACCENT}15` : "transparent" }}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: u.cor || "#8892a6" }} />
                          {u.nome}
                          {on && <Check size={12} style={{ color: ACCENT }} />}
                        </button>
                      );
                    })
                )}
              </div>
            </div>

            <div>
              <label className="stat-label mb-1.5 block">{t("Artistas")}</label>
              <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto">
                {artistas.length === 0 ? (
                  <span className="text-sm text-muted">{t("Nenhum artista no workspace.")}</span>
                ) : (
                  artistas.map((a) => {
                    const on = membrosArtista.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => toggleArtista(a.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-sm transition-colors"
                        style={{ borderColor: on ? ACCENT : "var(--border)", backgroundColor: on ? `${ACCENT}15` : "transparent" }}
                      >
                        <span
                          className="h-4 w-4 rounded-full flex items-center justify-center text-[0.5rem] font-bold flex-shrink-0"
                          style={{ backgroundColor: a.color, color: "#fff" }}
                        >
                          {a.name.slice(0, 2).toUpperCase()}
                        </span>
                        {a.name}
                        {on && <Check size={12} style={{ color: ACCENT }} />}
                      </button>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-muted mt-1.5">
                {t("Quem trabalha com o artista enxerga a pasta.")}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn btn-secondary">
            {t("Cancelar")}
          </button>
          <button onClick={salvar} disabled={!nome.trim() || salvando} className="btn btn-primary disabled:opacity-50">
            {salvando ? t("Salvando...") : inicial ? t("Salvar") : t("Criar pasta")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
