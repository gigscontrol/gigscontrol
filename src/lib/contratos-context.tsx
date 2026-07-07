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
import type { Contrato, ContratoStatus, ContratoPasta } from "@/lib/mappers/contrato";
import {
  conteudoParaCorpo,
  pastasValidas,
  type ContratoPdfLayout,
} from "@/lib/mappers/contrato";
import type { SecaoModelo, EstiloModelo } from "@/lib/mappers/contratoModelo";

/** Geração de um contrato novo (a partir do Novo Contrato). */
export type NovoContratoInput = {
  modeloId?: string | null;
  vendaId?: string | null;
  /** Seções JÁ preenchidas + estilo viram o snapshot `corpo_preenchido`. */
  secoes: SecaoModelo[];
  estilo: EstiloModelo;
  /** Presente = contrato por UPLOAD de PDF (posiciona assinaturas). */
  pdf?: ContratoPdfLayout;
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
  /** Pasta de organização (null = tira da pasta). */
  pastaId?: string | null;
};

/** Resumo de um assinante de contrato (pra pintar o status na lista). */
export type AssinanteResumo = {
  nome: string;
  status: "pendente" | "assinado";
  /** Nº de vezes que abriu o link sem assinar. */
  aberturas: number;
};

/**
 * Lançado quando o limite de contratos do ciclo foi atingido e há a opção de
 * pagar por um contrato EXCEDENTE (a UI mostra o modal de confirmação).
 */
export class ExcedenteError extends Error {
  constructor(
    public info: { limite: number; plano: string; valor: number; moeda: "brl" | "usd" }
  ) {
    super("Limite de contratos atingido.");
    this.name = "ExcedenteError";
  }
}

type ContratosContextValue = {
  contratos: Contrato[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  criarContrato: (
    input: NovoContratoInput,
    opts?: { pagarExcedente?: boolean; idem?: string }
  ) => Promise<Contrato>;
  atualizarContrato: (
    id: string,
    patch: PatchContratoInput
  ) => Promise<Contrato>;
  removerContrato: (id: string) => Promise<void>;
  /** Pastas de organização ("Meus contratos"). */
  pastas: ContratoPasta[];
  /** Salva a lista inteira de pastas (criar/renomear/reordenar/excluir). */
  salvarPastas: (pastas: ContratoPasta[]) => Promise<void>;
  /** Move um contrato pra uma pasta (null = tira da pasta). Otimista. */
  moverContrato: (id: string, pastaId: string | null) => Promise<void>;
  /** Assinantes por contrato (id → lista), pra pintar o status na lista. */
  assinantesPorContrato: Record<string, AssinanteResumo[]>;
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
  const [pastas, setPastas] = useState<ContratoPasta[]>([]);
  const [assinantesPorContrato, setAssinantesPorContrato] = useState<
    Record<string, AssinanteResumo[]>
  >({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    if (!sessao?.workspace) {
      setContratos([]);
      setPastas([]);
      setAssinantesPorContrato({});
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const [resC, resP, resA] = await Promise.all([
        fetch("/api/contratos", { credentials: "include" }),
        fetch("/api/contratos/pastas", { credentials: "include" }),
        fetch("/api/contratos/assinantes", { credentials: "include" }),
      ]);
      const bodyC = await jsonOuErro(resC);
      setContratos((bodyC.contratos as Contrato[]) ?? []);
      // Pastas e assinantes não bloqueiam a tela se falharem.
      try {
        const bodyP = await jsonOuErro(resP);
        setPastas(pastasValidas(bodyP.pastas));
      } catch {
        setPastas([]);
      }
      try {
        const bodyA = await jsonOuErro(resA);
        setAssinantesPorContrato(
          (bodyA.assinantes as Record<string, AssinanteResumo[]>) ?? {}
        );
      } catch {
        setAssinantesPorContrato({});
      }
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
    async (
      input: NovoContratoInput,
      opts?: { pagarExcedente?: boolean; idem?: string }
    ): Promise<Contrato> => {
      const body: Record<string, unknown> = {
        modelo_id: input.modeloId ?? null,
        venda_id: input.vendaId ?? null,
        corpo_preenchido: conteudoParaCorpo({
          secoes: input.secoes,
          estilo: input.estilo,
          ...(input.pdf ? { pdf: input.pdf } : {}),
        }),
      };
      if (input.status !== undefined) body.status = input.status;
      if (input.localAssinatura !== undefined)
        body.local_assinatura = input.localAssinatura;
      if (input.dataEmissao !== undefined) body.data_emissao = input.dataEmissao;
      if (input.observacoes !== undefined) body.observacoes = input.observacoes;
      if (opts?.pagarExcedente) {
        body.pagarExcedente = true;
        body.idem = opts.idem;
      }

      const res = await fetch("/api/contratos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      // 402 = limite do ciclo atingido. Com `excedente`, oferece pagar por unidade.
      if (res.status === 402) {
        const b = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (b.excedente) {
          throw new ExcedenteError({
            limite: Number(b.limite) || 0,
            plano: String(b.plano ?? ""),
            valor: Number(b.valor) || 0,
            moeda: b.moeda === "usd" ? "usd" : "brl",
          });
        }
        throw new Error(
          (b.erro as string) ?? "Falha ao cobrar o excedente. Verifique o cartão."
        );
      }
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
      if (patch.pastaId !== undefined) body.pasta_id = patch.pastaId;

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

  const moverContrato = useCallback(
    async (id: string, pastaId: string | null): Promise<void> => {
      // Otimista: move na hora; reverte se o PATCH falhar.
      let anterior: string | null = null;
      setContratos((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          anterior = c.pastaId;
          return { ...c, pastaId };
        })
      );
      try {
        const res = await fetch(`/api/contratos/${id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pasta_id: pastaId }),
        });
        await jsonOuErro(res);
      } catch (e) {
        setContratos((prev) =>
          prev.map((c) => (c.id === id ? { ...c, pastaId: anterior } : c))
        );
        throw e;
      }
    },
    []
  );

  const salvarPastas = useCallback(
    async (novas: ContratoPasta[]): Promise<void> => {
      const res = await fetch("/api/contratos/pastas", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pastas: novas }),
      });
      const b = await jsonOuErro(res);
      setPastas(pastasValidas(b.pastas));
    },
    []
  );

  const value = useMemo<ContratosContextValue>(
    () => ({
      contratos,
      carregando,
      erro,
      recarregar,
      criarContrato,
      atualizarContrato,
      removerContrato,
      pastas,
      salvarPastas,
      moverContrato,
      assinantesPorContrato,
    }),
    [
      contratos,
      carregando,
      erro,
      recarregar,
      criarContrato,
      atualizarContrato,
      removerContrato,
      pastas,
      salvarPastas,
      moverContrato,
      assinantesPorContrato,
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
