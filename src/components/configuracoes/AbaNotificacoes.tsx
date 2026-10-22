"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import type { Notificacao } from "@/lib/mappers/notificacao";
import { linkDaNotificacao } from "@/lib/navegacao/rotas";
import { useNavegacaoOpcional } from "../NavOverlay";
import { formatarDataHora } from "@/lib/formatters";

const LIMIT = 50;

/**
 * Aba "Notificações" — lista completa.
 *
 * Mostra as notificações do usuário logado com paginação ("Carregar
 * mais") e filtro de não lidas. Diferente do sino do topbar (que
 * mostra só 10), aqui é a visão completa.
 */
export default function AbaNotificacoes() {
  const t = useT();
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [apenasNaoLidas, setApenasNaoLidas] = useState(false);
  const [offset, setOffset] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(
    async (resetar: boolean) => {
      setCarregando(true);
      setErro(null);
      try {
        const novoOffset = resetar ? 0 : offset;
        const qs = new URLSearchParams({
          limit: String(LIMIT),
          offset: String(novoOffset),
        });
        if (apenasNaoLidas) qs.set("apenasNaoLidas", "1");
        const res = await fetch(`/api/notificacoes?${qs.toString()}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(t("Falha ao carregar."));
        const body = await res.json();
        const novos = (body.notificacoes as Notificacao[]) ?? [];
        setItens((prev) => (resetar ? novos : [...prev, ...novos]));
        setNaoLidas((body.naoLidas as number) ?? 0);
        setOffset(novoOffset + novos.length);
        setTemMais(novos.length === LIMIT);
      } catch (e) {
        setErro((e as Error).message);
      } finally {
        setCarregando(false);
      }
    },
    [apenasNaoLidas, offset, t]
  );

  useEffect(() => {
    void carregar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apenasNaoLidas]);

  async function marcarLida(id: string) {
    setItens((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lidaEm: new Date().toISOString() } : n))
    );
    setNaoLidas((c) => Math.max(0, c - 1));
    try {
      await fetch(`/api/notificacoes/${id}/marcar-lida`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      void carregar(true);
    }
  }

  async function marcarTodas() {
    if (naoLidas === 0) return;
    setItens((prev) =>
      prev.map((n) => ({ ...n, lidaEm: n.lidaEm ?? new Date().toISOString() }))
    );
    setNaoLidas(0);
    try {
      await fetch("/api/notificacoes/marcar-todas-lidas", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      void carregar(true);
    }
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bell size={16} style={{ color: "var(--brand)" }} />
          <h2 className="section-title">{t("Notificações")}</h2>
          {naoLidas > 0 && (
            <span
              className="text-micro font-bold px-1.5 py-0.5 rounded text-white"
              style={{ backgroundColor: "var(--danger-solid)" }}
            >
              {naoLidas} {naoLidas === 1 ? t("nova") : t("novas")}
            </span>
          )}
        </div>
        <div className="section-subtitle">
          {t("Avisos das ações da equipe e do seu workspace.")}
        </div>
      </div>

      {/* Filtros + ações */}
      <div className="card flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="pill-group">
            <button
              aria-pressed={!apenasNaoLidas} className={`pill ${!apenasNaoLidas ? "active" : ""}`}
              onClick={() => setApenasNaoLidas(false)}
            >
              {t("Todas")}
            </button>
            <button
              aria-pressed={apenasNaoLidas} className={`pill ${apenasNaoLidas ? "active" : ""}`}
              onClick={() => setApenasNaoLidas(true)}
            >
              {t("Não lidas")} {naoLidas > 0 && `(${naoLidas})`}
            </button>
          </div>
          {naoLidas > 0 && (
            <button
              onClick={marcarTodas}
              className="stat-label hover:text-primary inline-flex items-center gap-1"
            >
              <CheckCheck size={12} />
              {t("Marcar todas como lidas")}
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        {carregando && itens.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">{t("Carregando...")}</div>
        ) : erro ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--danger)" }}>
            {erro}
          </div>
        ) : itens.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">
            {apenasNaoLidas
              ? t("Nenhuma notificação não lida.")
              : t("Nenhuma notificação ainda.")}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {itens.map((n) => (
              <LinhaCompleta key={n.id} item={n} onMarcarLida={() => marcarLida(n.id)} />
            ))}
          </div>
        )}

        {temMais && !carregando && (
          <div className="p-3 border-t border-border text-center">
            <button
              onClick={() => carregar(false)}
              className="btn btn-secondary text-xs"
            >
              {t("Carregar mais")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LinhaCompleta({
  item,
  onMarcarLida,
}: {
  item: Notificacao;
  onMarcarLida: () => void;
}) {
  const t = useT();
  const nav = useNavegacaoOpcional();
  const lida = !!item.lidaEm;
  const href = nav
    ? linkDaNotificacao({ link: item.link, modulo: item.modulo, entidade_id: item.entidadeId })
    : null;
  const corTipo = (() => {
    switch (item.tipo) {
      case "sucesso": return "var(--success)";
      case "aviso":   return "var(--warning)";
      case "alerta":  return "var(--danger)";
      default:        return "var(--brand)";
    }
  })();

  return (
    <div
      className="px-4 py-3 flex items-start gap-3"
      style={{ opacity: lida ? 0.6 : 1 }}
    >
      <span
        className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5"
        style={{ backgroundColor: lida ? "transparent" : corTipo }}
      />
      <div
        className={`flex-1 min-w-0 ${href ? "cursor-pointer group" : ""}`}
        role={href ? "link" : undefined}
        tabIndex={href ? 0 : undefined}
        onClick={
          href && nav
            ? () => {
                if (!lida) onMarcarLida();
                nav.navegar(href);
              }
            : undefined
        }
        onKeyDown={
          href && nav
            ? (e) => {
                if (e.key === "Enter") {
                  if (!lida) onMarcarLida();
                  nav.navegar(href);
                }
              }
            : undefined
        }
      >
        <div className="text-sm font-medium text-primary inline-flex items-center gap-1 group-hover:underline">
          {item.titulo}
          {href && <ChevronRight size={13} className="text-muted" />}
        </div>
        <div className="text-xs text-secondary mt-0.5 break-words">{item.mensagem}</div>
        <div className="text-micro text-muted mt-1">
          {formatarDataHora(item.criadoEm)}
        </div>
      </div>
      {!lida && (
        <button
          onClick={onMarcarLida}
          className="text-micro text-muted hover:text-primary"
          title={t("Marcar como lida")}
        >
          {t("Marcar lida")}
        </button>
      )}
    </div>
  );
}
