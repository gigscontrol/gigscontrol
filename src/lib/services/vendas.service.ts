import type { SupabaseClient } from "@supabase/supabase-js";
import type { Venda, Parcela } from "@/types";
import {
  rowParaVenda,
  rowParaParcela,
  type VendaEscrita,
  type ParcelaEscrita,
} from "@/lib/mappers/venda";
import {
  listarVendas as repoListar,
  buscarVenda as repoBuscar,
  proximoNumeroVenda,
  criarVendaRow,
  atualizarVendaRow,
  removerVendaRow,
} from "@/lib/repositories/vendas.repo";
import { sincronizarShowNoGoogle } from "@/lib/google/calendario";
import {
  listarParcelasDaVenda,
  listarTodasParcelas,
  inserirParcelasEmLote,
  atualizarParcelaRow,
} from "@/lib/repositories/parcelas.repo";
import type {
  VendaCreateInput,
  VendaUpdateInput,
  ParcelaUpdateInput,
} from "@/lib/validators/vendas.schema";
import { criarShowNoWorkspace, atualizarShowPorId } from "@/lib/services/shows.service";
import { atualizarOrcamentoPorId, buscarOrcamentoPorId } from "@/lib/services/orcamentos.service";
import type { SessaoAutenticada } from "@/lib/api/session";
import { aplicarFiltroVendas } from "@/lib/api/permissoes";

