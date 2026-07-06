import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lê o fuso horário padrão da agência (workspaces.fuso_padrao). Usado pra
 * default do fuso_horario de eventos novos (venda/orçamento) quando o form não
 * mandou um. Retorna null se não configurado. Display-only.
 */
export async function buscarFusoPadrao(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("workspaces")
    .select("fuso_padrao")
    .eq("id", workspaceId)
    .maybeSingle<{ fuso_padrao: string | null }>();
  return data?.fuso_padrao ?? null;
}
