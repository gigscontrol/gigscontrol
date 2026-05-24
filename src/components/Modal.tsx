"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: number;
};

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 560,
}: Props) {
  // Garante que só rendemos no client (Next.js SSR pode quebrar com Portal)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const content = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 animate-fade"
      style={{ zIndex: 9999 }}
    >
      <button
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full bg-surface border border-border rounded-lg overflow-hidden animate-in"
        style={{ maxWidth, boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
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
              aria-label="Fechar modal"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          // Sem barra: botão de fechar flutuante no topo direito
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 btn-ghost p-1.5 rounded-full bg-surface/80 backdrop-blur-sm"
            aria-label="Fechar modal"
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
