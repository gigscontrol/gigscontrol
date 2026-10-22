"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useDialogo } from "@/lib/useDialogo";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Nome do diálogo pro leitor de tela quando não há `title` visível. */
  ariaLabel?: string;
  children: ReactNode;
  maxWidth?: number;
};

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  ariaLabel,
  children,
  maxWidth = 560,
}: Props) {
  const t = useT();
  const tituloId = useId();
  const subtituloId = useId();
  // Garante que só rendemos no client (Next.js SSR pode quebrar com Portal)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Foco, Tab, Esc, pilha de modais e trava de rolagem: lib/useDialogo.
  useDialogo(dialogRef, isOpen, onClose);

  if (!isOpen || !mounted) return null;

  // No celular (< 768 px) o modal é uma FOLHA que sobe do pé da tela, na
  // largura toda: centralizado com 16 px de margem, o formulário longo
  // passava da altura e o X e o "Salvar" saíam da tela. A altura agora
  // é do diálogo inteiro (título fixo, só o corpo rola) e usa dvh, que
  // desconta a barra do navegador. Do tablet pra cima continua no centro.
  const content = (
    <div
      className="fixed inset-0 flex items-end justify-center md:items-center md:p-4 animate-fade"
      style={{ zIndex: 9999 }}
    >
      <button
        aria-label={t("Fechar")}
        onClick={onClose}
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? tituloId : undefined}
        aria-label={title ? undefined : ariaLabel}
        aria-describedby={title && subtitle ? subtituloId : undefined}
        tabIndex={-1}
        className="relative flex w-full flex-col overflow-hidden border border-b-0 border-border bg-surface rounded-t-xl max-h-[calc(100dvh-1.5rem)] md:max-w-[var(--largura-modal)] md:max-h-[calc(100dvh-2rem)] md:rounded-lg md:border-b animate-dialogo"
        style={{ "--largura-modal": `${maxWidth}px`, boxShadow: "0 24px 60px var(--shadow-color)" } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="flex flex-shrink-0 items-start justify-between gap-4 p-5 border-b border-border">
            <div className="min-w-0">
              <h2 id={tituloId} className="section-title">{title}</h2>
              {subtitle && (
                <div id={subtituloId} className="section-subtitle mt-0.5">
                  {subtitle}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="btn-ghost p-1.5 rounded flex-shrink-0"
              aria-label={t("Fechar modal")}
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          // Sem barra: botão de fechar flutuante no topo direito
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 btn-ghost p-1.5 rounded-md bg-surface/80 backdrop-blur-sm"
            aria-label={t("Fechar modal")}
          >
            <X size={18} />
          </button>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
