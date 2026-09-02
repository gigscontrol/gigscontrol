"use client";

import { useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";
import Toast, { type ToastTipo } from "./Toast";
import { useT } from "@/lib/i18n";

export type ConfirmarOpcoes = {
  titulo: string;
  /** Sem `mensagem`, entra um padrão: perigo → "Esta ação não pode ser
   *  desfeita."; senão → "Deseja continuar?" (o corpo nunca fica vazio). */
  mensagem?: ReactNode;
  /** Trecho do conteúdo afetado (ex.: o texto do item a remover) — aparece
   *  como citação abaixo da mensagem, pra pessoa VER o que vai perder. */
  trecho?: string;
  confirmarLabel?: string;
  cancelarLabel?: string;
  /** true = ação destrutiva (vermelho) */
  perigo?: boolean;
};

/**
 * Modal controlado — pra quem quiser render manual (fora do hook `useConfirmar`).
 * Irmão visual do ConfirmarSaidaModal: ícone redondo à esquerda, texto, botões à direita.
 */
export default function ConfirmarModal({
  aberto,
  onResposta,
  titulo,
  mensagem,
  trecho,
  confirmarLabel,
  cancelarLabel,
  perigo,
}: ConfirmarOpcoes & {
  aberto: boolean;
  onResposta: (ok: boolean) => void;
}) {
  const t = useT();
  if (!aberto) return null;

  const cor = perigo ? "var(--danger)" : "var(--warning)";
  const bg = perigo ? "var(--danger-weak)" : "rgba(245,158,11,0.12)";
  // Corpo nunca fica só com o ícone: sem mensagem, entra o padrão.
  const corpo =
    mensagem ??
    (perigo ? t("Esta ação não pode ser desfeita.") : t("Deseja continuar?"));

  return (
    <Modal isOpen onClose={() => onResposta(false)} title={titulo} maxWidth={440}>
      <div className="flex items-start gap-3">
        <span
          className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: bg, color: cor }}
        >
          <AlertTriangle size={19} />
        </span>
        <div className="min-w-0 flex-1 flex flex-col gap-2.5">
          <div className="text-sm text-secondary leading-relaxed">{corpo}</div>
          {trecho?.trim() && (
            <blockquote
              className="text-xs italic leading-relaxed rounded-md px-3 py-2"
              style={{
                border: "1px solid var(--border-color)",
                borderLeft: `3px solid ${cor}`,
                backgroundColor: "var(--bg-elevated)",
                color: "var(--text-muted)",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              “{trecho.trim()}”
            </blockquote>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 flex-wrap mt-5">
        <button
          onClick={() => onResposta(false)}
          className="btn btn-secondary text-sm"
        >
          {cancelarLabel ?? t("Cancelar")}
        </button>
        {perigo ? (
          <button
            onClick={() => onResposta(true)}
            className="btn text-sm"
            style={{ backgroundColor: "var(--danger)", color: "#fff" }}
          >
            {confirmarLabel ?? t("Confirmar")}
          </button>
        ) : (
          <button
            onClick={() => onResposta(true)}
            className="btn btn-primary text-sm"
          >
            {confirmarLabel ?? t("Confirmar")}
          </button>
        )}
      </div>
    </Modal>
  );
}

/** Substituto 1-pra-1 do window.confirm — render `{confirmador}` uma vez no JSX. */
export function useConfirmar(): {
  confirmar: (op: ConfirmarOpcoes) => Promise<boolean>;
  confirmador: ReactNode;
} {
  const [op, setOp] = useState<ConfirmarOpcoes | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  function confirmar(novaOp: ConfirmarOpcoes): Promise<boolean> {
    // Se já havia um pendente, resolve ele com false antes de abrir o novo.
    resolver.current?.(false);
    return new Promise((resolve) => {
      resolver.current = resolve;
      setOp(novaOp);
    });
  }

  function responder(ok: boolean) {
    setOp(null);
    const r = resolver.current;
    resolver.current = null;
    r?.(ok);
  }

  const confirmador = op ? (
    <ConfirmarModal aberto onResposta={responder} {...op} />
  ) : null;

  return { confirmar, confirmador };
}

/** Substituto do window.alert informativo — embrulha o Toast existente. */
export function useAviso(): {
  avisar: (mensagem: string, tipo?: ToastTipo) => void;
  avisador: ReactNode;
} {
  const [estado, setEstado] = useState<{ mensagem: string; tipo: ToastTipo } | null>(null);

  function avisar(mensagem: string, tipo: ToastTipo = "erro") {
    setEstado({ mensagem, tipo });
  }

  function fechar() {
    setEstado(null);
  }

  const avisador = estado ? (
    <Toast
      open
      mensagem={estado.mensagem}
      tipo={estado.tipo}
      duracao={estado.tipo === "erro" ? 5000 : 3000}
      onClose={fechar}
    />
  ) : null;

  return { avisar, avisador };
}
