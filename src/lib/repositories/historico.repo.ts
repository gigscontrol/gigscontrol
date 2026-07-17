import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  HistorioAcaoRow,
  HistoricoEscrita,
  ModuloHistorico,
} from "@/lib/mappers/historico";

const COLS =
  "id, workspace_id, actor_id, actor_nome, actor_email, modulo, tipo, entidade_id, entidade_nome, descricao, dados, criado_em";

/**
 * Insere uma linha no histórico. Best-effort: erros não propagam pra
 * não derrubar a operação principal (criar venda etc).
 */
export async function inserirHistorico(
  supabase: SupabaseClient,
  payload: HistoricoEscrita
): Promise<void> {
  try {
    const { error } = await supabase.from("historico_acoes").insert(payload);
    if (error) {
      // Não rethrow — histórico não deve interromper a operação.
      console.error("[historico] falha ao registrar:", error.message);
    }
  } catch (e) {
    console.error("[historico] exceção ao registrar:", (e as Error).message);
  }
}

export type ListarHistoricoParams = {
  workspaceId: string;
  modulo?: ModuloHistorico;
  actorId?: string;
  /** Rastro de UMA entidade (ex.: o histórico de alterações de uma venda). */
  entidadeId?: string;
  desde?: string;  // ISO timestamp (inclusive)
  limit?: number;
  offset?: number;
};

export async function listarHistorico(
  supabase: SupabaseClient,
  params: ListarHistoricoParams
): Promise<HistorioAcaoRow[]> {
  let q = supabase
    .from("historico_acoes")
    .select(COLS)
    .eq("workspace_id", params.workspaceId)
    .order("criado_em", { ascending: false });

  if (params.modulo) q = q.eq("modulo", params.modulo);
  if (params.actorId) q = q.eq("actor_id", params.actorId);
  if (params.entidadeId) q = q.eq("entidade_id", params.entidadeId);
  if (params.desde) q = q.gte("criado_em", params.desde);

  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as HistorioAcaoRow[];
}

/**
 * Cargo ATUAL dos autores das ações (o histórico só guarda nome/email). Uma
 * query batch pros ids da página, não uma por linha.
 *
 * NÃO filtra `deletado_em`: sair da equipe é soft delete e o cargo do ex-membro
 * segue aparecendo (de propósito — o rastro é antifraude, e quem agiu tinha o
 * cargo). Só o purge físico tira a linha.
 *
 * Best-effort: falha ou autor invisível (RLS de outro workspace) devolve mapa
 * sem a chave — o rastro exibe nome+data sem o cargo em vez de quebrar.
 */
export async function buscarPapeisDosAutores(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (!ids.length) return mapa;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, papel")
      .in("id", ids);
    if (error) {
      console.error("[historico] falha ao buscar cargos (ignorada):", error.message);
      return mapa;
    }
    for (const row of (data ?? []) as { id: string; papel: string | null }[]) {
      if (row.papel) mapa.set(row.id, row.papel);
    }
  } catch (e) {
    console.error("[historico] exceção ao buscar cargos (ignorada):", (e as Error).message);
  }
  return mapa;
}
