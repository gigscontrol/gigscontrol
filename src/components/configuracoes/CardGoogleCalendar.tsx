"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, Loader2, Plug, Unplug } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

/**
 * Card "Google Calendar" no perfil do artista (read-only console).
 *
 * Mostra o status da conexão (✓ Conectado: email / não conectado) e, pro
 * admin, os botões de conectar / desconectar. O fluxo OAuth abre no próprio
 * navegador (redireciona pro Google e volta pro /callback, que volta pra cá
 * com ?google=ok). Os tokens ficam só no servidor — aqui só lidamos com o
 * e-mail.
 */
type Estado = "carregando" | "conectado" | "desconectado";

export default function CardGoogleCalendar({ artistaId }: { artistaId: string }) {
  const { sessao } = useAuth();
  const isAdmin = sessao?.usuario?.papel === "admin";

  const [estado, setEstado] = useState<Estado>("carregando");
  const [email, setEmail] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setEstado("carregando");
    setErro(null);
    try {
      const res = await fetch(
        `/api/google/connection?artistaId=${encodeURIComponent(artistaId)}`,
        { credentials: "include", cache: "no-store" }
      );
      const d = await res.json();
      if (d?.conectado) {
        setEmail(d.email ?? null);
        setEstado("conectado");
      } else {
        setEmail(null);
        setEstado("desconectado");
      }
    } catch {
      setEstado("desconectado");
    }
  }, [artistaId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function conectar() {
    setOcupado(true);
    setErro(null);
    try {
      const res = await fetch("/api/google/connect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistaId }),
      });
      const d = await res.json();
      if (!res.ok || !d?.url) {
        throw new Error(d?.erro ?? "Falha ao iniciar a conexão.");
      }
      // Redireciona pro consentimento do Google (volta pelo /callback).
      window.location.href = d.url as string;
    } catch (e) {
      setErro((e as Error).message);
      setOcupado(false);
    }
  }

  async function desconectar() {
    if (
      !window.confirm(
        "Desconectar o Google Calendar deste artista? Os próximos shows não serão mais sincronizados."
      )
    ) {
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      const res = await fetch(
        `/api/google/connection?artistaId=${encodeURIComponent(artistaId)}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.erro ?? "Falha ao desconectar.");
      }
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
        <CalendarClock size={12} style={{ color: "var(--module-agencia)" }} />
        Google Calendar
      </div>

      {estado === "carregando" ? (
        <div className="text-sm text-muted inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Verificando…
        </div>
      ) : estado === "conectado" ? (
        <>
          <div className="flex items-center gap-2">
            <span
              className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "var(--success)" }}
            >
              <Check size={14} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-primary">Conectado</div>
              <div className="text-xs text-muted truncate" title={email ?? undefined}>
                {email ?? "conta Google"}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted">
            Os shows deste artista entram no Google Agenda automaticamente ao
            concretizar a venda.
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={desconectar}
              disabled={ocupado}
              className="inline-flex items-center gap-1.5 self-start text-xs font-medium disabled:opacity-50"
              style={{ color: "var(--danger)" }}
            >
              {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Unplug size={13} />}
              Desconectar
            </button>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-secondary">
            Conecte uma conta Google pra sincronizar os shows deste artista
            automaticamente.
          </p>
          {isAdmin ? (
            <button
              type="button"
              onClick={conectar}
              disabled={ocupado}
              className="inline-flex items-center gap-2 self-start px-3 py-2 rounded-md text-sm font-medium border transition-colors disabled:opacity-50"
              style={{ borderColor: "var(--module-agencia)", color: "var(--module-agencia)" }}
            >
              {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
              Conectar conta Google
            </button>
          ) : (
            <p className="text-xs text-muted">Só o admin pode conectar.</p>
          )}
        </>
      )}

      {erro && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {erro}
        </p>
      )}
    </div>
  );
}
