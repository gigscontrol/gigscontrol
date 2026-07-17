"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Trash2, Save, Check, Palette, Pin, Eye, PencilLine } from "lucide-react";
import type { Anotacao } from "@/lib/mappers/anotacoes";
import type { Artista } from "@/types";
import { MODULE_THEMES } from "@/types";
import { renderMarkdownSeguro } from "./markdownSeguro";
import { useT } from "@/lib/i18n";
import { useConfirmar, useAviso } from "../ConfirmarModal";

const ACCENT = MODULE_THEMES.agenda.color;
const CORES = ["#3D7BFF", "#37D39A", "#F5B046", "#FF5C6C", "#9A7BFF", "#22B8CF", "#FF922B", "#94A3B8"];

export type NotaEditorDados = {
  titulo: string;
  conteudo: string;
  cor: string | null;
  fixada: boolean;
  artistId: string | null;
};

/**
 * Editor INLINE de uma nota-documento (substitui a lista da pasta, com voltar).
 * Título obrigatório em pasta, corpo markdown com abas Escrever/Visualizar,
 * cor, fixar e etiqueta de artista. SALVAR é explícito (botão + Ctrl/Cmd+S);
 * nada é persistido antes disso.
 */
export default function NotaEditor({
  nota,
  artistas,
  podeExcluir,
  onSalvar,
  onExcluir,
  onVoltar,
}: {
  nota: Anotacao | null;
  artistas: Artista[];
  podeExcluir: boolean;
  onSalvar: (dados: NotaEditorDados) => Promise<void>;
  onExcluir: () => Promise<void>;
  onVoltar: () => void;
}) {
  const t = useT();
  const { confirmar, confirmador } = useConfirmar();
  const { avisar, avisador } = useAviso();
  const editando = !!nota;

  const inicial = useMemo<NotaEditorDados>(
    () => ({
      titulo: nota?.titulo ?? "",
      conteudo: nota?.conteudo ?? "",
      cor: nota?.cor ?? null,
      fixada: nota?.fixada ?? false,
      artistId: nota?.artistId ?? null,
    }),
    [nota]
  );

  const [titulo, setTitulo] = useState(inicial.titulo);
  const [conteudo, setConteudo] = useState(inicial.conteudo);
  const [cor, setCor] = useState<string | null>(inicial.cor);
  const [fixada, setFixada] = useState(inicial.fixada);
  const [artistId, setArtistId] = useState<string | null>(inicial.artistId);
  const [aba, setAba] = useState<"escrever" | "visualizar">("escrever");
  const [salvando, setSalvando] = useState(false);

  const sujo =
    titulo !== inicial.titulo ||
    conteudo !== inicial.conteudo ||
    cor !== inicial.cor ||
    fixada !== inicial.fixada ||
    artistId !== inicial.artistId;

  const podeSalvar = !!titulo.trim() && !salvando;

  const salvar = async () => {
    if (!titulo.trim()) return;
    if (salvando) return;
    setSalvando(true);
    try {
      await onSalvar({
        titulo: titulo.trim(),
        conteudo,
        cor,
        fixada,
        artistId,
      });
    } catch (e) {
      avisar((e as Error).message || t("Falha ao salvar."));
    } finally {
      setSalvando(false);
    }
  };

  const voltar = async () => {
    if (sujo && !(await confirmar({ titulo: t("Descartar as alterações não salvas?") }))) return;
    onVoltar();
  };

  const excluir = async () => {
    if (!editando) return;
    if (!(await confirmar({ titulo: t("Excluir esta anotação?"), perigo: true }))) return;
    await onExcluir();
  };

  // Ctrl/Cmd+S salva (sem sair da página).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        void salvar();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo, conteudo, cor, fixada, artistId, salvando]);

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de topo */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={voltar} className="btn btn-secondary">
          <ArrowLeft size={15} />
          {t("Voltar")}
        </button>
        <div className="flex items-center gap-2">
          {editando && podeExcluir && (
            <button
              onClick={excluir}
              className="btn btn-secondary"
              title={t("Excluir")}
              aria-label={t("Excluir")}
            >
              <Trash2 size={15} />
            </button>
          )}
          <button onClick={salvar} disabled={!podeSalvar} className="btn btn-primary disabled:opacity-50">
            <Save size={15} />
            {salvando ? t("Salvando...") : t("Salvar")}
          </button>
        </div>
      </div>

      <div className="card flex flex-col gap-4">
        {/* Título */}
        <div>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={t("Título da nota")}
            className="input w-full bg-transparent border-0 border-b border-border rounded-none px-0 py-1.5 text-lg font-semibold text-primary focus:border-border-strong"
            autoFocus={!editando}
          />
          {!titulo.trim() && (
            <p className="text-xs text-muted mt-1">{t("O título é obrigatório.")}</p>
          )}
        </div>

        {/* Corpo — abas Escrever / Visualizar */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={() => setAba("escrever")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                aba === "escrever" ? "bg-elevated text-primary" : "text-muted hover:text-primary"
              }`}
            >
              <PencilLine size={13} />
              {t("Escrever")}
            </button>
            <button
              onClick={() => setAba("visualizar")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                aba === "visualizar" ? "bg-elevated text-primary" : "text-muted hover:text-primary"
              }`}
            >
              <Eye size={13} />
              {t("Visualizar")}
            </button>
          </div>
          {aba === "escrever" ? (
            <textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder={t("Escreva o conteúdo... (aceita **negrito**, *itálico*, listas com - e links)")}
              className="input w-full min-h-[320px] resize-y border border-border rounded-md p-3 bg-surface leading-relaxed"
            />
          ) : (
            <div className="border border-border rounded-md p-3 bg-surface min-h-[320px]">
              {conteudo.trim() ? (
                renderMarkdownSeguro(conteudo)
              ) : (
                <p className="text-sm text-muted">{t("Nada para visualizar ainda.")}</p>
              )}
            </div>
          )}
        </div>

        {/* Opções: cor · fixar · artista */}
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="stat-label mb-1.5 block inline-flex items-center gap-1">
              <Palette size={12} /> {t("Cor")}
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setCor(null)}
                className={`h-7 w-7 rounded-full border flex items-center justify-center ${
                  cor === null ? "border-border-strong" : "border-border"
                }`}
                title={t("Sem cor")}
                aria-label={t("Sem cor")}
              >
                {cor === null && <Check size={13} className="text-muted" />}
              </button>
              {CORES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCor(c)}
                  className="h-7 w-7 rounded-full border-2 flex items-center justify-center"
                  style={{ backgroundColor: c, borderColor: cor === c ? "#fff" : "transparent" }}
                  aria-label={t("Cor")}
                >
                  {cor === c && <Check size={13} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="stat-label mb-1.5 block">{t("Fixar")}</label>
            <button
              onClick={() => setFixada((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors"
              style={{
                borderColor: fixada ? ACCENT : "var(--border)",
                backgroundColor: fixada ? `${ACCENT}15` : "transparent",
                color: fixada ? ACCENT : "var(--text-secondary)",
              }}
              aria-pressed={fixada}
            >
              <Pin size={13} fill={fixada ? "currentColor" : "none"} />
              {fixada ? t("Fixada no topo") : t("Fixar no topo")}
            </button>
          </div>

          <div className="min-w-[180px]">
            <label className="stat-label mb-1.5 block">{t("Etiquetar artista")}</label>
            <select
              value={artistId ?? ""}
              onChange={(e) => setArtistId(e.target.value || null)}
              className="input w-full border border-border rounded-md px-3 py-2 bg-surface"
            >
              <option value="">{t("Sem artista")}</option>
              {artistas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {confirmador}
      {avisador}
    </div>
  );
}
