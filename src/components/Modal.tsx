"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: number;
};

/** Seletor dos elementos que participam do ciclo de Tab dentro do dialog. */
const FOCAVEIS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 560,
}: Props) {
  const t = useT();
  // Garante que só rendemos no client (Next.js SSR pode quebrar com Portal)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // FOCUS TRAP (auditoria 27/08/2026): antes o Tab escapava pro fundo da
    // página. Ao abrir: foca o 1º elemento focável do dialog; Tab/Shift+Tab
    // circulam DENTRO dele; ao fechar: devolve o foco pra quem abriu.
    const focoAnterior = document.activeElement as HTMLElement | null;
    const focarPrimeiro = () => {
      const raiz = dialogRef.current;
      if (!raiz) return;
      const alvo = raiz.querySelector<HTMLElement>(FOCAVEIS);
      (alvo ?? raiz).focus();
    };
    // Depois do paint — o portal precisa existir no DOM.
    const id = requestAnimationFrame(focarPrimeiro);

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const raiz = dialogRef.current;
      if (!raiz) return;
      const focaveis = Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS));
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const ativo = document.activeElement;
      // Foco fora do dialog (ou nas pontas) → circula pra dentro.
      if (e.shiftKey) {
        if (ativo === primeiro || !raiz.contains(ativo)) {
          e.preventDefault();
          ultimo.focus();
        }
      } else if (ativo === ultimo || !raiz.contains(ativo)) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
      // Restaura o foco pra quem abriu o modal (se ainda está na página).
      if (focoAnterior && document.contains(focoAnterior)) focoAnterior.focus();
    };
  }, [isOpen, onClose]);

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
        tabIndex={-1}
        className="relative w-full bg-surface border border-border rounded-lg overflow-hidden animate-modal"
        style={{ maxWidth, boxShadow: "0 24px 60px var(--shadow-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
            <div className="min-w-0">
              <div className="section-title">{title}</div>
              {subtitle && <div className="section-subtitle mt-0.5">{subtitle}</div>}
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
            className="absolute top-3 right-3 z-10 btn-ghost p-1.5 rounded-full bg-surface/80 backdrop-blur-sm"
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
