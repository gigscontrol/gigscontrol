"use client";

import { Pin, Music } from "lucide-react";
import type { Anotacao } from "@/lib/mappers/anotacoes";
import { MODULE_THEMES } from "@/types";
import { fmtQuando } from "./anotacoesShared";
import { useT } from "@/lib/i18n";

const ACCENT = MODULE_THEMES.agenda.color;

/**
 * Card escaneável de uma nota-DOCUMENTO (não bolha de chat). Mostra o título
 * (com fallback pras notas antigas sem título = primeiras palavras do corpo),
 * um trecho de 2 linhas, a cor, 📌 se fixada, o artista etiquetado e o rodapé
 * de autoria. Clicar abre a nota no editor.
 */

/** Tira o markdown leve pra ter texto puro no título-fallback e no trecho. */
function textoPlano(md: string): string {
  return (md ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>`~]/g, " ")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tituloFallback(nota: Anotacao, semTitulo: string): string {
  if (nota.titulo && nota.titulo.trim()) return nota.titulo.trim();
  const plano = textoPlano(nota.conteudo);
  if (!plano) return semTitulo;
  return plano.length > 70 ? `${plano.slice(0, 70)}…` : plano;
}

export default function NotaCard({
  nota,
  autorNome,
  editorNome,
  artistaNome,
  corBorda,
  onAbrir,
}: {
  nota: Anotacao;
  autorNome: string;
  /** Nome de quem editou por último (só quando a nota foi de fato editada). */
  editorNome?: string | null;
  /** Rótulo do artista etiquetado (contexto), quando houver. */
  artistaNome?: string | null;
  /** Cor da barra lateral (cor da nota → cor da pasta → accent). */
  corBorda: string;
  onAbrir: () => void;
}) {
  const t = useT();
  const titulo = tituloFallback(nota, t("Sem título"));
  const trecho = textoPlano(nota.conteudo);
  const editado = !!editorNome && nota.atualizadoEm !== nota.criadoEm;
  const quando = fmtQuando(editado ? nota.atualizadoEm : nota.criadoEm);

  return (
    <button
      onClick={onAbrir}
      className="card text-left w-full transition-transform hover:-translate-y-0.5 active:translate-y-0"
      style={{ borderLeft: `3px solid ${corBorda}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {nota.fixada && (
            <Pin size={13} fill="currentColor" style={{ color: ACCENT }} className="flex-shrink-0" />
          )}
          <span className="section-title truncate">{titulo}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {nota.cor && (
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: nota.cor }}
              aria-hidden
            />
          )}
          {artistaNome && (
            <span className="badge badge-neutral inline-flex items-center gap-1 max-w-[140px]">
              <Music size={10} className="flex-shrink-0" />
              <span className="truncate">{artistaNome}</span>
            </span>
          )}
        </div>
      </div>

      {trecho && (
        <p
          className="text-sm text-muted mt-1.5"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {trecho}
        </p>
      )}

      <div className="text-xs text-muted mt-2 truncate">
        {t("criado por {nome}", { nome: autorNome })}
        {editado && ` · ${t("editado por {nome}", { nome: editorNome ?? "—" })}`}
        {quando && ` · ${quando}`}
      </div>
    </button>
  );
}