/** Orçamento já tem uma venda ativa — bloqueia concretizar de novo. */
export class VendaDuplicadaError extends Error {
  status = 409;
  constructor(public numeroExistente: string) {
    super(
      `Este orçamento já foi concretizado na venda ${numeroExistente}. ` +
        `Abra a venda existente em vez de criar outra.`
    );
    this.name = "VendaDuplicadaError";
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function normalizarUuid(v: string | null | undefined): string | null {
  if (!v) return null;
  return UUID_RE.test(v) ? v : null;
}

function vendaInputParaEscrita(
  input: VendaCreateInput | VendaUpdateInput
): VendaEscrita {
  const out: VendaEscrita = {};
  if (input.orcamento_id !== undefined) out.orcamento_id = normalizarUuid(input.orcamento_id ?? null);
  if (input.contratante_id !== undefined) out.contratante_id = normalizarUuid(input.contratante_id ?? null);
  if (input.contratante_nome !== undefined) out.contratante_nome = input.contratante_nome;
  if (input.contratante_email !== undefined) out.contratante_email = input.contratante_email;
  if (input.contratante_telefone !== undefined) out.contratante_telefone = input.contratante_telefone;
  if (input.contratante_documento !== undefined) out.contratante_documento = input.contratante_documento;
  if (input.contratante_endereco !== undefined) out.contratante_endereco = input.contratante_endereco;
  if (input.nome_evento !== undefined) out.nome_evento = input.nome_evento;
  if (input.evento_instagram !== undefined) out.evento_instagram = input.evento_instagram;
  if (input.nome_local !== undefined) out.nome_local = input.nome_local;
  if (input.capacidade_publico !== undefined) out.capacidade_publico = input.capacidade_publico;
  if (input.endereco_local !== undefined) out.endereco_local = input.endereco_local;
  if (input.data_show !== undefined) out.data_show = input.data_show;
  if (input.horario !== undefined) out.horario = input.horario;
  if (input.horario_fim !== undefined) out.horario_fim = input.horario_fim;
  if (input.cidade_id !== undefined) out.cidade_id = normalizarUuid(input.cidade_id ?? null);
  if (input.casa_id !== undefined) out.casa_id = normalizarUuid(input.casa_id ?? null);
  if (input.artist_id !== undefined) out.artist_id = normalizarUuid(input.artist_id ?? null);
  if (input.line_up !== undefined) out.line_up = input.line_up;
  if (input.cache !== undefined) out.cache = input.cache;
  if (input.duracao_horas !== undefined) out.duracao_horas = input.duracao_horas;
  if (input.duracao_minutos !== undefined) out.duracao_minutos = input.duracao_minutos;
  if (input.camarim !== undefined) out.camarim = input.camarim;
  if (input.efeitos !== undefined) out.efeitos = input.efeitos;
  if (input.hotel !== undefined) out.hotel = input.hotel;
  if (input.logistica !== undefined) out.logistica = input.logistica;
  if (input.observacoes !== undefined) out.observacoes = input.observacoes;
  if (input.info_extra !== undefined) out.info_extra = input.info_extra;
  return out;
}

async function carregarVendaCompleta(
  supabase: SupabaseClient,
  id: string
): Promise<Venda | null> {
  const row = await repoBuscar(supabase, id);
  if (!row) return null;
  const parcelas = await listarParcelasDaVenda(supabase, id);
  return rowParaVenda(row, parcelas.map(rowParaParcela));
}

export async function listarVendasDoWorkspace(
  supabase: SupabaseClient,
  sessao?: SessaoAutenticada
): Promise<Venda[]> {
  const filtro = sessao
    ? <Q,>(q: Q) => aplicarFiltroVendas(q as never, sessao) as Q
    : undefined;
  const [vendas, todasParcelas] = await Promise.all([
    repoListar(supabase, filtro),
    listarTodasParcelas(supabase),
  ]);
  const porVenda = new Map<string, Parcela[]>();
  for (const p of todasParcelas) {
    const arr = porVenda.get(p.venda_id) ?? [];
    arr.push(rowParaParcela(p));
    porVenda.set(p.venda_id, arr);
  }
  return vendas.map((v) => rowParaVenda(v, porVenda.get(v.id) ?? []));
}

export async function buscarVendaPorId(
  supabase: SupabaseClient,
  id: string
): Promise<Venda | null> {
  return carregarVendaCompleta(supabase, id);
}

/**
 * Cria uma venda. Orquestra:
 *   1) gera número
 *   2) insere venda
 *   3) insere parcelas (se houver)
 *   4) se há orcamento_id: cria show novo (ou atualiza existente do orçamento)
 *      e vincula show_id na venda; marca o orçamento como aceito.
 *   5) se NÃO há orcamento_id: cria show direto e vincula.
 */
export async function criarVendaCompleta(
  supabase: SupabaseClient,
  workspaceId: string,
  criadoPor: string,
  input: VendaCreateInput
): Promise<Venda> {
  // 0: guard anti-duplicação. Se este orçamento já tem uma venda ATIVA,
  // não cria outra. Protege contra double-click / re-concretização (bug
  // que gerou duas VND-0003 do mesmo ORC-0004).
  if (input.orcamento_id) {
    const { data: existente } = await supabase
      .from("vendas")
      .select("id, numero")
      .eq("orcamento_id", input.orcamento_id)
      .is("deletado_em", null)
      .limit(1)
      .maybeSingle();
    if (existente) {
      throw new VendaDuplicadaError(existente.numero as string);
    }
  }

  // 1 + 2: cria a venda
  const escrita = vendaInputParaEscrita(input);
  escrita.numero = await proximoNumeroVenda(supabase);
  // Herda info_extra do orçamento se o input não trouxe um próprio.
  // Cliente concretizar pode editar antes; se não editou, assume o do
  // orçamento como ponto de partida.
  if (
    (escrita.info_extra === undefined || escrita.info_extra === null) &&
    input.orcamento_id
  ) {
    const orc = await buscarOrcamentoPorId(supabase, input.orcamento_id);
    if (orc?.infoExtra) {
      escrita.info_extra = orc.infoExtra;
    }
  }
  const vendaRow = await criarVendaRow(supabase, workspaceId, criadoPor, escrita);

  // 3: parcelas (se houver)
  const parcelasPayload: ParcelaEscrita[] = (input.parcelas ?? []).map((p) => ({
    percentual: p.percentual,
    valor: p.valor,
    data_vencimento: p.data_vencimento ?? null,
    status_base: p.status_base ?? "pendente",
    data_pagamento: p.data_pagamento ?? null,
    observacao: p.observacao ?? null,
  }));
  const parcelasInseridas = await inserirParcelasEmLote(
    supabase,
    workspaceId,
    vendaRow.id,
    parcelasPayload
  );

  // 4 + 5: sincronizar show
  let showIdFinal: string | null = null;
  if (input.data_show) {
    const showPayload = {
      artist_id: normalizarUuid(input.artist_id ?? null),
      contratante_id: normalizarUuid(input.contratante_id ?? null),
      casa_id: normalizarUuid(input.casa_id ?? null),
      cidade_id: normalizarUuid(input.cidade_id ?? null),
      data: input.data_show,
      horario: input.horario ?? null,
      status: "confirmado" as const,
      valor: input.cache ?? null,
      orcamento_id: normalizarUuid(input.orcamento_id ?? null),
      venda_id: vendaRow.id,
    };

    if (input.orcamento_id) {
      const orc = await buscarOrcamentoPorId(supabase, input.orcamento_id);
      if (orc?.showId) {
        await atualizarShowPorId(supabase, orc.showId, showPayload);
        showIdFinal = orc.showId;
      } else {
        const show = await criarShowNoWorkspace(supabase, workspaceId, showPayload);
        showIdFinal = show.id;
      }
      // Atualiza o orçamento (aceito + show_id + data/horario sincronizados)
      await atualizarOrcamentoPorId(supabase, input.orcamento_id, {
        status: "aceito",
        show_id: showIdFinal,
        data_show: input.data_show,
        horario: input.horario ?? null,
        casa_id: normalizarUuid(input.casa_id ?? null),
      });
    } else {
      const show = await criarShowNoWorkspace(supabase, workspaceId, showPayload);
      showIdFinal = show.id;
    }

    // Persistir show_id na venda
    await atualizarVendaRow(supabase, vendaRow.id, { show_id: showIdFinal });

    // Google Calendar (best-effort): cria o evento de dia inteiro no
    // calendário do artista conectado. Falha aqui NÃO quebra a venda.
    if (showIdFinal && input.artist_id) {
      try {
        await sincronizarShowNoGoogle(supabase, {
          artistId: input.artist_id,
          showId: showIdFinal,
          input,
        });
      } catch (e) {
        console.error("[google-calendar] falha ao sincronizar show:", e);
      }
    }
  }

  // Retorno consistente: re-busca a venda já com show_id e parcelas resolvidas
  const final = await carregarVendaCompleta(supabase, vendaRow.id);
  if (!final) {
    // fallback improvável
    return rowParaVenda(
      { ...vendaRow, show_id: showIdFinal },
      parcelasInseridas.map(rowParaParcela)
    );
  }
  return final;
}

export async function atualizarVendaPorId(
  supabase: SupabaseClient,
  id: string,
  input: VendaUpdateInput
): Promise<Venda> {
  await atualizarVendaRow(supabase, id, vendaInputParaEscrita(input));
  const final = await carregarVendaCompleta(supabase, id);
  if (!final) throw new Error("Venda não encontrada após atualização.");
  return final;
}

export async function removerVendaPorId(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await removerVendaRow(supabase, id);
}

// ---------- Parcelas ----------

export async function atualizarParcelaPorId(
  supabase: SupabaseClient,
  id: string,
  input: ParcelaUpdateInput
): Promise<Parcela> {
  const payload: ParcelaEscrita = {};
  if (input.percentual !== undefined) payload.percentual = input.percentual;
  if (input.valor !== undefined) payload.valor = input.valor;
  if (input.data_vencimento !== undefined) payload.data_vencimento = input.data_vencimento;
  if (input.status_base !== undefined) payload.status_base = input.status_base;
  // Sincroniza dataPagamento conforme status_base
  if (input.data_pagamento !== undefined) {
    payload.data_pagamento = input.data_pagamento;
  } else if (input.status_base === "pago") {
    payload.data_pagamento = new Date().toISOString().slice(0, 10);
  } else if (input.status_base === "pendente") {
    payload.data_pagamento = null;
  }
  if (input.observacao !== undefined) payload.observacao = input.observacao;

  const row = await atualizarParcelaRow(supabase, id, payload);
  return rowParaParcela(row);
}
