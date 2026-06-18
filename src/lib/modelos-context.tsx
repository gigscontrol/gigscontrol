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
import { useAuth } from "./auth-context";
import type {
  ContratoModelo,
  ContratoModeloTipo,
  SecaoModelo,
} from "@/lib/mappers/contratoModelo";

/** Payload de criação de um modelo (camelCase no app). */
export type NovoModeloInput = {
  nome: string;
  tipo?: ContratoModeloTipo;
  corpo?: string | null;
  secoes?: SecaoModelo[];
  arquivoUrl?: string | null;
  arquivoNome?: string | null;
};

type ModelosContextValue = {
  modelos: ContratoModelo[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  criarModelo: (input: NovoModeloInput) => Promise<ContratoModelo>;
  atualizarModelo: (
    id: string,
    patch: Partial<NovoModeloInput>
  ) => Promise<ContratoModelo>;
  removerModelo: (id: string) => Promise<void>;
};

const ModelosContext = createContext<ModelosContextValue | null>(null);

// ---- Helpers ----

async function jsonOuErro(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((body.erro as string) ?? `HTTP ${res.status}`);
  }
  return body;
}

/** Converte um modelo "do app" (camelCase) no payload da API (snake_case). */
function modeloParaApi(m: Partial<NovoModeloInput>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (m.nome !== undefined) out.nome = m.nome;
  if (m.tipo !== undefined) out.tipo = m.tipo;
  if (m.corpo !== undefined) out.corpo = m.corpo ?? null;
  if (m.secoes !== undefined) out.secoes = m.secoes;
  if (m.arquivoUrl !== undefined) out.arquivo_url = m.arquivoUrl ?? null;
  if (m.arquivoNome !== undefined) out.arquivo_nome = m.arquivoNome ?? null;
  return out;
}

export function ModelosProvider({ children }: { children: ReactNode }) {
  const { sessao } = useAuth();
  const [modelos, setModelos] = useState<ContratoModelo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    if (!sessao?.workspace) {
      setModelos([]);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/contrato-modelos", {
        credentials: "include",
      });
      const body = await jsonOuErro(res);
      setModelos((body.modelos as ContratoModelo[]) ?? []);
    } catch (e) {
      setErro((e as Error).message);
      setModelos([]);
    } finally {
      setCarregando(false);
    }
  }, [sessao?.workspace]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  // ---- criar ----

  const criarModelo = useCallback(
    async (input: NovoModeloInput): Promise<ContratoModelo> => {
      const res = await fetch("/api/contrato-modelos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modeloParaApi(input)),
      });
      const body = await jsonOuErro(res);
      const criado = body.modelo as ContratoModelo;
      setModelos((prev) => [criado, ...prev]);
      return criado;
    },
    []
  );

  // ---- update / patch ----

  const atualizarModelo = useCallback(
    async (
      id: string,
      patch: Partial<NovoModeloInput>
    ): Promise<ContratoModelo> => {
      const res = await fetch(`/api/contrato-modelos/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modeloParaApi(patch)),
      });
      const body = await jsonOuErro(res);
      const atual = body.modelo as ContratoModelo;
      setModelos((prev) => prev.map((p) => (p.id === id ? atual : p)));
      return atual;
    },
    []
  );

  // ---- remove ----

  const removerModelo = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/contrato-modelos/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await jsonOuErro(res);
    setModelos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const value = useMemo<ModelosContextValue>(
    () => ({
      modelos,
      carregando,
      erro,
      recarregar,
      criarModelo,
      atualizarModelo,
      removerModelo,
    }),
    [
      modelos,
      carregando,
      erro,
      recarregar,
      criarModelo,
      atualizarModelo,
      removerModelo,
    ]
  );

  return (
    <ModelosContext.Provider value={value}>{children}</ModelosContext.Provider>
  );
}

export function useModelos() {
  const ctx = useContext(ModelosContext);
  if (!ctx)
    throw new Error("useModelos deve ser usado dentro de <ModelosProvider>");
  return ctx;
}
