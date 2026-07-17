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
        /**
         * Razão social do documento (migração 91) — só quando ele é CNPJ. Segue
         * a regra do documento: acumula/atualiza em silêncio (D6), nunca entra
         * no popup de divergência.
         */
        razaoSocialNovo?: string;
        /**
         * Escolha manual PF/Empresa (B4) — só vem preenchida em país AMBÍGUO
         * (sem regra automática). País com regra deriva o tipo do documento e
         * ignora este campo com segurança. Persiste no item do jsonb `documentos`.
         */
        documentoTipo?: "pf" | "pj";
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
          /** Vazio/ausente quando o documento não é CNPJ. */
          razaoSocial?: string;
        };
      }
    | {
        tipo: "novo";
        nome: string;
        email: string;
        telefone: string;
        documento: string;
        /** Só quando o documento é de empresa. */
        razaoSocial?: string;
        /** Escolha manual PF/Empresa (B4) — só em país ambíguo. Ver acima. */
        documentoTipo?: "pf" | "pj";
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

  /**
   * Pagamento. Opcional: na EDIÇÃO de venda com parcela paga o form omite as
   * parcelas de propósito (o servidor preserva o que já foi pago — D5).
   */
  parcelas?: Parcela[];

  observacoes?: string;
  infoExtra?: string;
};

/** Os campos `contratante_*` que a venda GRAVA (snapshot do momento da venda). */
type ContratanteSnapshot = {
  nome: string;
  email: string;
  telefone: string;
  documento: string;
  razaoSocial: string;
};

