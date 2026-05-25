import type { SupabaseClient } from "@supabase/supabase-js";
import {
  rowParaHistorico,
  type HistoricoAcao,
  type ModuloHistorico,
  type TipoHistorico,
} from "@/lib/mappers/historico";
import {
  inserirHistorico,
  listarHistorico,
  type ListarHistoricoParams,
} from "@/lib/repositories/historico.repo";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * Snapshot do autor da ação. Permite que o histórico continue legível
 * mesmo depois que o profile do usuário for removido.
 */
export type AutorAcao = {
  id: string;
  nome: string | null;
  email: string | null;
};

/**
 * Registra uma ação no histórico. Best-effort — falhas são logadas
 * mas NÃO propagam, pra não derrubar a operação principal (ex.:
 * criar venda não falha se o insert no histórico falhar).
 *
 * Usa cliente admin (service_role) pra ignorar RLS na escrita —
 * o RLS só libera SELECT pro workspace e a inserção é feita só
 * pelo backend (controlada).
 */
export async function registrarAcao(params: {
  workspaceId: string;
  autor: AutorAcao | null;
  modulo: ModuloHistorico;
  tipo: TipoHistorico;
  entidadeId?: string | null;
  entidadeNome?: string | null;
  descricao: string;
  dados?: Record<string, unknown> | null;
}): Promise<void> {
  const admin = criarClienteAdmin();
  await inserirHistorico(admin, {
    workspace_id: params.workspaceId,
    actor_id: params.autor?.id ?? null,
    actor_nome: params.autor?.nome ?? null,
    actor_email: params.autor?.email ?? null,
    modulo: params.modulo,
    tipo: params.tipo,
    entidade_id: params.entidadeId ?? null,
    entidade_nome: params.entidadeNome ?? null,
    descricao: params.descricao,
    dados: params.dados ?? null,
  });
}

export type ListarHistoricoFiltros = Omit<ListarHistoricoParams, "workspaceId">;

export async function listarHistoricoDoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  filtros: ListarHistoricoFiltros = {}
): Promise<HistoricoAcao[]> {
  const rows = await listarHistorico(supabase, { workspaceId, ...filtros });
  return rows.map(rowParaHistorico);
}

/**
 * Açúcar pra chamar registrarAcao() direto a partir do objeto sessão
 * de um Route Handler. Aproveita o snapshot do autor (nome+email) que
 * já vem em SessaoAutenticada.
 */
export async function audit(
  sessao: {
    userId: string;
    userNome: string | null;
    userEmail: string | null;
    workspaceId: string;
  },
  params: {
    modulo: ModuloHistorico;
    tipo: TipoHistorico;
    entidadeId?: string | null;
    entidadeNome?: string | null;
    descricao: string;
    dados?: Record<string, unknown> | null;
  }
): Promise<void> {
  await registrarAcao({
    workspaceId: sessao.workspaceId,
    autor: {
      id: sessao.userId,
      nome: sessao.userNome,
      email: sessao.userEmail,
    },
    ...params,
  });
}
