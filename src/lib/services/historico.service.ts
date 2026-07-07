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
  // Best-effort de verdade (ver JSDoc): loga e NÃO propaga — uma falha aqui não
  // pode derrubar a operação principal, que já foi commitada antes desta chamada.
  try {
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
  } catch (e) {
    console.error("[historico] falha ao registrar ação (ignorada):", e);
  }
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

/**
 * Combina audit() + notificarAdmins() numa só chamada. Use nos
 * handlers de eventos importantes que devem aparecer tanto no
 * histórico quanto no sino dos admins.
 *
 * O autor da ação NÃO recebe a notificação (notificarAdmins exclui
 * o autorId do destinatário).
 */
export async function auditAndNotify(
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
    /** Override do título/mensagem da notificação. Default: usa a descricao. */
    notificacao?: {
      titulo?: string;
      mensagem?: string;
      link?: string | null;
      tipo?: "info" | "sucesso" | "aviso" | "alerta";
    };
  }
): Promise<void> {
  // Import dinâmico pra evitar ciclo entre services.
  const { notificarAdmins } = await import("./notificacoes.service");
  // allSettled: uma falha de notificação NÃO derruba a rota (a operação já
  // commitou). registrarAcao já é best-effort; aqui protegemos o notificarAdmins.
  const resultados = await Promise.allSettled([
    audit(sessao, params),
    notificarAdmins(sessao.workspaceId, sessao.userId, {
      titulo: params.notificacao?.titulo ?? params.descricao,
      mensagem:
        params.notificacao?.mensagem ??
        `${sessao.userNome ?? "Alguém"} • ${params.descricao}`,
      link: params.notificacao?.link ?? null,
      tipo: params.notificacao?.tipo ?? "info",
      modulo: params.modulo,
      entidadeId: params.entidadeId ?? null,
    }),
  ]);
  for (const rr of resultados) {
    if (rr.status === "rejected") {
      console.error("[auditAndNotify] etapa falhou (ignorada):", rr.reason);
    }
  }
}
