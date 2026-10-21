"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Mensagem do WhatsApp SEMPRE à vista, com "Copiar" e "Enviar pelo WhatsApp"
 * juntos no topo (pedido do Bruno, 21/10/2026). Uma peça só pra tela de
 * "Orçamento criado" e pro detalhe do orçamento — antes uma tinha o botão de
 * enviar solto no canto e a outra escondia a mensagem atrás de um clique.
 */
export default function PreviaWhatsApp({
  texto,
  linkWA,
  titulo,
}: {
  texto: string;
  linkWA: string;
  /** Lado esquerdo do topo (ex.: título da seção, artista + número). */
  titulo?: ReactNode;
}) {
  const t = useT();
  const [estado, setEstado] = useState<"" | "copiado" | "erro">("");

  function marcar(e: "copiado" | "erro") {
    setEstado(e);
    setTimeout(() => setEstado(""), 2000);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      marcar("copiado");
    } catch {
      // Navegador sem clipboard API (ou bloqueada): cópia pelo jeito antigo.
      const ta = document.createElement("textarea");
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        marcar("copiado");
      } catch {
        marcar("erro");
      }
      document.body.removeChild(ta);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">{titulo}</div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copiar}
            className="btn btn-secondary text-xs"
            style={
              estado === "copiado"
                ? { color: "var(--success)", borderColor: "var(--success)" }
                : estado === "erro"
                ? { color: "var(--danger)", borderColor: "var(--danger)" }
                : undefined
            }
          >
            {estado === "copiado" ? <Check size={12} /> : <Copy size={12} />}
            {estado === "copiado"
              ? t("Copiado!")
              : estado === "erro"
              ? t("Não foi possível copiar.")
              : t("Copiar")}
          </button>
          <a
            href={linkWA}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary text-xs"
            style={{ backgroundColor: "#25D366", color: "#fff" }}
          >
            <MessageCircle size={13} />
            {t("Enviar pelo WhatsApp")}
          </a>
        </div>
      </div>
      <pre className="bg-elevated border border-border rounded-md p-3 text-xs text-primary whitespace-pre-wrap font-sans">
        {texto}
      </pre>
      <div className="text-xs text-muted">
        * {t("Asteriscos viram")} <strong>{t("negrito")}</strong> {t("no WhatsApp.")}
      </div>
    </div>
  );
}
