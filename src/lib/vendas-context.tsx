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
import { useShows } from "./shows-context";
import { useAuth } from "./auth-context";
import type {
  Venda,
  Parcela,
  ItemQuantidade,
  LogisticaSelecao,
} from "@/types";

/**
 * Input pra criar uma Venda. Mantém o formato legado consumido pela UI
 * (`ConcretizarVenda`). A orquestração (criar contratante, criar show,
 * marcar orçamento aceito, inserir parcelas) acontece toda no servidor
 * via POST /api/vendas — aqui só montamos o payload.
 */
export type NovaVendaInput = {
  orcamentoId?: string;

  contratante:
    | {
        tipo: "existente";
        id: string;
        nomeNovo?: string;
        emailNovo?: string;
        telefoneNovo?: string;
        documentoNovo?: string;
        paisNovo?: string;
        observacoesNovo?: string;
        /**
         * Backfill da cidade do contato reusado (D5): só vem preenchido quando
         * o cadastro NÃO tem cidade. O cidade_id alimenta geocode/mapa — não
         * fica trocando a cada venda (a "cidade principal" exibida é derivada
         * do último show).
         */
        cidadeIdNovo?: string;
        /** Só vem preenchido quando aprovado no popup de divergência (ou backfill). */
        enderecoNovo?: string;
        /**
         * Snapshot `contratante_*` da venda = o que foi DIGITADO agora, mesmo
         * que o usuário tenha recusado atualizar o cadastro (o snapshot é
         * independente do cadastro). Sem ele, cai no comportamento antigo
         * (deriva do patch/retorno do PATCH).
         */
        snapshot?: {
          nome: string;
          email: string;
          telefone: string;
          documento: string;
        };
      }
    | {
        tipo: "novo";
        nome: string;
        email: string;
        telefone: string;
        documento: string;
        pais: string;
        cidadeId: string;
      };

  contratanteEndereco: string;

  // Evento
  nomeEvento: string;
  eventoInstagram?: string;
  nomeLocal: string;
  capacidadePublico?: number;
  enderecoLocal: string;
  dataShow: string;
  /** "HH:mm" 24h, ou null quando o horário fica "a definir". */
  horario: string | null;
  horarioFim?: string | null;
  cidadeId: string;
  casaId?: string;

  // Show
  artistaId: string; // UUID do artista (workspace.artistas)
  lineUp?: string[];
  cache: number;
  duracaoHoras: number;
  duracaoMinutos?: number;
  camarim: ItemQuantidade[];
  efeitos: ItemQuantidade[];
  hotel: ItemQuantidade[];
  logistica: LogisticaSelecao;

  // Pagamento
  parcelas: Parcela[];

  observacoes?: string;
  infoExtra?: string;
};

type VendasContextValue = {
  vendas: Venda[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  criarVenda: (input: NovaVendaInput) => Promise<Venda>;
  updateVenda: (id: string, patch: Partial<Venda>) => Promise<Venda>;
  removeVenda: (id: string) => Promise<void>;
  /** Atualiza uma parcela específica (status, data, observação). */
  atualizarParcela: (
    vendaId: string,
    parcelaId: string,
    patch: Partial<Parcela>
  ) => Promise<Parcela>;
  /** Ação financeira crua (nota/comprovante/cancelar/cobrança). */
  acaoParcela: (
    vendaId: string,
    parcelaId: string,
    body: Record<string, unknown>
  ) => Promise<Parcela>;
};

const VendasContext = createContext<VendasContextValue | null>(null);

async function jsonOuErro(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((body.erro as string) ?? `HTTP ${res.status}`);
  }
  return body;
}

