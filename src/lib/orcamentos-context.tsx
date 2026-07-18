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
import { useContatos } from "./contatos-context";
import { useAuth } from "./auth-context";
import type {
  Orcamento,
  OrcamentoStatus,
  Casa,
  Cidade,
  ItemQuantidade,
  LogisticaSelecao,
  TipoEvento,
  DetalhesEvento,
  Moeda,
} from "@/types";

export type ContratanteInput =
  | { tipo: "existente"; id: string }
  | {
      tipo: "novo";
      dados: { nome: string; telefone: string; email?: string; documento?: string; observacoes?: string };
    };

export type CasaInput =
  | { tipo: "existente"; id: string }
  | { tipo: "novo"; dados: Omit<Casa, "id" | "cidadeId"> }
  | { tipo: "nenhuma" };

export type CidadeInput =
  | { tipo: "existente"; id: string }
  | { tipo: "novo"; dados: Omit<Cidade, "id"> };

export type NovoOrcamentoInput = {
  tipoEvento: TipoEvento;
  contratante: ContratanteInput;
  casa: CasaInput;
  cidade: CidadeInput;
  /** UUID do artista (vem do workspace.artistas). */
  artistaId: string;
  valorCache: number;
  /** Moeda do orçamento (migração 92). Default = moeda da agência. */
  moeda?: Moeda;
  duracaoHoras: number;
  duracaoMinutos?: number;
  dataShow?: string;
  horario?: string;
  camarim: ItemQuantidade[];
  efeitos: ItemQuantidade[];
  hotel: ItemQuantidade[];
  tecnico: ItemQuantidade[];
  logistica: LogisticaSelecao;
  validade?: string;
  observacoes?: string;
  /** Texto livre opcional anexado ao fim do orçamento. */
  infoExtra?: string;
  /** Orçamento detalhado: infos do evento (não vão pro WhatsApp). */
  detalhesEvento?: DetalhesEvento;
};

type OrcamentosContextValue = {
  orcamentos: Orcamento[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  criarOrcamentoComContatos: (input: NovoOrcamentoInput) => Promise<Orcamento>;
  updateOrcamento: (id: string, o: Partial<Orcamento>) => Promise<Orcamento>;
  removeOrcamento: (id: string) => Promise<void>;
  aceitarOrcamento: (id: string) => Promise<{
    orcamento: Orcamento;
    showCriado?: string;
    faltamDados?: boolean;
  }>;
  marcarStatus: (id: string, status: OrcamentoStatus) => Promise<Orcamento>;
  duplicarOrcamento: (id: string) => Promise<Orcamento | null>;
};

const OrcamentosContext = createContext<OrcamentosContextValue | null>(null);

// ---- Helpers ----

async function jsonOuErro(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((body.erro as string) ?? `HTTP ${res.status}`);
  }
  return body;
}

/** Converte um Orcamento "do app" (camelCase) no payload da API (snake_case). */
function orcamentoParaApi(o: Partial<Orcamento>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (o.status !== undefined) out.status = o.status;
  if (o.tipoEvento !== undefined) out.tipo_evento = o.tipoEvento;
  if (o.contratanteId !== undefined) out.contratante_id = o.contratanteId || null;
  if (o.casaId !== undefined) out.casa_id = o.casaId || null;
  if (o.cidadeId !== undefined) out.cidade_id = o.cidadeId || null;
  if (o.artistaId !== undefined) out.artist_id = o.artistaId || null;
  if (o.valorCache !== undefined) out.valor_cache = o.valorCache;
  if (o.moeda !== undefined) out.moeda = o.moeda;
  if (o.duracaoHoras !== undefined) out.duracao_horas = o.duracaoHoras;
  if (o.duracaoMinutos !== undefined) out.duracao_minutos = o.duracaoMinutos;
  if (o.camarim !== undefined) out.camarim = o.camarim;
  if (o.efeitos !== undefined) out.efeitos = o.efeitos;
  if (o.hotel !== undefined) out.hotel = o.hotel;
  if (o.tecnico !== undefined) out.tecnico = o.tecnico;
  if (o.logistica !== undefined) out.logistica = o.logistica;
  if (o.observacoes !== undefined) out.observacoes = o.observacoes || null;
  if (o.infoExtra !== undefined) out.info_extra = o.infoExtra || null;
  if (o.detalhesEvento !== undefined)
    out.detalhes_evento = o.detalhesEvento ?? null;
  if (o.dataShow !== undefined) out.data_show = o.dataShow || null;
  if (o.horario !== undefined) out.horario = o.horario || null;
  if (o.validade !== undefined) out.validade = o.validade || null;
  if (o.showId !== undefined) out.show_id = o.showId || null;
  return out;
}

