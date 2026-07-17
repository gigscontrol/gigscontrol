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
import type { Contratante, Casa, Cidade, TipoCasa } from "@/types";
import { useAuth } from "./auth-context";

/**
 * Contexto de contatos (contratantes, casas, cidades) — agora ligado ao
 * backend (`/api/contatos/...`).
 *
 * Cache local com fetch no mount + sempre que o workspace muda. Mutações
 * passam pela API e atualizam o cache com o retorno do servidor.
 *
 * As assinaturas `addContratante`/`addCasa`/`addCidade` aceitam o mesmo
 * payload legado (camelCase) usado pela UI e traduzem para o contrato da
 * API (snake_case).
 */

// ---- Tipos de entrada (camelCase, como a UI consome) ----

export type AddContratanteInput = Omit<Contratante, "id" | "criadoEm">;
export type UpdateContratanteInput = Partial<AddContratanteInput>;

export type AddCasaInput = Omit<Casa, "id">;
export type UpdateCasaInput = Partial<AddCasaInput>;

export type AddCidadeInput = Omit<Cidade, "id">;
export type UpdateCidadeInput = Partial<AddCidadeInput>;

type ContatosContextValue = {
  contratantes: Contratante[];
  casas: Casa[];
  cidades: Cidade[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;

  addContratante: (c: AddContratanteInput) => Promise<Contratante>;
  updateContratante: (id: string, c: UpdateContratanteInput) => Promise<Contratante>;
  removeContratante: (id: string) => Promise<void>;

  addCasa: (c: AddCasaInput) => Promise<Casa>;
  updateCasa: (id: string, c: UpdateCasaInput) => Promise<Casa>;
  removeCasa: (id: string) => Promise<void>;

  addCidade: (c: AddCidadeInput) => Promise<Cidade>;
  updateCidade: (id: string, c: UpdateCidadeInput) => Promise<Cidade>;
  removeCidade: (id: string) => Promise<void>;
  /** Injeta no estado uma cidade já criada no servidor (ex.: resolverCidade
   *  no submit de contratante/casa) pra refletir na hora, sem recarregar. */
  registrarCidade: (c: Cidade) => void;
};

const ContatosContext = createContext<ContatosContextValue | null>(null);

// ---- Helpers ----

function contratanteParaApi(
  c: AddContratanteInput | UpdateContratanteInput
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (c.nome !== undefined) out.nome = c.nome;
  if (c.documento !== undefined) out.documento = c.documento || null;
  // Razão social (migração 91) — o servidor só a mantém quando o documento
  // principal é CNPJ; mandar vazio pra CPF é o certo (zera).
  if (c.razaoSocial !== undefined) out.razao_social = c.razaoSocial || null;
  if (c.pais !== undefined) out.pais = c.pais || null;
  if (c.email !== undefined) out.email = c.email || null;
  if (c.telefone !== undefined) out.telefone = c.telefone || null;
  if (c.endereco !== undefined) out.endereco = c.endereco || null;
  if (c.cidadeId !== undefined) out.cidade_id = c.cidadeId || null;
  if (c.observacoes !== undefined) out.observacoes = c.observacoes || null;
  // Bloqueio (migração 83) — bloqueado_por/em são carimbados no servidor.
  if (c.bloqueado !== undefined) out.bloqueado = c.bloqueado;
  if (c.bloqueadoMotivo !== undefined) out.bloqueado_motivo = c.bloqueadoMotivo || null;
  return out;
}

function casaParaApi(c: AddCasaInput | UpdateCasaInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (c.nome !== undefined) out.nome = c.nome;
  if (c.tipo !== undefined) out.tipo = c.tipo as TipoCasa;
  if (c.cidadeId !== undefined) out.cidade_id = c.cidadeId || null;
  if (c.capacidade !== undefined) out.capacidade = c.capacidade ?? null;
  if (c.endereco !== undefined) out.endereco = c.endereco || null;
  if (c.contatoResponsavel !== undefined)
    out.contato_responsavel = c.contatoResponsavel || null;
  if (c.telefone !== undefined) out.telefone = c.telefone || null;
  // Bloqueio (migração 83) — bloqueado_por/em são carimbados no servidor.
  if (c.bloqueado !== undefined) out.bloqueado = c.bloqueado;
  if (c.bloqueadoMotivo !== undefined) out.bloqueado_motivo = c.bloqueadoMotivo || null;
  return out;
}

function cidadeParaApi(c: AddCidadeInput | UpdateCidadeInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (c.nome !== undefined) out.nome = c.nome;
  if (c.estado !== undefined) out.estado = c.estado || null;
  if (c.latitude !== undefined) out.latitude = c.latitude ?? null;
  if (c.longitude !== undefined) out.longitude = c.longitude ?? null;
  return out;
}

/** Erro de contato com o status HTTP preservado. Quem chama precisa distinguir
 *  404 (contato OCULTO por visibilidade derivada — silêncio é INTENCIONAL) de
 *  403/5xx (falha de verdade), senão um catch vazio engole os dois. */
export type ErroContato = Error & { status?: number };

async function jsonOuErro(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const erro: ErroContato = new Error(
      (body.erro as string) ?? `HTTP ${res.status}`
    );
    erro.status = res.status;
    throw erro;
  }
  return body;
}

