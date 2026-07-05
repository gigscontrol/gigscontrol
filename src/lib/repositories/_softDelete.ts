import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Soft-delete padrão do projeto: marca `deletado_em = now()` na linha por id.
 * Consolida o mesmo bloco antes copiado em ~12 repos. O escopo de
 * workspace/permissão é validado ANTES pela rota/serviço — o filtro aqui é só
 * por id (idêntico às implementações originais, que dependiam da RLS/validação
 * upstream).
 */
export async function softDelete(
  supabase: SupabaseClient,
  tabela: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from(tabela)
    .update({ deletado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Reverte o soft-delete (deletado_em = null). */
export async function restaurarSoftDelete(
  supabase: SupabaseClient,
  tabela: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from(tabela)
    .update({ deletado_em: null })
    .eq("id", id);
  if (error) throw error;
}
