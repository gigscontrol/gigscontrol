import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrcamentoRow, OrcamentoEscrita } from "@/lib/mappers/orcamento";

const COLS = `
  id, workspace_id, numero, status, tipo_evento,
  contratante_id, casa_id, cidade_id, artist_id,
  valor_cache, duracao_horas, duracao_minutos,
  camarim, efeitos, hotel, logistica, observacoes,
  data_show, horario, validade, show_id,
  criado_por, criado_em, atualizado_em
`;

export async function listarOrcamentos(
  supabase: SupabaseClient,
  aplicarFiltro?: <Q>(q: Q) => Q
): Promise<OrcamentoRow[]> {
  let q = supabase
    .from("orcamentos")
    .select(COLS)
    .order("criado_em", { ascending: false });
  if (aplicarFiltro) q = aplicarFiltro(q);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as OrcamentoRow[];
}

export async function buscarOrcamento(
  supabase: SupabaseClient,
  id: string
): Promise<OrcamentoRow | null> {
  const { data, error } = await supabase
    .from("orcamentos")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as OrcamentoRow) ?? null;
}

export async function proximoNumeroOrcamento(
  supabase: SupabaseClient
): Promise<string> {
  const { data, error } = await supabase
    .from("orcamentos")
    .select("numero")
    .order("criado_em", { ascending: false })
    .limit(50);
  if (error) throw error;
  const max = (data ?? []).reduce((acc, o) => {
    const n = parseInt(String(o.numero).replace(/\D/g, ""), 10);
    return isNaN(n) ? acc : Math.max(acc, n);
  }, 0);
  return `ORC-${String(max + 1).padStart(4, "0")}`;
}

export async function criarOrcamento(
  supabase: SupabaseClient,
  workspaceId: string,
  criadoPor: string,
  payload: OrcamentoEscrita
): Promise<OrcamentoRow> {
  const { data, error } = await supabase
    .from("orcamentos")
    .insert({ ...payload, workspace_id: workspaceId, criado_por: criadoPor })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as OrcamentoRow;
}

export async function atualizarOrcamento(
  supabase: SupabaseClient,
  id: string,
  payload: OrcamentoEscrita
): Promise<OrcamentoRow> {
  const { data, error } = await supabase
    .from("orcamentos")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as OrcamentoRow;
}

export async function removerOrcamento(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("orcamentos").delete().eq("id", id);
  if (error) throw error;
}
