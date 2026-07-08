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
  Send,
  Check,
  Music,
  ChevronRight,
  NotebookPen,
} from "lucide-react";
import PageHeader from "../PageHeader";
import Modal from "../Modal";
import { useAnotacoes } from "@/lib/anotacoes-context";
import { useAuth } from "@/lib/auth-context";
import { useShows } from "@/lib/shows-context";
import { useArtistas } from "@/lib/workspace-context";
import { MODULE_THEMES } from "@/types";
import type { Show } from "@/types";
import type { AnotacaoPasta, Anotacao, VisibilidadePasta } from "@/lib/mappers/anotacoes";
import { renderMarkdownSeguro } from "./markdownSeguro";
import NotaChat, { useEquipe, fmtQuando, type UsuarioResumo } from "./NotaChat";
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

  const [pastaAbertaId, setPastaAbertaId] = useState<string | null>(null);
  const [showAbertoId, setShowAbertoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
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
    const dj = artistas.find((d) => d.id === s.djId);
    const data = s.data ? s.data.split("-").reverse().slice(0, 2).join("/") : "";
    return {
      titulo: s.venue || s.location || t("Show"),
      sub: [dj?.name, data].filter(Boolean).join(" · "),
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
  const atingiuTeto = pastas.length >= MAX_PASTAS;

  return (
    <div className="max-w-[1100px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Anotações"
        subtitle={
          pastaAberta
            ? pastaAberta.nome
            : t("Base de conhecimento da agência — pastas e notas")
        }
        accentColor={ACCENT}
        actions={
          pastaAberta ? (
            <button onClick={() => setPastaAbertaId(null)} className="btn btn-secondary">
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
        <ThreadPasta
          pasta={pastaAberta}
          notas={notasDaPasta(pastaAberta.id)}
          meuId={meuId}
          souAdmin={souAdmin}
          nomeDe={nomeDe}
          corDe={corDe}
          podeGerir={podeGerir(pastaAberta)}
          onEditarPasta={() => setModalPasta({ modo: "editar", pasta: pastaAberta })}
          onExcluirPasta={async () => {
            if (window.confirm(t('Excluir a pasta "{nome}" e todas as suas anotações?', { nome: pastaAberta.nome }))) {
              await removePasta(pastaAberta.id);
              setPastaAbertaId(null);
            }
          }}
          addNota={addNota}
          updateNota={updateNota}
          removeNota={removeNota}
        />
      ) : buscaAtiva ? (
        <BuscaResultados
          resultados={resultados}
          pastas={pastas}
          rotuloDoShow={rotuloDoShow}
          nomeDe={nomeDe}
          corDe={corDe}
          onAbrirPasta={(id) => {
            setBusca("");
            setPastaAbertaId(id);
          }}
          onAbrirShow={(id) => {
            setBusca("");
            setShowAbertoId(id);
          }}
        />
      ) : (
        <>
          <PastasGrid
            pastas={pastas}
            carregando={carregando}
            contagem={(pid) => notasDaPasta(pid).length}
            podeCriar={podeCriarPasta && !atingiuTeto}
            onAbrir={(id) => setPastaAbertaId(id)}
            onNova={() => setModalPasta({ modo: "nova" })}
          />

          {/* ===== Notas de show (embaixo das pastas) ===== */}
          {gruposDeShow.length > 0 && (
            <div className="mt-8">
              <div className="stat-label mb-3 inline-flex items-center gap-1.5">
                <Music size={13} style={{ color: ACCENT }} />
                {t("Notas de show")}
              </div>
              <div className="flex flex-col gap-2">
                {gruposDeShow.map((g) => {
                  const rot = rotuloDoShow(g.showId);
                  const autores = Array.from(new Set(g.notas.map((n) => n.criadoPor).filter(Boolean))) as string[];
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
        </>
      )}

      {/* Modal — thread de notas de um show */}
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
                className="badge inline-flex items-center gap-1"
                style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}
                title={t("Quem pode ver")}
              >
                <Vis size={11} />
                {t(VIS_INFO[p.visibilidade].label)}
              </span>
            </div>
            <div className="section-title mt-3 truncate">{p.nome}</div>
            <div className="text-xs text-muted mt-1">
              {n} {n === 1 ? t("anotação") : t("anotações")}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Resultados de busca (notas de pasta + de show)
// ============================================================

function BuscaResultados({
  resultados,
  pastas,
  rotuloDoShow,
  nomeDe,
  corDe,
  onAbrirPasta,
  onAbrirShow,
}: {
  resultados: Anotacao[];
  pastas: AnotacaoPasta[];
  rotuloDoShow: (id: string) => { titulo: string; sub: string };
  nomeDe: (id?: string) => string;
  corDe: (id?: string) => string;
  onAbrirPasta: (id: string) => void;
  onAbrirShow: (id: string) => void;
}) {
  const t = useT();
  if (resultados.length === 0) {
    return <div className="card text-sm text-muted text-center py-12">{t("Nada encontrado.")}</div>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="stat-label">{t("{n} resultado(s)", { n: resultados.length })}</div>
      {resultados.map((n) => {
        const pasta = n.pastaId ? pastas.find((p) => p.id === n.pastaId) : undefined;
        const origem = n.showId
          ? `🎵 ${rotuloDoShow(n.showId).titulo}`
          : `${pasta?.icone || "📁"} ${pasta?.nome ?? "—"}`;
        return (
          <button
            key={n.id}
            onClick={() => (n.showId ? onAbrirShow(n.showId) : n.pastaId && onAbrirPasta(n.pastaId))}
            className="card text-left transition-colors hover:border-border-strong"
            style={{ borderLeft: `3px solid ${n.cor || pasta?.cor || ACCENT}` }}
          >
            <div className="flex items-center gap-2 text-xs text-muted mb-1">
              <span className="badge badge-neutral">{origem}</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: corDe(n.criadoPor) }} />
                {nomeDe(n.criadoPor)} · {fmtQuando(n.criadoEm)}
              </span>
            </div>
            {n.titulo && <div className="text-sm font-semibold text-primary mb-0.5">{n.titulo}</div>}
            <div className="text-secondary">{renderMarkdownSeguro(n.conteudo)}</div>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Thread (grupo de WhatsApp) de uma pasta
// ============================================================

function ThreadPasta({
  pasta,
  notas,
  meuId,
  souAdmin,
  nomeDe,
  corDe,
  podeGerir,
  onEditarPasta,
  onExcluirPasta,
  addNota,
  updateNota,
  removeNota,
}: {
  pasta: AnotacaoPasta;
  notas: Anotacao[];
  meuId: string;
  souAdmin: boolean;
  nomeDe: (id?: string) => string;
  corDe: (id?: string) => string;
  podeGerir: boolean;
  onEditarPasta: () => void;
  onExcluirPasta: () => void;
  addNota: (n: { pasta_id: string; conteudo: string; cor?: string | null }) => Promise<Anotacao>;
  updateNota: (id: string, n: { conteudo?: string; fixada?: boolean }) => Promise<Anotacao>;
  removeNota: (id: string) => Promise<void>;
}) {
  const t = useT();
  const [texto, setTexto] = useState("");
  const [cor, setCor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const ordenadas = useMemo(
    () => [...notas].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)),
    [notas]
  );
  const fixadas = ordenadas.filter((n) => n.fixada);
  const Vis = VIS_INFO[pasta.visibilidade].icon;

  const enviar = async () => {
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;
    setEnviando(true);
    try {
      await addNota({ pasta_id: pasta.id, conteudo, cor });
      setTexto("");
      setCor(null);
    } catch (e) {
      window.alert((e as Error).message || t("Falha ao salvar."));
    } finally {
      setEnviando(false);
    }
  };

  const bolha = (n: Anotacao, prefixo: string) => (
    <NotaChat
      key={`${prefixo}-${n.id}`}
      nota={n}
      minha={n.criadoPor === meuId}
      nome={nomeDe(n.criadoPor)}
      cor={corDe(n.criadoPor)}
      accent={ACCENT}
      podeMexer={souAdmin || n.criadoPor === meuId}
      onTogglePin={() => updateNota(n.id, { fixada: !n.fixada }).catch(() => undefined)}
      onSalvar={(conteudo) => updateNota(n.id, { conteudo }).then(() => undefined)}
      onExcluir={() => removeNota(n.id).catch(() => undefined)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho da pasta */}
      <div className="card flex items-center justify-between gap-3" style={{ borderLeft: `3px solid ${pasta.cor || ACCENT}` }}>
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ backgroundColor: `${pasta.cor || ACCENT}20` }}
          >
            {pasta.icone || "📁"}
          </div>
          <div className="min-w-0">
            <div className="section-title truncate">{pasta.nome}</div>
            <div className="text-xs text-muted inline-flex items-center gap-1">
              <Vis size={11} /> {t(VIS_INFO[pasta.visibilidade].label)} · {ordenadas.length}{" "}
              {ordenadas.length === 1 ? t("anotação") : t("anotações")}
            </div>
          </div>
        </div>
        {podeGerir && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onEditarPasta} className="btn btn-secondary text-sm" title={t("Editar pasta")} aria-label={t("Editar pasta")}>
              <Pencil size={14} />
            </button>
            <button onClick={onExcluirPasta} className="btn btn-secondary text-sm" title={t("Excluir pasta")} aria-label={t("Excluir pasta")}>
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Fixadas */}
      {fixadas.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="stat-label inline-flex items-center gap-1.5">
            <Pin size={12} style={{ color: ACCENT }} /> {t("Fixadas")}
          </div>
          {fixadas.map((n) => bolha(n, "fix"))}
        </div>
      )}

      {/* Thread */}
      {ordenadas.length === 0 ? (
        <div className="card text-sm text-muted text-center py-10">
          {t("Nenhuma anotação ainda. Escreva a primeira abaixo. 👇")}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">{ordenadas.map((n) => bolha(n, "th"))}</div>
      )}

      {/* Compose */}
      <div className="card sticky bottom-4">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") enviar();
          }}
          placeholder={t("Escreva uma anotação... (negrito **assim**, listas com -, links http)")}
          className="input w-full min-h-[70px] resize-y border border-border rounded-md p-2.5 bg-surface"
        />
        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted mr-1">{t("Cor:")}</span>
            <button
              onClick={() => setCor(null)}
              className={`h-5 w-5 rounded-full border flex items-center justify-center ${cor === null ? "border-border-strong" : "border-border"}`}
              title={t("Sem cor")}
            >
              {cor === null && <Check size={11} className="text-muted" />}
            </button>
            {CORES.map((c) => (
              <button
                key={c}
                onClick={() => setCor(c)}
                className="h-5 w-5 rounded-full border-2"
                style={{ backgroundColor: c, borderColor: cor === c ? "#fff" : "transparent" }}
                aria-label={t("Cor")}
              />
            ))}
          </div>
          <button onClick={enviar} disabled={!texto.trim() || enviando} className="btn btn-primary disabled:opacity-50">
            <Send size={14} />
            {enviando ? t("Enviando...") : t("Adicionar")}
          </button>
        </div>
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
  meuId,
  onClose,
  onSalvar,
}: {
  inicial: AnotacaoPasta | null;
  usuarios: UsuarioResumo[];
  meuId: string;
  onClose: () => void;
  onSalvar: (dados: {
    nome: string;
    cor?: string | null;
    icone?: string | null;
    visibilidade: VisibilidadePasta;
    membros?: string[];
  }) => Promise<void>;
}) {
  const t = useT();
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [cor, setCor] = useState<string>(inicial?.cor ?? CORES[0]);
  const [icone, setIcone] = useState<string>(inicial?.icone ?? "📁");
  const [visibilidade, setVisibilidade] = useState<VisibilidadePasta>(inicial?.visibilidade ?? "todos");
  const [membros, setMembros] = useState<string[]>(inicial?.membros ?? []);
  const [salvando, setSalvando] = useState(false);

  const toggleMembro = (id: string) =>
    setMembros((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const salvar = async () => {
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    try {
      await onSalvar({
        nome: nome.trim(),
        cor,
        icone,
        visibilidade,
        membros: visibilidade === "selecionados" ? membros : [],
      });
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
          <div>
            <label className="stat-label mb-1.5 block">{t("Escolha as pessoas")}</label>
            <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto">
              {usuarios.filter((u) => u.id !== meuId).length === 0 ? (
                <span className="text-sm text-muted">{t("Nenhum outro usuário no workspace.")}</span>
              ) : (
                usuarios
                  .filter((u) => u.id !== meuId)
                  .map((u) => {
                    const on = membros.includes(u.id);
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
