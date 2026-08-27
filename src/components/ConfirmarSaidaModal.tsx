"use client";

import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";
import { useT } from "@/lib/i18n";

/**
 * Popup de "alterações não salvas". Aparece quando o usuário tenta sair de
 * uma tela de edição (navegar pra outro lugar da dashboard ou cancelar) com
 * mudanças pendentes.
 *
 * - Descartar → sai perdendo as alterações.
 * - Salvar e sair → salva e, se der certo, sai.
 * - Fechar (X / clique-fora / ESC) → CANCELA a saída (fica editando).
 */
export default function ConfirmarSaidaModal({
  salvando,
  podeSalvar = true,
  onCancelar,
  onDescartar,
  onSalvarESair,
}: {
  /** Trava os botões enquanto o "Salvar e sair" está em andamento. */
  salvando: boolean;
  /** false em telas sem rascunho persistível (wizards) — esconde "Salvar e sair". */
  podeSalvar?: boolean;
  /** Fechar sem sair (X, clique-fora, ESC). */
  onCancelar: () => void;
  /** Sair perdendo as alterações. */
  onDescartar: () => void;
  /** Salvar e então sair (o salvar valida antes). */
  onSalvarESair: () => void;
}) {
  const t = useT();
  return (
    <Modal
      isOpen
      onClose={onCancelar}
      title={t("Você tem alterações não salvas")}
      maxWidth={420}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: "rgba(245,158,11,0.12)",
            color: "var(--warning)",
          }}
        >
          <AlertTriangle size={18} />
        </span>
        <p className="text-sm text-secondary leading-relaxed">
          {t("Se sair agora, suas alterações serão perdidas. O que deseja fazer?")}
        </p>
      </div>
      <div className="flex items-center justify-end gap-2 flex-wrap mt-5">
        <button
          onClick={onDescartar}
          disabled={salvando}
          className="btn btn-secondary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {t("Descartar")}
        </button>
        {podeSalvar ? (
          <button
            onClick={onSalvarESair}
            disabled={salvando}
            className="btn btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {salvando ? t("Salvando...") : t("Salvar e sair")}
          </button>
        ) : (
          <button
            onClick={onCancelar}
            className="btn btn-primary text-sm"
          >
            {t("Continuar editando")}
          </button>
        )}
      </div>
    </Modal>
  );
}
