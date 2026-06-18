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
import type { Contrato, ContratoStatus } from "@/lib/mappers/contrato";
import { conteudoParaCorpo } from "@/lib/mappers/contrato";
import type { SecaoModelo, EstiloModelo } from "@/lib/mappers/contratoModelo";

/** Geração de um contrato novo (a partir do Novo Contrato). */
export type NovoContratoInput = {
  modeloId?: string | null;
  vendaId?: string | null;
  /** Seções JÁ preenchidas + estilo viram o snapshot `corpo_preenchido`. */
  secoes: SecaoModelo[];
  estilo: EstiloModelo;
  status?: ContratoStatus;
  localAssinatura?: string | null;
  dataEmissao?: string | null;
  observacoes?: string | null;
};

/** Patch de um contrato existente (status, conteúdo, datas…). */
export type PatchContratoInput = {
  status?: ContratoStatus;
  /** Para reescrever o snapshot é preciso secoes + estilo juntos. */
  secoes?: SecaoModelo[];
  estilo?: EstiloModelo;
  localAssinatura?: string | null;
  dataEmissao?: string | null;
  dataAssinatura?: string | null;
  observacoes?: string | null;
};

type ContratosContextValue = {
  contratos: Contrato[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  criarContrato: (input: NovoContratoInput) => Promise<Contrato>;
  atualizarContrato: (
    id: string,
    patch: PatchContratoInput
  ) => Promise<Contrato>;
  removerContrato: (id: string) => Promise<void>;
};

const ContratosContext = createContext<ContratosContextValue | null>(null);

async function jsonOuErro(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((body.erro as string) ?? `HTTP ${res.status}`);
  }
  return body;
}

export function ContratosProvider({ children }: { children: ReactNode }) {
  const { sessao } = useAuth();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    if (!sessao?.workspace) {
      setContratos([]);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/contratos", { credentials: "include" });
      const body = await jsonOuErro(res);
      setContratos((body.contratos as Contrato[]) ?? []);
    } catch (e) {
      setErro((e as Error).message);
      setContratos([]);
    } finally {
      setCarregando(false);
    }
  }, [sessao?.workspace]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const criarContrato = useCallback(
    async (input: NovoContratoInput): Promise<Contrato> => {
      const body: Record<string, unknown> = {
        modelo_id: input.modeloId ?? null,
        venda_id: input.vendaId ?? null,
        corpo_preenchido: conteudoParaCorpo({
          secoes: input.secoes,
          estilo: input.estilo,
        }),
      };
      if (input.status !== undefined) body.status = input.status;
      if (input.localAssinatura !== undefined)
        body.local_assinatura = input.localAssinatura;
      if (input.dataEmissao !== undefined) body.data_emissao = input.dataEmissao;
      if (input.observacoes !== undefined) body.observacoes = input.observacoes;

      const res = await fetch("/api/contratos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const b = await jsonOuErro(res);
      const criado = b.contrato as Contrato;
      setContratos((prev) => [criado, ...prev]);
      return criado;
    },
    []
  );

  const atualizarContrato = useCallback(
    async (id: string, patch: PatchContratoInput): Promise<Contrato> => {
      const body: Record<string, unknown> = {};
      if (patch.status !== undefined) body.status = patch.status;
      // Reescreve o snapshot só quando vêm secoes + estilo juntos.
      if (patch.secoes && patch.estilo) {
        body.corpo_preenchido = conteudoParaCorpo({
          secoes: patch.secoes,
          estilo: patch.estilo,
        });
      }
      if (patch.localAssinatura !== undefined)
        body.local_assinatura = patch.localAssinatura;
      if (patch.dataEmissao !== undefined) body.data_emissao = patch.dataEmissao;
      if (patch.dataAssinatura !== undefined)
        body.data_assinatura = patch.dataAssinatura;
      if (patch.observacoes !== undefined) body.observacoes = patch.observacoes;

      const res = await fetch(`/api/contratos/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const b = await jsonOuErro(res);
      const atual = b.contrato as Contrato;
      setContratos((prev) => prev.map((c) => (c.id === id ? atual : c)));
      return atual;
    },
    []
  );

  const removerContrato = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/contratos/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await jsonOuErro(res);
    setContratos((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const value = useMemo<ContratosContextValue>(
    () => ({
      contratos,
      carregando,
      erro,
      recarregar,
      criarContrato,
      atualizarContrato,
      removerContrato,
    }),
    [
      contratos,
      carregando,
      erro,
      recarregar,
      criarContrato,
      atualizarContrato,
      removerContrato,
    ]
  );

  return (
    <ContratosContext.Provider value={value}>
      {children}
    </ContratosContext.Provider>
  );
}

export function useContratos() {
  const ctx = useContext(ContratosContext);
  if (!ctx)
    throw new Error("useContratos deve ser usado dentro de <ContratosProvider>");
  return ctx;
}
