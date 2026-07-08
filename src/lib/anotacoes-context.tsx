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
import type { AnotacaoPasta, Anotacao, VisibilidadePasta } from "@/lib/mappers/anotacoes";
import { useAuth } from "./auth-context";

/**
 * Contexto das Anotações (pastas + notas). Cache local com fetch no mount e
 * quando o workspace muda. Mutações passam pela API e atualizam o cache com o
 * retorno do servidor.
 */

export type PastaInput = {
  nome: string;
  cor?: string | null;
  icone?: string | null;
  visibilidade: VisibilidadePasta;
  membros?: string[];
};
export type PastaUpdateInput = Partial<PastaInput>;

export type NotaInput = {
  pasta_id: string;
  titulo?: string | null;
  conteudo: string;
  cor?: string | null;
  fixada?: boolean;
};
export type NotaUpdateInput = {
  titulo?: string | null;
  conteudo?: string;
  cor?: string | null;
  fixada?: boolean;
};

type AnotacoesContextValue = {
  pastas: AnotacaoPasta[];
  notas: Anotacao[];
  podeCriarPasta: boolean;
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;

  addPasta: (p: PastaInput) => Promise<AnotacaoPasta>;
  updatePasta: (id: string, p: PastaUpdateInput) => Promise<AnotacaoPasta>;
  removePasta: (id: string) => Promise<void>;

  addNota: (n: NotaInput) => Promise<Anotacao>;
  updateNota: (id: string, n: NotaUpdateInput) => Promise<Anotacao>;
  removeNota: (id: string) => Promise<void>;
};

const AnotacoesContext = createContext<AnotacoesContextValue | null>(null);

async function jsonOuErro(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((body.erro as string) ?? `HTTP ${res.status}`);
  return body;
}

export function AnotacoesProvider({ children }: { children: ReactNode }) {
  const { sessao } = useAuth();
  const [pastas, setPastas] = useState<AnotacaoPasta[]>([]);
  const [notas, setNotas] = useState<Anotacao[]>([]);
  const [podeCriarPasta, setPodeCriarPasta] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    if (!sessao?.workspace) {
      setPastas([]);
      setNotas([]);
      setPodeCriarPasta(false);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const [rPastas, rNotas] = await Promise.all([
        fetch("/api/anotacoes/pastas", { credentials: "include" }),
        fetch("/api/anotacoes", { credentials: "include" }),
      ]);
      const [bPastas, bNotas] = await Promise.all([jsonOuErro(rPastas), jsonOuErro(rNotas)]);
      setPastas((bPastas.pastas as AnotacaoPasta[]) ?? []);
      setPodeCriarPasta(!!bPastas.podeCriar);
      setNotas((bNotas.notas as Anotacao[]) ?? []);
    } catch (e) {
      setErro((e as Error).message);
      setPastas([]);
      setNotas([]);
    } finally {
      setCarregando(false);
    }
  }, [sessao?.workspace]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  // ---- Pastas ----
  const addPasta = useCallback(async (input: PastaInput): Promise<AnotacaoPasta> => {
    const res = await fetch("/api/anotacoes/pastas", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await jsonOuErro(res);
    const nova = body.pasta as AnotacaoPasta;
    setPastas((prev) => [...prev, nova]);
    return nova;
  }, []);

  const updatePasta = useCallback(
    async (id: string, input: PastaUpdateInput): Promise<AnotacaoPasta> => {
      const res = await fetch(`/api/anotacoes/pastas/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await jsonOuErro(res);
      const atual = body.pasta as AnotacaoPasta;
      setPastas((prev) => prev.map((p) => (p.id === id ? atual : p)));
      return atual;
    },
    []
  );

  const removePasta = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/anotacoes/pastas/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await jsonOuErro(res);
    setPastas((prev) => prev.filter((p) => p.id !== id));
    setNotas((prev) => prev.filter((n) => n.pastaId !== id));
  }, []);

  // ---- Notas ----
  const addNota = useCallback(async (input: NotaInput): Promise<Anotacao> => {
    const res = await fetch("/api/anotacoes", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await jsonOuErro(res);
    const nova = body.nota as Anotacao;
    setNotas((prev) => [...prev, nova]);
    return nova;
  }, []);

  const updateNota = useCallback(
    async (id: string, input: NotaUpdateInput): Promise<Anotacao> => {
      const res = await fetch(`/api/anotacoes/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await jsonOuErro(res);
      const atual = body.nota as Anotacao;
      setNotas((prev) => prev.map((n) => (n.id === id ? atual : n)));
      return atual;
    },
    []
  );

  const removeNota = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/anotacoes/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await jsonOuErro(res);
    setNotas((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const value = useMemo<AnotacoesContextValue>(
    () => ({
      pastas,
      notas,
      podeCriarPasta,
      carregando,
      erro,
      recarregar,
      addPasta,
      updatePasta,
      removePasta,
      addNota,
      updateNota,
      removeNota,
    }),
    [pastas, notas, podeCriarPasta, carregando, erro, recarregar, addPasta, updatePasta, removePasta, addNota, updateNota, removeNota]
  );

  return <AnotacoesContext.Provider value={value}>{children}</AnotacoesContext.Provider>;
}

export function useAnotacoes() {
  const ctx = useContext(AnotacoesContext);
  if (!ctx) throw new Error("useAnotacoes deve ser usado dentro de <AnotacoesProvider>");
  return ctx;
}
