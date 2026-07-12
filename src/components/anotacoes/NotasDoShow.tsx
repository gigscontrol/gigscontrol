"use client";

import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { useAnotacoes } from "@/lib/anotacoes-context";
import { useAuth } from "@/lib/auth-context";
import { MODULE_THEMES } from "@/types";
import NotaChat, { useEquipe } from "./NotaChat";
import { useT } from "@/lib/i18n";

const ACCENT = MODULE_THEMES.agenda.color;
const MAX_POR_SHOW = 4;

/**
 * Thread de anotações de um SHOW (estilo grupo de WhatsApp) + compose.
 * Máximo de 4 notas por show (o servidor também valida). Editar/excluir =
 * só o autor (admin qualquer). Usada no modal do show e na página Anotações.
 */
export default function NotasDoShow({ showId }: { showId: string }) {
  const t = useT();
  const { sessao } = useAuth();
  const { notas, addNota, updateNota, removeNota } = useAnotacoes();
  const equipe = useEquipe();

  const meuId = sessao?.usuario?.id ?? "";
  const souAdmin = sessao?.usuario?.papel === "admin" || sessao?.tipo === "super-admin";
  const nomeDe = (id?: string) => equipe.find((u) => u.id === id)?.nome ?? "—";
  const corDe = (id?: string) => equipe.find((u) => u.id === id)?.cor ?? "#8892a6";

  const doShow = useMemo(
    () =>
      notas
        .filter((n) => n.showId === showId)
        .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)),
    [notas, showId]
  );
  const cheio = doShow.length >= MAX_POR_SHOW;

  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    const conteudo = texto.trim();
    if (!conteudo || enviando || cheio) return;
    setEnviando(true);
    try {
      await addNota({ show_id: showId, conteudo });
      setTexto("");
    } catch (e) {
      window.alert((e as Error).message || t("Falha ao salvar."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {doShow.length === 0 ? (
        <div className="text-sm text-muted text-center py-3">
          {t("Nenhuma anotação neste show ainda.")}
        </div>
      ) : (
        doShow.map((n) => (
          <NotaChat
            key={n.id}
            nota={n}
            minha={n.criadoPor === meuId}
            nome={n.criadoPor === meuId ? t("Você") : nomeDe(n.criadoPor)}
            cor={corDe(n.criadoPor)}
            accent={ACCENT}
            podeMexer={souAdmin || n.criadoPor === meuId}
            onSalvar={(conteudo) => updateNota(n.id, { conteudo }).then(() => undefined)}
            onExcluir={() => removeNota(n.id).catch(() => undefined)}
          />
        ))
      )}

      {/* Compose — barra de composição; some quando bate o teto */}
      {cheio ? (
        <div className="text-xs text-muted text-center py-2 mt-1 rounded-md border border-border bg-surface-2">
          {t("Limite de {n} anotações por show atingido.", { n: MAX_POR_SHOW })}
        </div>
      ) : (
        <div className="mt-1 rounded-lg border border-border bg-surface-2 p-2.5 flex items-end gap-2 flex-wrap sm:flex-nowrap focus-within:border-border-strong transition-colors">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") enviar();
            }}
            placeholder={t("Escreva uma anotação sobre o show...")}
            className="input flex-1 basis-full sm:basis-auto min-w-0 min-h-[44px] max-h-[120px] resize-y border border-border rounded-md p-2 bg-surface"
            rows={1}
          />
          <button
            onClick={enviar}
            disabled={!texto.trim() || enviando}
            className="btn btn-primary disabled:opacity-50 flex-shrink-0 ml-auto sm:ml-0"
            aria-label={t("Adicionar")}
          >
            <Send size={14} />
          </button>
        </div>
      )}
      <div className="text-[0.65rem] text-muted text-right tabular-nums">
        {doShow.length}/{MAX_POR_SHOW}
      </div>
    </div>
  );
}
