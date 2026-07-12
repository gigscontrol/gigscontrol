"use client";

import { useEffect, useState } from "react";
import { Pin, Pencil, Trash2, X, Check } from "lucide-react";
import type { Anotacao } from "@/lib/mappers/anotacoes";
import { renderMarkdownSeguro } from "./markdownSeguro";
import { useT } from "@/lib/i18n";

/**
 * Bolha de nota estilo grupo de WhatsApp: avatar redondo de quem mandou,
 * nome colorido, conteúdo (markdown seguro) e horário no rodapé. As MINHAS
 * notas alinham à direita (tint do accent); as dos outros à esquerda.
 * Edição inline dentro da própria bolha (só autor/admin — decidido pelo pai).
 */

export type UsuarioResumo = { id: string; nome: string; cor?: string };

/** Lista enxuta da equipe (id/nome/cor) pros avatares. */
export function useEquipe(): UsuarioResumo[] {
  const [usuarios, setUsuarios] = useState<UsuarioResumo[]>([]);
  useEffect(() => {
    fetch("/api/usuarios", { credentials: "include" })
      .then((r) => r.json())
      .then((b) => setUsuarios((b.usuarios as UsuarioResumo[]) ?? []))
      .catch(() => undefined);
  }, []);
  return usuarios;
}

export function fmtQuando(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hoje = new Date();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hoje.toDateString()) return hora;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`;
}

export default function NotaChat({
  nota,
  minha,
  nome,
  cor,
  accent,
  podeMexer,
  onTogglePin,
  onSalvar,
  onExcluir,
}: {
  nota: Anotacao;
  minha: boolean;
  nome: string;
  /** Cor do avatar (cor do usuário). */
  cor: string;
  accent: string;
  podeMexer: boolean;
  /** Ausente = sem botão de fixar (ex.: notas de show). */
  onTogglePin?: () => void;
  onSalvar: (conteudo: string) => Promise<void>;
  onExcluir: () => void;
}) {
  const t = useT();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nota.conteudo);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const conteudo = texto.trim();
    if (!conteudo || salvando) return;
    setSalvando(true);
    try {
      await onSalvar(conteudo);
      setEditando(false);
    } catch (e) {
      window.alert((e as Error).message || t("Falha ao salvar."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className={`flex gap-2 items-end ${minha ? "flex-row-reverse" : ""}`}>
      {/* Avatar redondo de quem mandou */}
      <span
        className="h-8 w-8 rounded-full flex items-center justify-center text-[0.65rem] font-bold flex-shrink-0 mb-0.5"
        style={{ backgroundColor: cor, color: "#fff" }}
        title={nome}
      >
        {nome.slice(0, 2).toUpperCase()}
      </span>

      {/* Bolha — minha (direita, tint accent forte) vs alheia (esquerda, elevated) */}
      <div
        className={`max-w-[85%] min-w-[180px] rounded-xl px-3 py-2 border ${
          minha ? "rounded-br-sm" : "rounded-bl-sm"
        }`}
        style={{
          backgroundColor: minha ? `${accent}2E` : "var(--surface-3)",
          borderColor: nota.fixada
            ? accent
            : minha
            ? `${accent}66`
            : "var(--border-strong)",
          borderWidth: nota.fixada ? "1.5px" : undefined,
          ...(nota.cor ? { borderLeft: `3px solid ${nota.cor}` } : {}),
        }}
      >
        {/* Header: nome + ações */}
        <div className="flex items-center justify-between gap-3 mb-0.5">
          <span className="text-xs font-semibold truncate inline-flex items-center gap-1" style={{ color: minha ? accent : cor }}>
            {nome}
            {nota.fixada && (
              <span
                className="badge inline-flex items-center gap-0.5 px-1.5 py-0.5"
                style={{ color: accent, backgroundColor: `${accent}22` }}
              >
                <Pin size={9} fill="currentColor" />
                {t("Fixada")}
              </span>
            )}
          </span>
          <span className="flex items-center gap-0.5 flex-shrink-0">
            {onTogglePin && (
              <button
                onClick={onTogglePin}
                className={`p-1 rounded hover:bg-surface transition-colors ${nota.fixada ? "" : "text-muted"}`}
                style={nota.fixada ? { color: accent } : undefined}
                title={nota.fixada ? t("Desafixar") : t("Fixar")}
                aria-label={nota.fixada ? t("Desafixar") : t("Fixar")}
              >
                <Pin size={12} fill={nota.fixada ? "currentColor" : "none"} />
              </button>
            )}
            {podeMexer && (
              <>
                <button
                  onClick={() => {
                    setTexto(nota.conteudo);
                    setEditando(true);
                  }}
                  className="p-1 rounded text-muted hover:bg-surface hover:text-primary transition-colors"
                  title={t("Editar")}
                  aria-label={t("Editar")}
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(t("Excluir esta anotação?"))) onExcluir();
                  }}
                  className="p-1 rounded text-muted hover:bg-surface hover:text-primary transition-colors"
                  title={t("Excluir")}
                  aria-label={t("Excluir")}
                >
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </span>
        </div>

        {nota.titulo && <div className="text-sm font-semibold text-primary mb-0.5">{nota.titulo}</div>}

        {editando ? (
          <div className="flex flex-col gap-2 my-1">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="input min-h-[70px] resize-y border border-border rounded-md p-2 bg-surface w-full"
              autoFocus
            />
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setEditando(false)} className="btn btn-secondary text-xs">
                <X size={12} />
                {t("Cancelar")}
              </button>
              <button onClick={salvar} disabled={salvando} className="btn btn-primary text-xs">
                <Check size={12} />
                {t("Salvar")}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-secondary">{renderMarkdownSeguro(nota.conteudo)}</div>
        )}

        {/* Rodapé: horário (estilo WhatsApp) */}
        <div className="flex items-center justify-end gap-1 mt-0.5">
          {nota.atualizadoPor && nota.atualizadoEm !== nota.criadoEm && (
            <span className="text-[0.6rem] text-muted italic">{t("editado")}</span>
          )}
          <span className="text-[0.65rem] text-muted tabular-nums">{fmtQuando(nota.criadoEm)}</span>
        </div>
      </div>
    </div>
  );
}