export function OrcamentosProvider({ children }: { children: ReactNode }) {
  const { sessao } = useAuth();
  const { addContratante, addCasa, addCidade } = useContatos();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    if (!sessao?.workspace) {
      setOrcamentos([]);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/orcamentos", { credentials: "include" });
      const body = await jsonOuErro(res);
      setOrcamentos((body.orcamentos as Orcamento[]) ?? []);
    } catch (e) {
      setErro((e as Error).message);
      setOrcamentos([]);
    } finally {
      setCarregando(false);
    }
  }, [sessao?.workspace]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  // ---- criar com contatos ----

  const criarOrcamentoComContatos = useCallback(
    async (input: NovoOrcamentoInput): Promise<Orcamento> => {
      // 1) Cidade
      let cidadeIdResolvido: string;
      if (input.cidade.tipo === "existente") {
        cidadeIdResolvido = input.cidade.id;
      } else {
        const nova = await addCidade(input.cidade.dados);
        cidadeIdResolvido = nova.id;
      }

      // 2) Contratante
      let contratanteIdResolvido: string;
      if (input.contratante.tipo === "existente") {
        contratanteIdResolvido = input.contratante.id;
      } else {
        const novo = await addContratante({
          nome: input.contratante.dados.nome,
          telefone: input.contratante.dados.telefone,
          email: input.contratante.dados.email || "",
          documento: input.contratante.dados.documento || "",
          observacoes: input.contratante.dados.observacoes,
          cidadeId: cidadeIdResolvido,
        });
        contratanteIdResolvido = novo.id;
      }

      // 3) Casa
      let casaIdResolvido: string | undefined;
      if (input.casa.tipo === "existente") {
        casaIdResolvido = input.casa.id;
      } else if (input.casa.tipo === "novo") {
        const nova = await addCasa({ ...input.casa.dados, cidadeId: cidadeIdResolvido });
        casaIdResolvido = nova.id;
      } else {
        casaIdResolvido = undefined;
      }

      // 4) Criar orçamento no backend
      const payload: Record<string, unknown> = {
        tipo_evento: input.tipoEvento,
        contratante_id: contratanteIdResolvido,
        casa_id: casaIdResolvido ?? null,
        cidade_id: cidadeIdResolvido,
        artist_id: input.artistaId || null,
        valor_cache: input.valorCache,
        duracao_horas: input.duracaoHoras,
        duracao_minutos: input.duracaoMinutos,
        data_show: input.dataShow ?? null,
        horario: input.horario ?? null,
        camarim: input.camarim,
        efeitos: input.efeitos,
        hotel: input.hotel,
        tecnico: input.tecnico,
        logistica: input.logistica,
        validade: input.validade ?? null,
        observacoes: input.observacoes ?? null,
        info_extra: input.infoExtra ?? null,
        detalhes_evento: input.detalhesEvento ?? null,
      };

      const res = await fetch("/api/orcamentos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await jsonOuErro(res);
      const criado = body.orcamento as Orcamento;

      const comDj: Orcamento = { ...criado, artistaId: input.artistaId };
      setOrcamentos((prev) => [comDj, ...prev]);
      return comDj;
    },
    [addContratante, addCasa, addCidade]
  );

  // ---- update / patch ----

  const updateOrcamento = useCallback(
    async (id: string, patch: Partial<Orcamento>): Promise<Orcamento> => {
      const res = await fetch(`/api/orcamentos/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orcamentoParaApi(patch)),
      });
      const body = await jsonOuErro(res);
      const atual = body.orcamento as Orcamento;
      setOrcamentos((prev) => prev.map((p) => (p.id === id ? { ...p, ...atual, artistaId: p.artistaId } : p)));
      return atual;
    },
    []
  );

  // ---- remove ----

  const removeOrcamento = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/orcamentos/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await jsonOuErro(res);
    setOrcamentos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ---- mudar só o status ----

  const marcarStatus = useCallback(
    async (id: string, status: OrcamentoStatus): Promise<Orcamento> => {
      return updateOrcamento(id, { status });
    },
    [updateOrcamento]
  );

  // ---- aceitar (servidor cria show) ----

  const aceitarOrcamento = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/orcamentos/${id}/aceitar`, {
        method: "POST",
        credentials: "include",
      });
      const body = await jsonOuErro(res);
      const atual = body.orcamento as Orcamento;
      const showCriado = (body.show as { id?: string } | null)?.id;
      const faltamDados = !!body.faltamDados;
      setOrcamentos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...atual, artistaId: p.artistaId } : p))
      );
      return { orcamento: atual, showCriado, faltamDados };
    },
    []
  );

  // ---- duplicar ----

  const duplicarOrcamento = useCallback(
    async (id: string): Promise<Orcamento | null> => {
      const original = orcamentos.find((o) => o.id === id);
      if (!original) return null;
      const payload: Record<string, unknown> = {
        tipo_evento: original.tipoEvento,
        contratante_id: original.contratanteId || null,
        casa_id: original.casaId || null,
        cidade_id: original.cidadeId || null,
        artist_id: original.artistaId || null,
        valor_cache: original.valorCache,
        duracao_horas: original.duracaoHoras,
        duracao_minutos: original.duracaoMinutos,
        data_show: original.dataShow ?? null,
        horario: original.horario ?? null,
        camarim: original.camarim,
        efeitos: original.efeitos,
        hotel: original.hotel,
        tecnico: original.tecnico,
        logistica: original.logistica,
        validade: original.validade ?? null,
        observacoes: original.observacoes ?? null,
        detalhes_evento: original.detalhesEvento ?? null,
        status: "pendente",
      };
      const res = await fetch("/api/orcamentos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await jsonOuErro(res);
      const criado = body.orcamento as Orcamento;
      const comDj: Orcamento = { ...criado, artistaId: original.artistaId };
      setOrcamentos((prev) => [comDj, ...prev]);
      return comDj;
    },
    [orcamentos]
  );

  const value = useMemo<OrcamentosContextValue>(
    () => ({
      orcamentos,
      carregando,
      erro,
      recarregar,
      criarOrcamentoComContatos,
      updateOrcamento,
      removeOrcamento,
      aceitarOrcamento,
      marcarStatus,
      duplicarOrcamento,
    }),
    [
      orcamentos,
      carregando,
      erro,
      recarregar,
      criarOrcamentoComContatos,
      updateOrcamento,
      removeOrcamento,
      aceitarOrcamento,
      marcarStatus,
      duplicarOrcamento,
    ]
  );

  return <OrcamentosContext.Provider value={value}>{children}</OrcamentosContext.Provider>;
}

export function useOrcamentos() {
  const ctx = useContext(OrcamentosContext);
  if (!ctx) throw new Error("useOrcamentos deve ser usado dentro de <OrcamentosProvider>");
  return ctx;
}
