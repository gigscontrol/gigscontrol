import type { SupabaseClient } from "@supabase/supabase-js";
import type { Orcamento, Show } from "@/types";
import {
  rowParaOrcamento,
  type OrcamentoEscrita,
} from "@/lib/mappers/orcamento";
import {
  listarOrcamentos as repoListar,
  buscarOrcamento as repoBuscar,
  proximoNumeroOrcamento,
  criarOrcamento as repoCriar,
  atualizarOrcamento as repoAtualizar,
  removerOrcamento as repoRemover,
} from "@/lib/repositories/orcamentos.repo";
import type {
  OrcamentoCreateInput,
  OrcamentoUpdateInput,
} from "@/lib/validators/orcamentos.schema";
import { criarShowNoWorkspace } from "@/lib/services/shows.service";
import { resolverTaxaAgencia } from "@/lib/services/taxaAgencia.service";
import { buscarFusoPadrao } from "@/lib/services/workspacePrefs.service";
import type { SessaoAutenticada } from "@/lib/api/session";
import { aplicarFiltroOrcamentos } from "@/lib/api/permissoes";

/** Aceita uuid; qualquer outra coisa vira null. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function normalizarUuid(v: string | null | undefined): string | null {
  if (!v) return null;
  return UUID_RE.test(v) ? v : null;
}

function entradaParaEscrita(
  input: OrcamentoCreateInput | OrcamentoUpdateInput
): OrcamentoEscrita {
  const out: OrcamentoEscrita = {};
  if (input.status !== undefined) out.status = input.status;
  if (input.tipo_evento !== undefined) out.tipo_evento = input.tipo_evento;
  if (input.contratante_id !== undefined)
    out.contratante_id = normalizarUuid(input.contratante_id ?? null);
  if (input.casa_id !== undefined)
    out.casa_id = normalizarUuid(input.casa_id ?? null);
  if (input.cidade_id !== undefined)
    out.cidade_id = normalizarUuid(input.cidade_id ?? null);
  if (input.artist_id !== undefined)
    out.artist_id = normalizarUuid(input.artist_id ?? null);
  if (input.valor_cache !== undefined) out.valor_cache = input.valor_cache;
  if (input.moeda !== undefined) out.moeda = input.moeda;
  if (input.duracao_horas !== undefined) out.duracao_horas = input.duracao_horas;
  if (input.duracao_minutos !== undefined)
    out.duracao_minutos = input.duracao_minutos;
  if (input.camarim !== undefined) out.camarim = input.camarim;
  if (input.efeitos !== undefined) out.efeitos = input.efeitos;
  if (input.hotel !== undefined) out.hotel = input.hotel;
  if (input.logistica !== undefined) out.logistica = input.logistica;
  if (input.observacoes !== undefined) out.observacoes = input.observacoes;
  if (input.info_extra !== undefined) out.info_extra = input.info_extra;
  if (input.detalhes_evento !== undefined)
    out.detalhes_evento = input.detalhes_evento;
  if (input.data_show !== undefined) out.data_show = input.data_show;
  if (input.horario !== undefined) out.horario = input.horario;
  if (input.fuso_horario !== undefined) out.fuso_horario = input.fuso_horario;
  if (input.validade !== undefined) out.validade = input.validade;
  if (input.show_id !== undefined) out.show_id = input.show_id;
  return out;
}

export async function listarOrcamentosDoWorkspace(
  supabase: SupabaseClient,
  sessao?: SessaoAutenticada
): Promise<Orcamento[]> {
  const filtro = sessao
    ? <Q,>(q: Q) => aplicarFiltroOrcamentos(q as never, sessao) as Q
    : undefined;
  const rows = await repoListar(supabase, filtro);
  return rows.map(rowParaOrcamento);
}

/**
 * O orçamento `id` é visível para a sessão? Reusa o filtro da lista
 * (aplicarFiltroOrcamentos) estreitado ao id — zero divergência com a lista.
 * Fecha o vazamento de leitura por link direto no GET /orcamentos/[id].
 */
export async function orcamentoVisivelParaSessao(
  supabase: SupabaseClient,
  sessao: SessaoAutenticada,
  id: string
): Promise<boolean> {
  const rows = await repoListar(supabase, <Q,>(q: Q) =>
    (
      aplicarFiltroOrcamentos(q as never, sessao) as unknown as {
        eq(col: string, val: string): unknown;
      }
    ).eq("id", id) as Q
  );
  return rows.length > 0;
}

export async function buscarOrcamentoPorId(
  supabase: SupabaseClient,
  id: string
): Promise<Orcamento | null> {
  const row = await repoBuscar(supabase, id);
  return row ? rowParaOrcamento(row) : null;
}

