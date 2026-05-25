import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  NotificacaoRow,
  NotificacaoEscrita,
} from "@/lib/mappers/notificacao";

const COLS =
  "id, workspace_id, destinatario_id, titulo, mensagem, link, tipo, modulo, entidade_id, lida_em, criado_em";

/**
 * Insere uma ou mais notificações em lote. Best-effort: erros não
 * propagam — uma falha aqui não derruba a operação que disparou.
 */
export async function inserirNotificacoes(
  supabase: SupabaseClient,
  payloads: NotificacaoEscrita[]
): Promise<void> {
  if (payloads.length === 0) return;
  try {
    const { error } = await supabase.from("notificacoes").insert(payloads);
    if (error) {
      console.error("[notificacoes] falha ao inserir:", error.message);
    }
  } catch (e) {
    console.error("[notificacoes] exceção:", (e as Error).message);
  }
}

export type ListarNotificacoesParams = {
  destinatarioId: string;
  apenasNaoLidas?: boolean;
  limit?: number;
  offset?: number;
};

export async function listarNotificacoes(
  supabase: SupabaseClient,
  params: ListarNotificacoesParams
): Promise<NotificacaoRow[]> {
  let q = supabase
    .from("notificacoes")
    .select(COLS)
    .eq("destinatario_id", params.destinatarioId)
    .order("criado_em", { ascending: false });

  if (params.apenasNaoLidas) q = q.is("lida_em", null);

  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as NotificacaoRow[];
}

export async function contarNaoLidas(
  supabase: SupabaseClient,
  destinatarioId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("destinatario_id", destinatarioId)
    .is("lida_em", null);
  if (error) throw error;
  return count ?? 0;
}

export async function marcarComoLida(
  supabase: SupabaseClient,
  id: string,
  destinatarioId: string
): Promise<void> {
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("id", id)
    .eq("destinatario_id", destinatarioId)
    .is("lida_em", null);
  if (error) throw error;
}

export async function marcarTodasComoLidas(
  supabase: SupabaseClient,
  destinatarioId: string
): Promise<void> {
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("destinatario_id", destinatarioId)
    .is("lida_em", null);
  if (error) throw error;
}
