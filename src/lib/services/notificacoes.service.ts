import type { SupabaseClient } from "@supabase/supabase-js";
import {
  rowParaNotificacao,
  type Notificacao,
  type TipoNotificacao,
} from "@/lib/mappers/notificacao";
import {
  inserirNotificacoes,
  listarNotificacoes,
  contarNaoLidas as repoContarNaoLidas,
  marcarComoLida as repoMarcarComoLida,
  marcarTodasComoLidas as repoMarcarTodasComoLidas,
  type ListarNotificacoesParams,
} from "@/lib/repositories/notificacoes.repo";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

export type PayloadNotificacao = {
  titulo: string;
  mensagem: string;
  link?: string | null;
  tipo?: TipoNotificacao;
  modulo?: string | null;
  entidadeId?: string | null;
};

/**
 * Notifica TODOS os admins ativos do workspace (exceto o autor da
 * ação, pra não ver notificação de si mesmo). Usa admin client pra
 * bypassar RLS na escrita.
 */
export async function notificarAdmins(
  workspaceId: string,
  autorId: string | null,
  payload: PayloadNotificacao
): Promise<void> {
  const admin = criarClienteAdmin();

  // Busca admins do workspace (excluindo deletados e o próprio autor)
  let query = admin
    .from("profiles")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("papel", "admin")
    .eq("status", "ativo")
    .is("deletado_em", null);
  if (autorId) query = query.neq("id", autorId);

  const { data: admins, error } = await query;
  if (error) {
    console.error("[notificacoes] falha ao buscar admins:", error.message);
    return;
  }
  if (!admins || admins.length === 0) return;

  const payloads = admins.map((a) => ({
    workspace_id: workspaceId,
    destinatario_id: a.id as string,
    titulo: payload.titulo,
    mensagem: payload.mensagem,
    link: payload.link ?? null,
    tipo: payload.tipo ?? "info",
    modulo: payload.modulo ?? null,
    entidade_id: payload.entidadeId ?? null,
  }));

  await inserirNotificacoes(admin, payloads);
}

/**
 * Notifica UM usuário específico (ex.: aviso direto pra alguém da
 * equipe que teve a senha resetada).
 */
export async function notificarUsuario(
  workspaceId: string,
  destinatarioId: string,
  payload: PayloadNotificacao
): Promise<void> {
  const admin = criarClienteAdmin();
  await inserirNotificacoes(admin, [
    {
      workspace_id: workspaceId,
      destinatario_id: destinatarioId,
      titulo: payload.titulo,
      mensagem: payload.mensagem,
      link: payload.link ?? null,
      tipo: payload.tipo ?? "info",
      modulo: payload.modulo ?? null,
      entidade_id: payload.entidadeId ?? null,
    },
  ]);
}

// ====================== Leitura (próprias) ======================

export async function listarMinhasNotificacoes(
  supabase: SupabaseClient,
  destinatarioId: string,
  filtros: Omit<ListarNotificacoesParams, "destinatarioId"> = {}
): Promise<Notificacao[]> {
  const rows = await listarNotificacoes(supabase, {
    destinatarioId,
    ...filtros,
  });
  return rows.map(rowParaNotificacao);
}

export async function contarMinhasNaoLidas(
  supabase: SupabaseClient,
  destinatarioId: string
): Promise<number> {
  return repoContarNaoLidas(supabase, destinatarioId);
}

export async function marcarLidaPorId(
  supabase: SupabaseClient,
  id: string,
  destinatarioId: string
): Promise<void> {
  await repoMarcarComoLida(supabase, id, destinatarioId);
}

export async function marcarTodasMinhasLidas(
  supabase: SupabaseClient,
  destinatarioId: string
): Promise<void> {
  await repoMarcarTodasComoLidas(supabase, destinatarioId);
}
