"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import type { Notificacao } from "@/lib/mappers/notificacao";

const POLL_INTERVAL_MS = 60_000;

type Props = {
  /** Chamado quando o usuário clica em "Ver todas" — abre Configurações. */
  onVerTodas?: () => void;
};

/**
 * Sino de notificações da topbar.
 *
 * Faz polling a cada 60s pra atualizar a contagem de não lidas. O
 * dropdown mostra as últimas 10 com possibilidade de marcar uma ou
 * todas como lidas.
 *
 * Self-contained: usa fetch direto pra `/api/notificacoes` em vez de
 * passar pelo workspace-context (mantém o context mais enxuto).
 */
export default function SinoNotificacoes({ onVerTodas }: Props) {
  const [aberto, setAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/notificacoes?limit=10", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao carregar notificações.");
      const body = await res.json();
      setNotificacoes((body.notificacoes as Notificacao[]) ?? []);
      setNaoLidas((body.naoLidas as number) ?? 0);
    } catch {
      // Silencioso: notificação é "best-effort" no front
    } finally {
      setCarregando(false);
    }
  }, []);

  // Carrega na montagem + polling
  useEffect(() => {
    void carregar();
    const timer = setInterval(() => {
      void carregar();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [carregar]);

  // Recarrega quando o dropdown abre (pra pegar fresco)
  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [aberto]);

  async function aoMarcarLida(id: string) {
    // Optimistic update
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lidaEm: new Date().toISOString() } : n))
    );
    setNaoLidas((c) => Math.max(0, c - 1));
    try {
      await fetch(`/api/notificacoes/${id}/marcar-lida`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Em caso de erro, recarrega pra ressincronizar
      void carregar();
    }
  }

  async function aoMarcarTodas() {
    if (naoLidas === 0) return;
    setNotificacoes((prev) =>
      prev.map((n) => ({ ...n, lidaEm: n.lidaEm ?? new Date().toISOString() }))
    );
    setNaoLidas(0);
    try {
      await fetch("/api/notificacoes/marcar-todas-lidas", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      void carregar();
    }
  }

  const badge = useMemo(() => {
    if (naoLidas === 0) return null;
    return naoLidas > 9 ? "9+" : String(naoLidas);
  }, [naoLidas]);

  return (
    <div ref={popoverRef} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className="btn-ghost relative p-2 rounded"
        aria-label="Notificações"
        aria-haspopup="true"
        aria-expanded={aberto}
      >
        <Bell size={18} />
        {badge && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[0.6rem] font-bold text-white"
            style={{ backgroundColor: "var(--danger)" }}
          >
            {badge}
          </span>
        )}
      </button>

      {aberto && (
        <div
          className="absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-32px)] bg-surface border border-border rounded-lg overflow-hidden z-50 animate-in"
          style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-secondary" />
              <span className="text-sm font-semibold text-primary">Notificações</span>
              {naoLidas > 0 && (
                <span
                  className="text-[0.65rem] font-bold px-1.5 py-0.5 rounded text-white"
                  style={{ backgroundColor: "var(--danger)" }}
                >
                  {naoLidas} nova{naoLidas === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {naoLidas > 0 && (
              <button
                onClick={aoMarcarTodas}
                className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted hover:text-primary inline-flex items-center gap-1"
                title="Marcar todas como lidas"
              >
                <CheckCheck size={12} />
                Marcar todas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
            {carregando && notificacoes.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted">Carregando...</div>
            ) : notificacoes.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted">
                Nenhuma notificação ainda.
              </div>
            ) : (
              notificacoes.map((n) => (
                <LinhaNotificacao
                  key={n.id}
                  notificacao={n}
                  onMarcarLida={() => aoMarcarLida(n.id)}
                />
              ))
            )}
          </div>

          {/* Rodapé */}
          {onVerTodas && (
            <div className="p-3 border-t border-border text-center">
              <button
                onClick={() => {
                  setAberto(false);
                  onVerTodas();
                }}
                className="text-xs text-muted hover:text-primary"
              >
                Ver todas em Configurações → Notificações
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LinhaNotificacao({
  notificacao,
  onMarcarLida,
}: {
  notificacao: Notificacao;
  onMarcarLida: () => void;
}) {
  const lida = !!notificacao.lidaEm;

  const corTipo = (() => {
    switch (notificacao.tipo) {
      case "sucesso": return "var(--success)";
      case "aviso":   return "var(--warning)";
      case "alerta":  return "var(--danger)";
      default:        return "var(--module-vendas)";
    }
  })();

  return (
    <div
      className="px-3 py-3 flex items-start gap-3 hover:bg-elevated/40 transition-colors"
      style={{ opacity: lida ? 0.6 : 1 }}
    >
      <span
        className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5"
        style={{ backgroundColor: lida ? "transparent" : corTipo }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-primary truncate">
          {notificacao.titulo}
        </div>
        <div className="text-xs text-secondary mt-0.5 break-words">
          {notificacao.mensagem}
        </div>
        <div className="text-[0.65rem] text-muted mt-1">
          {formatarTempoRelativo(notificacao.criadoEm)}
        </div>
      </div>
      {!lida && (
        <button
          onClick={onMarcarLida}
          className="btn-ghost p-1 rounded text-muted hover:text-primary flex-shrink-0"
          title="Marcar como lida"
          aria-label="Marcar como lida"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

function formatarTempoRelativo(iso: string): string {
  const data = new Date(iso);
  const diffMs = Date.now() - data.getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return "agora há pouco";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `há ${dias} dia${dias === 1 ? "" : "s"}`;
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