function vendaParaApiUpdate(p: Partial<Venda>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.orcamentoId !== undefined) out.orcamento_id = p.orcamentoId || null;
  if (p.contratanteId !== undefined) out.contratante_id = p.contratanteId || null;
  if (p.contratanteNome !== undefined) out.contratante_nome = p.contratanteNome;
  if (p.contratanteEmail !== undefined) out.contratante_email = p.contratanteEmail;
  if (p.contratanteTelefone !== undefined) out.contratante_telefone = p.contratanteTelefone;
  if (p.contratanteDocumento !== undefined) out.contratante_documento = p.contratanteDocumento;
  if (p.contratanteEndereco !== undefined) out.contratante_endereco = p.contratanteEndereco;
  if (p.nomeEvento !== undefined) out.nome_evento = p.nomeEvento;
  if (p.eventoInstagram !== undefined) out.evento_instagram = p.eventoInstagram;
  if (p.nomeLocal !== undefined) out.nome_local = p.nomeLocal;
  if (p.capacidadePublico !== undefined) out.capacidade_publico = p.capacidadePublico;
  if (p.enderecoLocal !== undefined) out.endereco_local = p.enderecoLocal;
  if (p.dataShow !== undefined) out.data_show = p.dataShow;
  if (p.horario !== undefined) out.horario = p.horario;
  if (p.horarioFim !== undefined) out.horario_fim = p.horarioFim;
  if (p.cidadeId !== undefined) out.cidade_id = p.cidadeId || null;
  if (p.casaId !== undefined) out.casa_id = p.casaId || null;
  if (p.artistaId !== undefined) out.artist_id = p.artistaId || null;
  if (p.lineUp !== undefined) out.line_up = p.lineUp;
  if (p.cache !== undefined) out.cache = p.cache;
  if (p.duracaoHoras !== undefined) out.duracao_horas = p.duracaoHoras;
  if (p.duracaoMinutos !== undefined) out.duracao_minutos = p.duracaoMinutos;
  if (p.camarim !== undefined) out.camarim = p.camarim;
  if (p.efeitos !== undefined) out.efeitos = p.efeitos;
  if (p.hotel !== undefined) out.hotel = p.hotel;
  if (p.logistica !== undefined) out.logistica = p.logistica;
  if (p.observacoes !== undefined) out.observacoes = p.observacoes;
  if (p.infoExtra !== undefined) out.info_extra = p.infoExtra || null;
  return out;
}

function parcelaParaApiUpdate(p: Partial<Parcela>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.percentual !== undefined) out.percentual = p.percentual;
  if (p.valor !== undefined) out.valor = p.valor;
  if (p.dataVencimento !== undefined) out.data_vencimento = p.dataVencimento || null;
  if (p.statusBase !== undefined) out.status_base = p.statusBase;
  if (p.dataPagamento !== undefined) out.data_pagamento = p.dataPagamento || null;
  if (p.observacao !== undefined) out.observacao = p.observacao;
  return out;
}