type VendasContextValue = {
  vendas: Venda[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  criarVenda: (input: NovaVendaInput) => Promise<Venda>;
  /**
   * Edição COMPLETA da venda (mesmo input da criação). O servidor sincroniza o
   * show e o Google, e recalcula as parcelas — exceto quando alguma já está
   * paga, e aí `parcelasPreservadas` volta true pra UI avisar (D5).
   */
  atualizarVendaCompleta: (
    id: string,
    input: NovaVendaInput
  ) => Promise<{ venda: Venda; parcelasPreservadas: boolean }>;
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
  if (p.contratanteRazaoSocial !== undefined) out.contratante_razao_social = p.contratanteRazaoSocial || null;
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

  /**
   * Resolve o contratante do input (existente → atualizar o que foi aprovado;
   * novo → criar) e devolve o id + o snapshot que a venda grava.
   * Compartilhado entre criar e editar — a regra de dedupe/backfill é a mesma.
   */
  const resolverContratanteDoInput = useCallback(
    async (
      input: NovaVendaInput
    ): Promise<{
      contratanteId: string;
      contratanteSnapshot: ContratanteSnapshot;
    }> => {
      let contratanteId: string;
      let contratanteSnapshot: ContratanteSnapshot = {
        nome: "",
        email: "",
        telefone: "",
        documento: "",
        razaoSocial: "",
      };

      if (input.contratante.tipo === "existente") {
        contratanteId = input.contratante.id;
        const patch: Record<string, string | undefined> = {};
        if (input.contratante.nomeNovo !== undefined) patch.nome = input.contratante.nomeNovo;
        if (input.contratante.emailNovo !== undefined) patch.email = input.contratante.emailNovo;
        if (input.contratante.telefoneNovo !== undefined) patch.telefone = input.contratante.telefoneNovo;
        if (input.contratante.documentoNovo !== undefined) patch.documento = input.contratante.documentoNovo;
        if (input.contratante.razaoSocialNovo !== undefined) patch.razaoSocial = input.contratante.razaoSocialNovo;
        if (input.contratante.documentoTipo !== undefined) patch.documentoTipo = input.contratante.documentoTipo;
        if (input.contratante.paisNovo !== undefined) patch.pais = input.contratante.paisNovo;
        if (input.contratante.cidadeIdNovo !== undefined) patch.cidadeId = input.contratante.cidadeIdNovo;
        if (input.contratante.enderecoNovo !== undefined) patch.endereco = input.contratante.enderecoNovo;
        const snap = input.contratante.snapshot;
        if (snap) contratanteSnapshot = { ...snap, razaoSocial: snap.razaoSocial ?? "" };
        if (Object.keys(patch).length > 0) {
          try {
            const atual = await updateContratante(contratanteId, patch);
            if (!snap) {
              contratanteSnapshot = {
                nome: atual.nome ?? "",
                email: atual.email ?? "",
                telefone: atual.telefone ?? "",
                documento: atual.documento ?? "",
                razaoSocial: atual.razaoSocial ?? "",
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
                razaoSocial: patch.razaoSocial ?? "",
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
          razaoSocial: input.contratante.razaoSocial,
          documentoTipo: input.contratante.documentoTipo,
          pais: input.contratante.pais,
          cidadeId: input.contratante.cidadeId,
        });
        contratanteId = novo.id;
        // Snapshot da razão social vem do RETORNO do servidor: é ele que decide
        // se ela sobrevive (só quando CNPJ — migração 91).
        contratanteSnapshot = {
          nome: novo.nome,
          email: novo.email ?? "",
          telefone: novo.telefone,
          documento: novo.documento ?? "",
          razaoSocial: novo.razaoSocial ?? "",
        };
      }

      return { contratanteId, contratanteSnapshot };
    },
    [addContratante, updateContratante]
  );

  /**
   * Payload snake_case da venda. `parcelas` e `info_extra` só entram quando o
   * input trouxe: omitir a chave é o que diz ao servidor "não mexa nisso" (D5).
   */
  const montarPayloadVenda = useCallback(
    (
      input: NovaVendaInput,
      contratanteId: string,
      contratanteSnapshot: ContratanteSnapshot
    ): Record<string, unknown> => {
      const payload: Record<string, unknown> = {
        contratante_id: contratanteId,
        contratante_nome: contratanteSnapshot.nome,
        contratante_email: contratanteSnapshot.email,
        contratante_telefone: contratanteSnapshot.telefone,
        contratante_documento: contratanteSnapshot.documento,
        contratante_razao_social: contratanteSnapshot.razaoSocial || null,
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
      };
      // `info_extra` NÃO tem campo no form: mandá-lo sempre faria a edição
      // zerar o texto que o detalhe da venda gravou. Mesma regra das parcelas —
      // só vai quando o input trouxe (a criação força a chave logo abaixo).
      if (input.infoExtra !== undefined) payload.info_extra = input.infoExtra || null;
      if (input.parcelas) {
        payload.parcelas = input.parcelas.map((p) => ({
          percentual: p.percentual,
          valor: p.valor,
          data_vencimento: p.dataVencimento || null,
          status_base: p.statusBase,
          data_pagamento: p.dataPagamento || null,
          observacao: p.observacao ?? null,
        }));
      }
      return payload;
    },
    []
  );

  const criarVenda = useCallback(
    async (input: NovaVendaInput): Promise<Venda> => {
      // 1) Resolver contratante (existente → atualizar; novo → criar)
      const { contratanteId, contratanteSnapshot } = await resolverContratanteDoInput(input);

      // 2) Monta payload da venda (snake_case)
      const payload = montarPayloadVenda(input, contratanteId, contratanteSnapshot);
      payload.orcamento_id = input.orcamentoId ?? null;
      // Na criação a chave é sempre explícita: null aqui é o sinal pro servidor
      // reherdar o info_extra do orçamento (criarVendaCompleta).
      payload.info_extra = input.infoExtra ?? null;
      // A criação sempre manda parcelas (o form valida) — `?? []` só satisfaz o
      // tipo agora opcional (a edição é quem pode omitir).
      if (!payload.parcelas) payload.parcelas = [];

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
    [resolverContratanteDoInput, montarPayloadVenda, recarregarShows]
  );

  /**
   * Edição completa: MESMO input/payload da criação, via PATCH. Sem
   * `orcamento_id` — a origem da venda não muda numa edição.
   */
  const atualizarVendaCompleta = useCallback(
    async (
      id: string,
      input: NovaVendaInput
    ): Promise<{ venda: Venda; parcelasPreservadas: boolean }> => {
      const { contratanteId, contratanteSnapshot } = await resolverContratanteDoInput(input);
      const payload = montarPayloadVenda(input, contratanteId, contratanteSnapshot);

      const res = await fetch(`/api/vendas/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await jsonOuErro(res);
      const atual = body.venda as Venda;

      // O artista PODE mudar na edição — vale o do input (espelha o `comDj` da
      // criação, já que a resposta redigida pode não trazer o artist_id).
      setVendas((prev) =>
        prev.map((v) => (v.id === id ? { ...v, ...atual, artistaId: input.artistaId } : v))
      );
      // O servidor sincronizou o show — a agenda local precisa acompanhar.
      void recarregarShows();

      return { venda: atual, parcelasPreservadas: body.parcelasPreservadas === true };
    },
    [resolverContratanteDoInput, montarPayloadVenda, recarregarShows]
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
      atualizarVendaCompleta,
      updateVenda,
      removeVenda,
      atualizarParcela,
      acaoParcela,
    }),
    [
      vendas,
      carregando,
      erro,
      recarregar,
      criarVenda,
      atualizarVendaCompleta,
      updateVenda,
      removeVenda,
      atualizarParcela,
      acaoParcela,
    ]
  );

  return <VendasContext.Provider value={value}>{children}</VendasContext.Provider>;
}

export function useVendas() {
  const ctx = useContext(VendasContext);
  if (!ctx) throw new Error("useVendas deve ser usado dentro de <VendasProvider>");
  return ctx;
}
