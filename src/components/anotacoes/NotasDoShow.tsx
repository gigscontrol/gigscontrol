"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { useAnotacoes } from "@/lib/anotacoes-context";
import { useAuth } from "@/lib/auth-context";
import { useArtistas } from "@/lib/workspace-context";
import { MODULE_THEMES } from "@/types";
import type { Anotacao } from "@/lib/mappers/anotacoes";
import { renderMarkdownSeguro } from "./markdownSeguro";
import { useEquipe, fmtQuando } from "./anotacoesShared";
import NotaCard from "./NotaCard";
import { useT } from "@/lib/i18n";

const ACCENT = MODULE_THEMES.agenda.color;
const MAX_POR_SHOW = 4;

/**
 * Notas de um SHOW — cards-documento (não bolha de chat), igual às notas de
 * pasta. Máximo de 4 notas por show (o servidor também valida). Editar/excluir
 * = só o autor (admin qualquer); quem não pode mexer abre em modo leitura.
 * Usada no modal do show (ShowDetalheModal) e no modal da página Anotações.
 */
export default function NotasDoShow({ showId }: { showId: string }) {
  const t = useT();
  const { sessao } = useAuth();
  const { notas, addNota, updateNota, removeNota } = useAnotacoes();
  const equipe = useEquipe();
  const artistas = useArtistas();

  const meuId = sessao?.usuario?.id ?? "";
  const souAdmin = sessao?.usuario?.papel === "admin" || sessao?.tipo === "super-admin";
  const nomeDe = (id?: string) =>
    id === meuId ? t("Você") : equipe.find((u) => u.id === id)?.nome ?? "—";
  const artistaNomeDe = (id?: string | null) =>
    id ? artistas.find((a) => a.id === id)?.name ?? null : null;
  const podeMexer = (n: Anotacao) => souAdmin || n.criadoPor === meuId;

  const doShow = useMemo(
    () =>
      notas
        .filter((n) => n.showId === showId)
        .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)),
    [notas, showId]
  );
  const cheio = doShow.length >= MAX_POR_SHOW;

  // null = lista de cards; "nova" = criando; id = nota aberta (edição ou leitura)
  const [abertoId, setAbertoId] = useState<string | "nova" | null>(null);
  const notaAberta =
    abertoId && abertoId !== "nova" ? doShow.find((n) => n.id === abertoId) ?? null : null;

  const salvar = async (dados: { titulo: string; conteudo: string }) => {
    if (abertoId === "nova") {
      await addNota({ show_id: showId, titulo: dados.titulo || null, conteudo: dados.conteudo });
    } else if (notaAberta) {
      await updateNota(notaAberta.id, { titulo: dados.titulo || null, conteudo: dados.conteudo });
    }
    setAbertoId(null);
  };

  const excluir = async () => {
    if (!notaAberta) return;
    if (!window.confirm(t("Excluir esta anotação?"))) return;
    try {
      await removeNota(notaAberta.id);
      setAbertoId(null);
    } catch (e) {
      window.alert((e as Error).message || t("Falha ao excluir."));
    }
  };

  if (abertoId !== null) {
    return (
      <NotaShowEditor
        nota={notaAberta}
        somenteLeitura={!!notaAberta && !podeMexer(notaAberta)}
        onSalvar={salvar}
        onExcluir={notaAberta && podeMexer(notaAberta) ? excluir : undefined}
        onFechar={() => setAbertoId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {doShow.length === 0 ? (
        <div className="text-sm text-muted text-center py-3">
          {t("Nenhuma anotação neste show ainda.")}
        </div>
      ) : (
        doShow.map((n) => (
          <NotaCard
            key={n.id}
            nota={n}
            autorNome={nomeDe(n.criadoPor)}
            editorNome={n.atualizadoPor ? nomeDe(n.atualizadoPor) : null}
            artistaNome={artistaNomeDe(n.artistId)}
            corBorda={n.cor || ACCENT}
            onAbrir={() => setAbertoId(n.id)}
          />
        ))
      )}

      {cheio ? (
        <div className="text-xs text-muted text-center py-2 mt-1 rounded-md border border-border bg-surface-2">
          {t("Limite de {n} anotações por show atingido.", { n: MAX_POR_SHOW })}
        </div>
      ) : (
        <button
          onClick={() => setAbertoId("nova")}
          className="btn btn-secondary w-full justify-center mt-1"
        >
          <Plus size={14} />
          {t("Adicionar nota")}
        </button>
      )}
      <div className="text-[0.65rem] text-muted text-right tabular-nums">
        {doShow.length}/{MAX_POR_SHOW}
      </div>
    </div>
  );
}

// ============================================================
// Mini-editor inline: título opcional + corpo + Salvar (documento curto).
// Quando somenteLeitura, mostra o conteúdo renderizado sem campos de edição.
// ============================================================

function NotaShowEditor({
  nota,
  somenteLeitura,
  onSalvar,
  onExcluir,
  onFechar,
}: {
  nota: Anotacao | null;
  somenteLeitura: boolean;
  onSalvar: (dados: { titulo: string; conteudo: string }) => Promise<void>;
  onExcluir?: () => void;
  onFechar: () => void;
}) {
  const t = useT();
  const [titulo, setTitulo] = useState(nota?.titulo ?? "");
  const [conteudo, setConteudo] = useState(nota?.conteudo ?? "");
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const corpo = conteudo.trim();
    if (!corpo || salvando) return;
    setSalvando(true);
    try {
      await onSalvar({ titulo: titulo.trim(), conteudo: corpo });
    } catch (e) {
      window.alert((e as Error).message || t("Falha ao salvar."));
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <button onClick={onFechar} className="btn btn-secondary text-xs">
          <ArrowLeft size={13} />
          {t("Voltar")}
        </button>
        {!somenteLeitura && (
          <div className="flex items-center gap-1.5">
            {onExcluir && (
              <button
                onClick={onExcluir}
                className="btn btn-secondary text-xs"
                title={t("Excluir")}
                aria-label={t("Excluir")}
              >
                <Trash2 size={13} />
              </button>
            )}
            <button
              onClick={salvar}
              disabled={!conteudo.trim() || salvando}
              className="btn btn-primary text-xs disabled:opacity-50"
            >
              <Save size={13} />
              {salvando ? t("Salvando...") : t("Salvar")}
            </button>
          </div>
        )}
      </div>

      {somenteLeitura ? (
        <div className="card flex flex-col gap-2">
          {nota?.titulo && <div className="text-sm font-semibold text-primary">{nota.titulo}</div>}
          <div className="text-secondary text-sm">{renderMarkdownSeguro(nota?.conteudo ?? "")}</div>
          {nota && (
            <div className="text-[0.65rem] text-muted tabular-nums">{fmtQuando(nota.criadoEm)}</div>
          )}
        </div>
      ) : (
        <div className="card flex flex-col gap-2.5">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={t("Título (opcional)")}
            className="input w-full bg-transparent border-0 border-b border-border rounded-none px-0 py-1.5 text-sm font-semibold text-primary focus:border-border-strong"
            autoFocus
          />
          <textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            placeholder={t("Escreva o conteúdo... (aceita **negrito**, *itálico*, listas com - e links)")}
            className="input w-full min-h-[120px] resize-y border border-border rounded-md p-2.5 bg-surface leading-relaxed"
          />
        </div>
      )}
    </div>
  );
}
