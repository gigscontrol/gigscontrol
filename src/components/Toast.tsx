"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";
import { useT } from "@/lib/i18n";

export type ToastTipo = "sucesso" | "info" | "alerta" | "erro";

type Props = {
  open: boolean;
  mensagem: string;
  tipo?: ToastTipo;
  /** Duração em ms antes de auto-fechar. 0 = não auto-fecha. */
  duracao?: number;
  /** Texto do botão de ação (opcional). */
  acaoLabel?: string;
  onAcao?: () => void;
  onClose: () => void;
};

const CONFIG: Record<
  ToastTipo,
  { icon: typeof CheckCircle2; cor: string; bg: string }
> = {
  sucesso: { icon: CheckCircle2, cor: "var(--success)", bg: "var(--success-weak)" },
  info:    { icon: Info,         cor: "var(--info)", bg: "var(--info-weak)" },
  alerta:  { icon: AlertTriangle, cor: "var(--warning)", bg: "var(--warning-weak)" },
  erro:    { icon: XCircle,      cor: "var(--danger)",  bg: "var(--danger-weak)" },
};

/**
 * Toast in-app. Render bottom-right, auto-close em `duracao` ms.
 * Substitui `alert()` nativo onde o feedback é só informativo.
 */
export default function Toast({
  open,
  mensagem,
  tipo = "sucesso",
  duracao = 3000,
  acaoLabel,
  onAcao,
  onClose,
}: Props) {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || duracao <= 0) return;
    const t = setTimeout(onClose, duracao);
    return () => clearTimeout(t);
  }, [open, duracao, onClose]);

  if (!open || !mounted) return null;

  const { icon: Icon, cor, bg } = CONFIG[tipo];

  const content = (
    <div
      className="fixed bottom-6 right-6 max-w-sm bg-surface border border-border rounded-md shadow-xl flex items-center gap-3 px-4 py-3 animate-in"
      style={{ zIndex: 10000, boxShadow: "0 12px 30px var(--shadow-color)" }}
      role="status"
      aria-live="polite"
    >
      <div
        className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: bg, color: cor }}
      >
        <Icon size={16} />
      </div>
      <div className="flex-1 text-sm text-primary">{mensagem}</div>
      {acaoLabel && onAcao && (
        <button
          onClick={onAcao}
          className="btn-ghost text-xs font-semibold flex-shrink-0"
          style={{ color: cor }}
        >
          {acaoLabel}
        </button>
      )}
      <button
        onClick={onClose}
        aria-label={t("Fechar")}
        className="text-muted hover:text-primary transition-colors flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );

  return createPortal(content, document.body);
}
