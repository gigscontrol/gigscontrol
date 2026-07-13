import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Soft-delete padrão do projeto: marca `deletado_em = now()` na linha por id.
 * Consolida o mesmo bloco antes copiado em ~12 repos. O escopo de
 * workspace/permissão é validado ANTES pela rota/serviço — o filtro aqui é só
 * por id (idêntico às implementações originais, que dependiam da RLS/validação
 * upstream).
 *
 * `deletadoPor` (opcional) grava também quem apagou (uuid → profiles). Quando
 * omitido, a coluna `deletado_por` fica null — retrocompatível com chamadas
 * antigas.
 */
export async function softDelete(
  supabase: SupabaseClient,
  tabela: string,
  id: string,
  deletadoPor?: string
): Promise<void> {
  const patch: { deletado_em: string; deletado_por?: string } = {
    deletado_em: new Date().toISOString(),
  };
  if (deletadoPor) patch.deletado_por = deletadoPor;
  const { error } = await supabase
    .from(tabela)
    .update(patch)
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
