"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { AgendaItem } from "@/types";
import { useAuth } from "./auth-context";

/**
 * Contexto dos itens da agenda (evento personalizado · voo · transporte),
 * ligado a `/api/agenda-items`. Cache local + mutações que atualizam o cache.
 */

export type NovoAgendaItem = {
  tipo: AgendaItem["tipo"];
  titulo?: string;
  data: string;
  dataFim?: string;
  diaInteiro?: boolean;
  horaInicio?: string;
  horaFim?: string;
  artistIds?: string[];
  observacoes?: string;
  dados?: Record<string, unknown>;
};

type AgendaItemsContextValue = {
  itens: AgendaItem[];
  carregando: boolean;
  recarregar: () => Promise<void>;
  criar: (i: NovoAgendaItem) => Promise<AgendaItem>;
  remover: (id: string) => Promise<void>;
};

const AgendaItemsContext = createContext<AgendaItemsContextValue | null>(null);

function paraApi(i: NovoAgendaItem): Record<string, unknown> {
  return {
    tipo: i.tipo,
    titulo: i.titulo ?? null,
    data: i.data,
    data_fim: i.dataFim ?? null,
    dia_inteiro: i.diaInteiro ?? false,
    hora_inicio: i.horaInicio ?? null,
    hora_fim: i.horaFim ?? null,
    artist_id: i.artistIds?.[0] ?? null,
    observacoes: i.observacoes ?? null,
    dados: { ...(i.dados ?? {}), artistIds: i.artistIds ?? [] },
  };
}

export function AgendaItemsProvider({ children }: { children: ReactNode }) {
  const { sessao } = useAuth();
  const [itens, setItens] = useState<AgendaItem[]>([]);
  const [carregando, setCarregando] = useState(false);

  const recarregar = useCallback(async () => {
    if (!sessao?.workspace) {
      setItens([]);
      return;
    }
    setCarregando(true);
    try {
      const res = await fetch("/api/agenda-items", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { itens: AgendaItem[] };
      setItens(body.itens);
    } catch {
      setItens([]);
    } finally {
      setCarregando(false);
    }
  }, [sessao?.workspace]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const criar = useCallback(async (input: NovoAgendaItem): Promise<AgendaItem> => {
    const res = await fetch("/api/agenda-items", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paraApi(input)),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { erro?: string }).erro ?? `HTTP ${res.status}`);
    }
    const { item } = (await res.json()) as { item: AgendaItem };
    setItens((prev) => [...prev, item]);
    return item;
  }, []);

  const remover = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/agenda-items/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { erro?: string }).erro ?? `HTTP ${res.status}`);
    }
    setItens((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const value = useMemo<AgendaItemsContextValue>(
    () => ({ itens, carregando, recarregar, criar, remover }),
    [itens, carregando, recarregar, criar, remover]
  );

  return (
    <AgendaItemsContext.Provider value={value}>{children}</AgendaItemsContext.Provider>
  );
}

export function useAgendaItems() {
  const ctx = useContext(AgendaItemsContext);
  if (!ctx)
    throw new Error("useAgendaItems deve ser usado dentro de <AgendaItemsProvider>");
  return ctx;
}