export function VendasProvider({ children }: { children: ReactNode }) {
  const { sessao } = useAuth();
  const { addContratante, updateContratante } = useContatos();
  const { recarregar: recarregarShows } = useShows();

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    if (!sessao?.workspace) {
      setVendas([]);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/vendas", { credentials: "include" });
      const body = await jsonOuErro(res);
      setVendas((body.vendas as Venda[]) ?? []);
    } catch (e) {
      setErro((e as Error).message);
      setVendas([]);
    } finally {
      setCarregando(false);
    }
  }, [sessao?.workspace]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const criarVenda = useCallback(
    async (input: NovaVendaInput): Promise<Venda> => {
      // 1) Resolver contratante (existente → atualizar; novo → criar)
      let contratanteId: string;
      let contratanteSnapshot = {
        nome: "",
        email: "",
        telefone: "",
        documento: "",
      };

      if (input.contratante.tipo === "existente") {
        contratanteId = input.contratante.id;
        const patch: Record<string, string | undefined> = {};
        if (input.contratante.nomeNovo !== undefined) patch.nome = input.contratante.nomeNovo;
        if (input.contratante.emailNovo !== undefined) patch.email = input.contratante.emailNovo;
        if (input.contratante.telefoneNovo !== undefined) patch.telefone = input.contratante.telefoneNovo;
        if (input.contratante.documentoNovo !== undefined) patch.documento = input.contratante.documentoNovo;
        if (input.contratante.paisNovo !== undefined) patch.pais = input.contratante.paisNovo;
        if (input.contratante.cidadeIdNovo !== undefined) patch.cidadeId = input.contratante.cidadeIdNovo;
        if (input.contratante.enderecoNovo !== undefined) patch.endereco = input.contratante.enderecoNovo;
        const snap = input.contratante.snapshot;
        if (snap) contratanteSnapshot = { ...snap };
        if (Object.keys(patch).length > 0) {
          try {
            const atual = await updateContratante(contratanteId, patch);
            if (!snap) {
              contratanteSnapshot = {
                nome: atual.nome ?? "",
                email: atual.email ?? "",
                telefone: atual.telefone ?? "",
                documento: atual.documento ?? "",
              };
            }
          } catch (e) {
            // Contato existente porém OCULTO para este usuário (visibilidade
            // derivada) → o PATCH de dados retorna 404. Reusar mesmo assim é o
            // objetivo do fluxo "já existe, quer usar?": segue com o
            // contratante_id (a própria venda cria a visibilidade derivada) e
            // monta o snapshot a partir do que a pessoa digitou.
            //
            // 404 é o único silêncio INTENCIONAL. 403 (sem `contatos.editar`)
            // e 5xx não podem sumir calados: a venda segue (o snapshot dela é
            // o que a pessoa digitou e não depende do cadastro), mas o erro
            // fica registrado em vez de virar "atualizou" mentiroso. A UI já
            // não abre o popup pra quem não pode editar (gate no cliente).
            const status = (e as { status?: number }).status;
            if (status !== 404) {
              console.error("Falha ao atualizar o contratante da venda:", e);
            }
            if (!snap) {
              contratanteSnapshot = {
                nome: patch.nome ?? "",
                email: patch.email ?? "",
                telefone: patch.telefone ?? "",
                documento: patch.documento ?? "",
              };
            }
          }
        }
      } else {
        const novo = await addContratante({
          nome: input.contratante.nome,
          email: input.contratante.email,
          telefone: input.contratante.telefone,
          documento: input.contratante.documento,
          pais: input.contratante.pais,
          cidadeId: input.contratante.cidadeId,
        });
        contratanteId = novo.id;
        contratanteSnapshot = {
          nome: novo.nome,
          email: novo.email ?? "",
          telefone: novo.telefone,
          documento: novo.documento ?? "",
        };
      }

      // 2) Monta payload da venda (snake_case)
      const payload: Record<string, unknown> = {
        orcamento_id: input.orcamentoId ?? null,
        contratante_id: contratanteId,
        contratante_nome: contratanteSnapshot.nome,
        contratante_email: contratanteSnapshot.email,
        contratante_telefone: contratanteSnapshot.telefone,
        contratante_documento: contratanteSnapshot.documento,
        contratante_endereco: input.contratanteEndereco,
        nome_evento: input.nomeEvento,
        evento_instagram: input.eventoInstagram ?? null,
        nome_local: input.nomeLocal,
        capacidade_publico: input.capacidadePublico ?? null,
        endereco_local: input.enderecoLocal,
        data_show: input.dataShow,
        // "" (horário a definir) e null viram null — a schema aceita null,
        // mas rejeita string vazia (regex HH:mm).
        horario: input.horario || null,
        horario_fim: input.horarioFim || null,
        cidade_id: input.cidadeId,
        casa_id: input.casaId ?? null,
        artist_id: input.artistaId || null,
        line_up: input.lineUp ?? [],
        cache: input.cache,
        duracao_horas: input.duracaoHoras,
        duracao_minutos: input.duracaoMinutos ?? null,
        camarim: input.camarim,
        efeitos: input.efeitos,
        hotel: input.hotel,
        logistica: input.logistica,
        observacoes: input.observacoes ?? null,
        info_extra: input.infoExtra ?? null,
        parcelas: input.parcelas.map((p) => ({
          percentual: p.percentual,
          valor: p.valor,
          data_vencimento: p.dataVencimento || null,
          status_base: p.statusBase,
          data_pagamento: p.dataPagamento || null,
          observacao: p.observacao ?? null,
        })),
      };

      // 3) POST único — o servidor cuida de show + orçamento
      const res = await fetch("/api/vendas", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await jsonOuErro(res);
      const criada = body.venda as Venda;

      const comDj: Venda = { ...criada, artistaId: input.artistaId };

      setVendas((prev) => [comDj, ...prev]);
      // O show foi criado/atualizado no servidor — sincroniza a agenda local
      void recarregarShows();
      return comDj;
    },
    [addContratante, updateContratante, recarregarShows]
  );

  const updateVenda = useCallback(
    async (id: string, patch: Partial<Venda>): Promise<Venda> => {
      const res = await fetch(`/api/vendas/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vendaParaApiUpdate(patch)),
      });
      const body = await jsonOuErro(res);
      const atual = body.venda as Venda;
      setVendas((prev) => prev.map((v) => (v.id === id ? { ...v, ...atual, artistaId: v.artistaId } : v)));
      return atual;
    },
    []
  );

  const removeVenda = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/vendas/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await jsonOuErro(res);
    setVendas((prev) => prev.filter((v) => v.id !== id));
    // O show vinculado pode ter sido afetado; sincroniza
    void recarregarShows();
  }, [recarregarShows]);

  const atualizarParcela = useCallback(
    async (
      vendaId: string,
      parcelaId: string,
      patch: Partial<Parcela>
    ): Promise<Parcela> => {
      const res = await fetch(`/api/parcelas/${parcelaId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parcelaParaApiUpdate(patch)),
      });
      const body = await jsonOuErro(res);
      const atual = body.parcela as Parcela;
      setVendas((prev) =>
        prev.map((v) => {
          if (v.id !== vendaId) return v;
          return {
            ...v,
            parcelas: v.parcelas.map((p) => (p.id === parcelaId ? atual : p)),
            atualizadoEm: new Date().toISOString(),
          };
        })
      );
      return atual;
    },
    []
  );

  /**
   * Ação financeira "crua" na parcela (nota/comprovante/cancelar/cobrança) —
   * campos que não são do tipo Parcela e vão direto pro PATCH. Reaproveita a
   * atualização de estado da resposta.
   */
  const acaoParcela = useCallback(
    async (
      vendaId: string,
      parcelaId: string,
      body: Record<string, unknown>
    ): Promise<Parcela> => {
      const res = await fetch(`/api/parcelas/${parcelaId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const b = await jsonOuErro(res);
      const atual = b.parcela as Parcela;
      setVendas((prev) =>
        prev.map((v) =>
          v.id !== vendaId
            ? v
            : {
                ...v,
                parcelas: v.parcelas.map((p) => (p.id === parcelaId ? atual : p)),
                atualizadoEm: new Date().toISOString(),
              }
        )
      );
      return atual;
    },
    []
  );

  const value = useMemo<VendasContextValue>(
    () => ({
      vendas,
      carregando,
      erro,
      recarregar,
      criarVenda,
      updateVenda,
      removeVenda,
      atualizarParcela,
      acaoParcela,
    }),
    [vendas, carregando, erro, recarregar, criarVenda, updateVenda, removeVenda, atualizarParcela, acaoParcela]
  );

  return <VendasContext.Provider value={value}>{children}</VendasContext.Provider>;
}

export function useVendas() {
  const ctx = useContext(VendasContext);
  if (!ctx) throw new Error("useVendas deve ser usado dentro de <VendasProvider>");
  return ctx;
}
