"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";

type Props = {
  papel: string;
  adminContato: string | null;
  plano: { id: string; nome: string } | null;
  ciclo: string;
};

/**
 * Banner do período de GRAÇA (1 dia após a renovação falhar / o trial acabar).
 * Acesso continua liberado; é só um aviso flutuante no topo. Admin tem o botão
 * "Renovar"; os demais (artista/equipe) só veem o aviso pra avisar o admin.
 */
export default function BannerPagamento({ papel, adminContato, plano, ciclo }: Props) {
  const t = useT();
  const [indo, setIndo] = useState(false);
  const isAdmin = papel === "admin";

  async function renovar() {
    if (indo || !plano) return;
    setIndo(true);
    try {
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: plano.id, ciclo }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.url) {
        window.location.href = body.url as string;
        return;
      }
    } catch {
      /* ignora */
    }
    setIndo(false);
  }

  return (
    <div className="fixed left-1/2 top-3 z-[60] max-w-[94vw] -translate-x-1/2">
      <div
        className="flex items-center gap-2.5 rounded-full border px-4 py-2 text-xs shadow-lg"
        style={{
          background: "color-mix(in srgb, var(--warning) 14%, var(--bg-surface))",
          borderColor: "color-mix(in srgb, var(--warning) 45%, transparent)",
          color: "var(--text-primary)",
        }}
      >
        <AlertTriangle
          size={15}
          style={{ color: "var(--warning)" }}
          className="flex-shrink-0"
        />
        <span className="truncate">
          {isAdmin
            ? t("Pagamento pendente — a renovação do plano falhou.")
            : adminContato
            ? t("Pagamento pendente — avise seu administrador ({nome}) sobre a renovação.", {
                nome: adminContato,
              })
            : t("Pagamento pendente — avise seu administrador sobre a renovação.")}
        </span>
        {isAdmin && (
          <button
            onClick={renovar}
            disabled={indo}
            className="flex-shrink-0 rounded-full px-3 py-1 text-[0.7rem] font-bold text-white disabled:opacity-60"
            style={{ background: "var(--warning)" }}
          >
            {indo ? <Loader2 size={13} className="animate-spin" /> : t("Renovar")}
          </button>
        )}
      </div>
    </div>
  );
}