export async function criarOrcamentoNoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  criadoPor: string,
  input: OrcamentoCreateInput
): Promise<Orcamento> {
  const escrita = entradaParaEscrita(input);
  escrita.numero = await proximoNumeroOrcamento(supabase, workspaceId);
  escrita.status = escrita.status ?? "pendente";
  // Taxa da agência (comissão) — calculada no servidor a partir do artista.
  const taxa = await resolverTaxaAgencia(supabase, {
    artistId: escrita.artist_id ?? null,
    cache: escrita.valor_cache ?? null,
    taxaDigitada: input.taxa_digitada,
  });
  if (taxa) {
    escrita.taxa_agencia_valor = taxa.taxa_agencia_valor;
    escrita.taxa_modo_aplicado = taxa.taxa_modo_aplicado;
  }
  // Default do fuso do horário = fuso padrão da agência (só rótulo).
  if (escrita.fuso_horario === undefined || escrita.fuso_horario === null) {
    escrita.fuso_horario = await buscarFusoPadrao(supabase, workspaceId);
  }
  const row = await repoCriar(supabase, workspaceId, criadoPor, escrita);
  return rowParaOrcamento(row);
}

export async function atualizarOrcamentoPorId(
  supabase: SupabaseClient,
  id: string,
  input: OrcamentoUpdateInput
): Promise<Orcamento> {
  const escrita = entradaParaEscrita(input);
  // Recalcula a taxa quando o que a define muda (artista/cachê/valor digitado);
  // busca o orçamento atual pra preencher o que não veio no patch.
  if (
    input.artist_id !== undefined ||
    input.valor_cache !== undefined ||
    input.taxa_digitada !== undefined
  ) {
    const atual = await buscarOrcamentoPorId(supabase, id);
    const artistId =
      input.artist_id !== undefined
        ? normalizarUuid(input.artist_id ?? null)
        : atual?.artistaId ?? null;
    const cache =
      input.valor_cache !== undefined ? input.valor_cache : atual?.valorCache ?? null;
    const taxa = await resolverTaxaAgencia(supabase, {
      artistId,
      cache,
      taxaDigitada: input.taxa_digitada,
      preservarVariavelSemInput: true,
    });
    if (taxa) {
      escrita.taxa_agencia_valor = taxa.taxa_agencia_valor;
      escrita.taxa_modo_aplicado = taxa.taxa_modo_aplicado;
    }
  }
  const row = await repoAtualizar(supabase, id, escrita);
  return rowParaOrcamento(row);
}

export async function removerOrcamentoPorId(
  supabase: SupabaseClient,
  id: string,
  deletadoPor?: string
): Promise<void> {
  await repoRemover(supabase, id, deletadoPor);
}

/**
 * Aceita o orçamento: muda status para "aceito" e, se ainda não houver
 * `show_id`, cria um show vinculado. Operação client-facing transacional
 * — o caller só recebe sucesso quando ambas as etapas concluem.
 *
 * Falha cedo se o orçamento não tiver data_show.
 */
export async function aceitarOrcamentoPorId(
  supabase: SupabaseClient,
  workspaceId: string,
  id: string
): Promise<{ orcamento: Orcamento; show: Show | null; faltamDados: boolean }> {
  const atual = await buscarOrcamentoPorId(supabase, id);
  if (!atual) throw new Error("Orçamento não encontrado.");

  // Sem data, só marca como aceito — sem criar show.
  if (!atual.dataShow) {
    const row = await repoAtualizar(supabase, id, { status: "aceito" });
    return {
      orcamento: rowParaOrcamento(row),
      show: null,
      faltamDados: true,
    };
  }

  // Já tem show vinculado — apenas garante status aceito.
  if (atual.showId) {
    const row = await repoAtualizar(supabase, id, { status: "aceito" });
    return { orcamento: rowParaOrcamento(row), show: null, faltamDados: false };
  }

  // Cria show + atualiza orçamento.
  const show = await criarShowNoWorkspace(supabase, workspaceId, {
    artist_id: normalizarUuid(atual.artistaId),
    contratante_id: normalizarUuid(atual.contratanteId),
    casa_id: normalizarUuid(atual.casaId ?? null),
    cidade_id: normalizarUuid(atual.cidadeId),
    data: atual.dataShow,
    horario: atual.horario ?? null,
    status: "confirmado",
    valor: atual.valorCache,
    orcamento_id: atual.id,
  });

  const row = await repoAtualizar(supabase, id, {
    status: "aceito",
    show_id: show.id,
  });

  return { orcamento: rowParaOrcamento(row), show, faltamDados: false };
}
