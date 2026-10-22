"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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

  const content = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 animate-fade"
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
        className="relative w-full bg-surface border border-border rounded-lg overflow-hidden animate-modal"
        style={{ maxWidth, boxShadow: "0 24px 60px var(--shadow-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
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
        <div className="p-5 max-h-[calc(100vh-100px)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
