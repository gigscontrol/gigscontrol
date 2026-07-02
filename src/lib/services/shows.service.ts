import type { SupabaseClient } from "@supabase/supabase-js";
import type { Show } from "@/types";
import {
  rowParaShow,
  type ShowEscrita,
} from "@/lib/mappers/show";
import {
  listarShows as repoListar,
  buscarShow as repoBuscar,
  criarShow as repoCriar,
  atualizarShow as repoAtualizar,
  removerShow as repoRemover,
} from "@/lib/repositories/shows.repo";
import type {
  ShowCreateInput,
  ShowUpdateInput,
} from "@/lib/validators/shows.schema";
import type { SessaoAutenticada } from "@/lib/api/session";
import { aplicarFiltroShows } from "@/lib/api/permissoes";
import {
  marcarEventoCancelado,
  marcarEventoReativado,
} from "@/lib/google/calendario";

/**
 * Camada de negócio dos shows.
 *
 * Recebe sempre o `supabase` (cliente do servidor com a sessão do usuário) e,
 * para criação, o `workspaceId` resolvido a partir do profile do usuário.
 *
 * Por enquanto não há regras complexas — apenas o mapeamento entre o
 * payload validado (snake_case) e o tipo da UI (camelCase). Regras de
 * cruzamento (ex.: "show vinculado a venda só altera valor se a venda
 * permite") entram aqui quando a Etapa 6 chegar.
 */

function entradaParaEscrita(input: ShowCreateInput | ShowUpdateInput): ShowEscrita {
  const out: ShowEscrita = {};
  if (input.artist_id !== undefined) out.artist_id = input.artist_id;
  if (input.contratante_id !== undefined) out.contratante_id = input.contratante_id;
  if (input.casa_id !== undefined) out.casa_id = input.casa_id;
  if (input.cidade_id !== undefined) out.cidade_id = input.cidade_id;
  if (input.data !== undefined) out.data = input.data;
  if (input.horario !== undefined) out.horario = input.horario;
  if (input.status !== undefined) out.status = input.status;
  if (input.valor !== undefined) out.valor = input.valor;
  if (input.orcamento_id !== undefined) out.orcamento_id = input.orcamento_id;
  if (input.venda_id !== undefined) out.venda_id = input.venda_id;
  return out;
}

export async function listarShowsDoWorkspace(
  supabase: SupabaseClient,
  sessao?: SessaoAutenticada
): Promise<Show[]> {
  const filtro = sessao
    ? <Q,>(q: Q) => aplicarFiltroShows(q as never, sessao) as Q
    : undefined;
  const rows = await repoListar(supabase, filtro);
  return rows.map(rowParaShow);
}

export async function buscarShowPorId(
  supabase: SupabaseClient,
  id: string
): Promise<Show | null> {
  const row = await repoBuscar(supabase, id);
  return row ? rowParaShow(row) : null;
}

export async function criarShowNoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  input: ShowCreateInput,
  criadoPor?: string
): Promise<Show> {
  const escrita = entradaParaEscrita(input);
  if (criadoPor) escrita.criado_por = criadoPor;
  const row = await repoCriar(supabase, workspaceId, escrita);
  return rowParaShow(row);
}

export async function atualizarShowPorId(
  supabase: SupabaseClient,
  id: string,
  input: ShowUpdateInput
): Promise<Show> {
  const row = await repoAtualizar(supabase, id, entradaParaEscrita(input));

  // Google Calendar (best-effort): reflete cancelamento/reativação na COR do
  // evento. Nunca apaga; falha aqui NÃO quebra a atualização do show.
  if (input.status === "cancelado") {
    try {
      await marcarEventoCancelado(supabase, id);
    } catch (e) {
      console.error("[google-calendar] falha ao cancelar evento:", e);
    }
  } else if (input.status === "confirmado") {
    try {
      await marcarEventoReativado(supabase, id);
    } catch (e) {
      console.error("[google-calendar] falha ao reativar evento:", e);
    }
  }

  return rowParaShow(row);
}

export async function removerShowPorId(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await repoRemover(supabase, id);
}
