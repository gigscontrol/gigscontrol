import type { PlanoId, CicloCobranca, Moeda } from "./planos";

/**
 * Dados da PLATAFORMA GIGS CONTROL — visíveis apenas para o super-admin.
 *
 * Cada "assinatura" é um workspace de cliente. Nesta fase é tudo mockado;
 * com Supabase viria da tabela `workspaces` + `subscriptions`.
 */

export type StatusAssinatura = "ativa" | "trial" | "suspensa" | "cancelada";

export type Assinatura = {
  workspaceId: string;
  nomeWorkspace: string;
  /** Nome do dono da conta (Admin do workspace) */
  responsavel: string;
  email: string;
  plano: PlanoId;
  ciclo: CicloCobranca;
  /** Moeda de cobrança da assinatura (derivada do país do workspace). */
  moeda: Moeda;
  status: StatusAssinatura;
  /** Quantidade de artistas em uso */
  artistasEmUso: number;
  /** Quantidade de usuários da equipe em uso */
  usuariosEmUso: number;
  /** Data de início da assinatura (ISO) */
  inicioEm: string;
  /** Data da próxima cobrança (ISO), ou null (trial expirado / sem cobrança) */
  proximaCobranca: string | null;
  /**
   * Dias restantes do plano (trial/graça → até o prazo; ativa → até a
   * cobrança). Negativo = expirado. null = não aplicável.
   */
  diasRestantes?: number | null;
};

export const LABELS_STATUS_ASSINATURA: Record<
  StatusAssinatura,
  { label: string; badge: string }
> = {
  ativa: { label: "Ativa", badge: "badge-success" },
  trial: { label: "Em teste", badge: "badge-warning" },
  suspensa: { label: "Suspensa", badge: "badge-danger" },
  cancelada: { label: "Cancelada", badge: "badge-neutral" },
};


// ============================================================
// USUÁRIOS DA PLATAFORMA (todos os logins de todos os workspaces)
// ============================================================

export type StatusUsuario = "ativo" | "bloqueado" | "desativado";

/** Um usuário pertencente a algum workspace, visto pelo super-admin */
export type UsuarioPlataforma = {
  id: string;
  nome: string;
  email: string;
  /** workspace ao qual pertence */
  workspaceId: string;
  nomeWorkspace: string;
  papel: "admin" | "artista" | "vendedor" | "produtor" | "financeiro";
  status: StatusUsuario;
  ultimoAcesso: string; // ISO
  criadoEm: string; // ISO
};

export const LABELS_STATUS_USUARIO: Record<
  StatusUsuario,
  { label: string; badge: string }
> = {
  ativo: { label: "Ativo", badge: "badge-success" },
  bloqueado: { label: "Bloqueado", badge: "badge-danger" },
  desativado: { label: "Desativado", badge: "badge-neutral" },
};


// ============================================================
// RESUMO DE USO POR WORKSPACE (atividade do cliente na dashboard)
// ============================================================

/** Estatísticas de tudo que um cliente fez dentro da dashboard dele */
export type ResumoUsoWorkspace = {
  workspaceId: string;
  shows: number;
  orcamentos: number;
  vendas: number;
  contratantes: number;
  casas: number;
  /** Faturamento total registrado nas vendas (R$) */
  faturamento: number;
  /** Data do último pagamento da assinatura (ISO) */
  ultimoPagamento: string;
  /** Valor do último pagamento (R$) */
  valorUltimoPagamento: number;
};

export const MOCK_USO_WORKSPACE: ResumoUsoWorkspace[] = [
  { workspaceId: "ws-two", shows: 4, orcamentos: 6, vendas: 4, contratantes: 6, casas: 9, faturamento: 79000, ultimoPagamento: "2025-11-01", valorUltimoPagamento: 11998.8 },
  { workspaceId: "ws-002", shows: 47, orcamentos: 88, vendas: 52, contratantes: 34, casas: 41, faturamento: 612000, ultimoPagamento: "2026-05-15", valorUltimoPagamento: 499.9 },
  { workspaceId: "ws-003", shows: 19, orcamentos: 31, vendas: 22, contratantes: 15, casas: 18, faturamento: 248000, ultimoPagamento: "2026-05-10", valorUltimoPagamento: 349.9 },
  { workspaceId: "ws-004", shows: 8, orcamentos: 14, vendas: 9, contratantes: 7, casas: 6, faturamento: 96000, ultimoPagamento: "2026-05-22", valorUltimoPagamento: 149.9 },
  { workspaceId: "ws-005", shows: 124, orcamentos: 210, vendas: 138, contratantes: 89, casas: 96, faturamento: 1840000, ultimoPagamento: "2026-05-01", valorUltimoPagamento: 1799.9 },
  { workspaceId: "ws-006", shows: 3, orcamentos: 5, vendas: 2, contratantes: 4, casas: 3, faturamento: 38000, ultimoPagamento: "2026-05-12", valorUltimoPagamento: 0 },
  { workspaceId: "ws-007", shows: 28, orcamentos: 44, vendas: 31, contratantes: 22, casas: 25, faturamento: 354000, ultimoPagamento: "2026-04-30", valorUltimoPagamento: 499.9 },
  { workspaceId: "ws-008", shows: 11, orcamentos: 17, vendas: 12, contratantes: 9, casas: 10, faturamento: 132000, ultimoPagamento: "2026-02-05", valorUltimoPagamento: 119.9 },
];

export function getUsoWorkspace(workspaceId: string): ResumoUsoWorkspace | undefined {
  return MOCK_USO_WORKSPACE.find((u) => u.workspaceId === workspaceId);
}
