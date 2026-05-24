import type { SupabaseClient } from "@supabase/supabase-js";
import type { VendaRow, VendaEscrita } from "@/lib/mappers/venda";

const COLS = `
  id, workspace_id, numero, orcamento_id, show_id,
  contratante_id, contratante_nome, contratante_email,
  contratante_telefone, contratante_documento, contratante_endereco,
  nome_evento, evento_instagram, nome_local, capacidade_publico, endereco_local,
  data_show, horario, horario_fim, cidade_id, casa_id, artist_id,
  line_up, cache, duracao_horas, duracao_minutos,
  camarim, efeitos, hotel, logistica, observacoes,
  criado_por, criado_em, atualizado_em
`;

export async function listarVendas(
  supabase: SupabaseClient,
  aplicarFiltro?: <Q>(q: Q) => Q
): Promise<VendaRow[]> {
  let q = supabase
    .from("vendas")
    .select(COLS)
    .order("criado_em", { ascending: false });
  if (aplicarFiltro) q = aplicarFiltro(q);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as VendaRow[];
}

export async function buscarVenda(
  supabase: SupabaseClient,
  id: string
): Promise<VendaRow | null> {
  const { data, error } = await supabase
    .from("vendas")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as VendaRow) ?? null;
}

export async function proximoNumeroVenda(
  supabase: SupabaseClient
): Promise<string> {
  const { data, error } = await supabase
    .from("vendas")
    .select("numero")
    .order("criado_em", { ascending: false })
    .limit(50);
  if (error) throw error;
  const max = (data ?? []).reduce((acc, v) => {
    const n = parseInt(String(v.numero).replace(/\D/g, ""), 10);
    return isNaN(n) ? acc : Math.max(acc, n);
  }, 0);
  return `VND-${String(max + 1).padStart(4, "0")}`;
}

export async function criarVendaRow(
  supabase: SupabaseClient,
  workspaceId: string,
  criadoPor: string,
  payload: VendaEscrita
): Promise<VendaRow> {
  const { data, error } = await supabase
    .from("vendas")
    .insert({ ...payload, workspace_id: workspaceId, criado_por: criadoPor })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as VendaRow;
}

export async function atualizarVendaRow(
  supabase: SupabaseClient,
  id: string,
  payload: VendaEscrita
): Promise<VendaRow> {
  const { data, error } = await supabase
    .from("vendas")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as VendaRow;
}

export async function removerVendaRow(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  // Parcelas tem ON DELETE CASCADE no schema, então caem juntas.
  const { error } = await supabase.from("vendas").delete().eq("id", id);
  if (error) throw error;
}