// ---- Provider ----

export function ContatosProvider({ children }: { children: ReactNode }) {
  const { sessao } = useAuth();
  const [contratantes, setContratantes] = useState<Contratante[]>([]);
  const [casas, setCasas] = useState<Casa[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    if (!sessao?.workspace) {
      setContratantes([]);
      setCasas([]);
      setCidades([]);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const [rCidades, rCasas, rContratantes] = await Promise.all([
        fetch("/api/contatos/cidades", { credentials: "include" }),
        fetch("/api/contatos/casas", { credentials: "include" }),
        fetch("/api/contatos/contratantes", { credentials: "include" }),
      ]);
      const [bCidades, bCasas, bContratantes] = await Promise.all([
        jsonOuErro(rCidades),
        jsonOuErro(rCasas),
        jsonOuErro(rContratantes),
      ]);
      setCidades((bCidades.cidades as Cidade[]) ?? []);
      setCasas((bCasas.casas as Casa[]) ?? []);
      setContratantes((bContratantes.contratantes as Contratante[]) ?? []);
    } catch (e) {
      setErro((e as Error).message);
      setCidades([]);
      setCasas([]);
      setContratantes([]);
    } finally {
      setCarregando(false);
    }
  }, [sessao?.workspace]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  // ---- Mutações: contratantes ----

  const addContratante = useCallback(
    async (input: AddContratanteInput): Promise<Contratante> => {
      const res = await fetch("/api/contatos/contratantes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contratanteParaApi(input)),
      });
      const body = await jsonOuErro(res);
      const novo = body.contratante as Contratante;
      setContratantes((prev) => [...prev, novo]);
      return novo;
    },
    []
  );

  const updateContratante = useCallback(
    async (id: string, input: UpdateContratanteInput): Promise<Contratante> => {
      const res = await fetch(`/api/contatos/contratantes/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contratanteParaApi(input)),
      });
      const body = await jsonOuErro(res);
      const atual = body.contratante as Contratante;
      setContratantes((prev) => prev.map((c) => (c.id === id ? atual : c)));
      return atual;
    },
    []
  );

  const removeContratante = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/contatos/contratantes/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await jsonOuErro(res);
    setContratantes((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // ---- Mutações: casas ----

  const addCasa = useCallback(async (input: AddCasaInput): Promise<Casa> => {
    const res = await fetch("/api/contatos/casas", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(casaParaApi(input)),
    });
    const body = await jsonOuErro(res);
    const nova = body.casa as Casa;
    setCasas((prev) => [...prev, nova]);
    return nova;
  }, []);

  const updateCasa = useCallback(
    async (id: string, input: UpdateCasaInput): Promise<Casa> => {
      const res = await fetch(`/api/contatos/casas/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(casaParaApi(input)),
      });
      const body = await jsonOuErro(res);
      const atual = body.casa as Casa;
      setCasas((prev) => prev.map((c) => (c.id === id ? atual : c)));
      return atual;
    },
    []
  );

  const removeCasa = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/contatos/casas/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await jsonOuErro(res);
    setCasas((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // ---- Mutações: cidades ----

  const addCidade = useCallback(async (input: AddCidadeInput): Promise<Cidade> => {
    const res = await fetch("/api/contatos/cidades", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cidadeParaApi(input)),
    });
    const body = await jsonOuErro(res);
    const nova = body.cidade as Cidade;
    setCidades((prev) => [...prev, nova]);
    return nova;
  }, []);

  const updateCidade = useCallback(
    async (id: string, input: UpdateCidadeInput): Promise<Cidade> => {
      const res = await fetch(`/api/contatos/cidades/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cidadeParaApi(input)),
      });
      const body = await jsonOuErro(res);
      const atual = body.cidade as Cidade;
      setCidades((prev) => prev.map((c) => (c.id === id ? atual : c)));
      return atual;
    },
    []
  );

  const removeCidade = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/contatos/cidades/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await jsonOuErro(res);
    setCidades((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const registrarCidade = useCallback((c: Cidade) => {
    setCidades((prev) =>
      prev.some((x) => x.id === c.id)
        ? prev.map((x) => (x.id === c.id ? c : x))
        : [...prev, c]
    );
  }, []);

  const value = useMemo<ContatosContextValue>(
    () => ({
      contratantes,
      casas,
      cidades,
      carregando,
      erro,
      recarregar,
      addContratante,
      updateContratante,
      removeContratante,
      addCasa,
      updateCasa,
      removeCasa,
      addCidade,
      updateCidade,
      removeCidade,
      registrarCidade,
    }),
    [
      contratantes,
      casas,
      cidades,
      carregando,
      erro,
      recarregar,
      addContratante,
      updateContratante,
      removeContratante,
      addCasa,
      updateCasa,
      removeCasa,
      addCidade,
      updateCidade,
      removeCidade,
      registrarCidade,
    ]
  );

  return <ContatosContext.Provider value={value}>{children}</ContatosContext.Provider>;
}

export function useContatos() {
  const ctx = useContext(ContatosContext);
  if (!ctx) throw new Error("useContatos deve ser usado dentro de <ContatosProvider>");
  return ctx;
}
