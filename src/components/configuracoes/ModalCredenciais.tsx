"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { Copy, CheckCircle2 } from "lucide-react";

// ============================================================
// Modal — Credenciais geradas (mostradas uma única vez)
// ============================================================

export function ModalCredenciais({
  nomeArtista,
  username,
  senha,
  onFechar,
}: {
  nomeArtista: string;
  username: string;
  senha: string;
  onFechar: () => void;
}) {
  const t = useT();
  const [copiou, setCopiou] = useState<"user" | "pass" | "ambos" | null>(null);
  const mostraUsuario = username !== "—";

  function copiar(texto: string, qual: "user" | "pass" | "ambos") {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiou(qual);
      setTimeout(() => setCopiou(null), 2000);
    });
  }

  // Texto consolidado pra copiar tudo de uma vez — formato pronto pra
  // colar no WhatsApp do artista.
  const textoCompleto = mostraUsuario
    ? `Login: ${username}\nSenha: ${senha}`
    : `Senha: ${senha}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--overlay-scrim)" }}
    >
      <div
        className="bg-surface border border-border rounded w-full max-w-[420px]"
        style={{ boxShadow: "0 24px 60px var(--shadow-color)" }}
      >
        <div className="p-5 border-b border-border flex flex-col items-center text-center">
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center mb-3"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--success) 20%, transparent), var(--success-weak))",
              color: "var(--success)",
            }}
          >
            <CheckCircle2 size={24} />
          </div>
          <div className="section-title">
            {mostraUsuario ? t("Artista cadastrado") : t("Senha redefinida")}
          </div>
          <div className="text-xs text-secondary mt-1">
            {mostraUsuario
              ? t("Copie e mande pro {nome}. Aparece só uma vez.", { nome: nomeArtista })
              : t("Nova senha do {nome}. Copie agora — aparece só uma vez.", { nome: nomeArtista })}
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {mostraUsuario && (
            <div>
              <div className="text-xs font-medium text-secondary mb-1">{t("Login")}</div>
              <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                <span className="font-mono text-sm text-primary flex-1 break-all">
                  {username}
                </span>
                <button
                  onClick={() => copiar(username, "user")}
                  className="btn-ghost p-1.5 rounded"
                >
                  {copiou === "user" ? (
                    <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-medium text-secondary mb-1">{t("Senha")}</div>
            <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
              <span className="font-mono text-sm text-primary flex-1 break-all">
                {senha}
              </span>
              <button
                onClick={() => copiar(senha, "pass")}
                className="btn-ghost p-1.5 rounded"
              >
                {copiou === "pass" ? (
                  <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
          </div>

          <div
            className="text-xs rounded-md px-3 py-2 mt-1"
            style={{
              backgroundColor: "var(--warning-weak)",
              color: "var(--warning)",
              border: "1px solid color-mix(in srgb, var(--warning) 20%, transparent)",
            }}
          >
            <strong>{t("Importante:")}</strong> {t("essas credenciais não ficam salvas. Se fechar essa janela, vai precisar gerar nova senha.")}
          </div>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => copiar(textoCompleto, "ambos")}
            className="btn btn-secondary text-sm inline-flex items-center gap-1.5"
          >
            {copiou === "ambos" ? (
              <>
                <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                {t("Copiado!")}
              </>
            ) : (
              <>
                <Copy size={14} />
                {mostraUsuario ? t("Copiar login + senha") : t("Copiar senha")}
              </>
            )}
          </button>
          <button onClick={onFechar} className="btn btn-primary text-sm">
            {t("Entendi, fechar")}
          </button>
        </div>
      </div>
    </div>
  );
}
