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

/**
 * Assinaturas de exemplo. A primeira (ws-two) é a conta de demonstração
 * acessível via login two/two.
 */
export const MOCK_ASSINATURAS: Assinatura[] = [
  {
    workspaceId: "ws-two",
    nomeWorkspace: "TWO DASH",
    responsavel: "Equipe TWO",
    email: "two",
    plano: "agencia-plus",
    ciclo: "anual",
    moeda: "brl",
    status: "ativa",
    artistasEmUso: 4,
    usuariosEmUso: 6,
    inicioEm: "2025-11-01",
    proximaCobranca: "2026-11-01",
  },
  {
    workspaceId: "ws-002",
    nomeWorkspace: "Lunar Booking",
    responsavel: "Carla Esteves",
    email: "carla@lunarbooking.com",
    plano: "agencia",
    ciclo: "anual",
    moeda: "brl",
    status: "ativa",
    artistasEmUso: 8,
    usuariosEmUso: 11,
    inicioEm: "2025-08-15",
    proximaCobranca: "2026-08-15",
  },
  {
    workspaceId: "ws-003",
    nomeWorkspace: "Beat Collective",
    responsavel: "Rodrigo Nunes",
    email: "rodrigo@beatcollective.com",
    plano: "equipe",
    ciclo: "mensal",
    moeda: "brl",
    status: "ativa",
    artistasEmUso: 3,
    usuariosEmUso: 4,
    inicioEm: "2026-02-10",
    proximaCobranca: "2026-06-10",
  },
  {
    workspaceId: "ws-004",
    nomeWorkspace: "DJ Marcos Vieira",
    responsavel: "Marcos Vieira",
    email: "marcos@djvieira.com",
    plano: "individual",
    ciclo: "mensal",
    moeda: "brl",
    status: "ativa",
    artistasEmUso: 1,
    usuariosEmUso: 1,
    inicioEm: "2026-03-22",
    proximaCobranca: "2026-06-22",
  },
  {
    workspaceId: "ws-005",
    nomeWorkspace: "Prime Talent",
    responsavel: "Juliana Prado",
    email: "juliana@primetalent.com",
    plano: "agencia-max",
    ciclo: "anual",
    moeda: "brl",
    status: "ativa",
    artistasEmUso: 32,
    usuariosEmUso: 54,
    inicioEm: "2025-06-01",
    proximaCobranca: "2026-06-01",
  },
  {
    workspaceId: "ws-006",
    nomeWorkspace: "Nightfall Agency",
    responsavel: "Pedro Salles",
    email: "pedro@nightfall.com",
    plano: "equipe",
    ciclo: "mensal",
    moeda: "brl",
    status: "trial",
    artistasEmUso: 2,
    usuariosEmUso: 2,
    inicioEm: "2026-05-12",
    proximaCobranca: "2026-05-26",
  },
  {
    workspaceId: "ws-007",
    nomeWorkspace: "Groove Management",
    responsavel: "Tatiana Lima",
    email: "tatiana@groovemgmt.com",
    plano: "agencia",
    ciclo: "anual",
    moeda: "brl",
    status: "suspensa",
    artistasEmUso: 6,
    usuariosEmUso: 9,
    inicioEm: "2025-09-30",
    proximaCobranca: "2026-09-30",
  },
  {
    workspaceId: "ws-008",
    nomeWorkspace: "MC Studio Booking",
    responsavel: "André Castro",
    email: "andre@mcstudio.com",
    plano: "individual",
    ciclo: "anual",
    moeda: "brl",
    status: "cancelada",
    artistasEmUso: 0,
    usuariosEmUso: 0,
    inicioEm: "2025-07-05",
    proximaCobranca: "2026-07-05",
  },
];

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

export const MOCK_USUARIOS_PLATAFORMA: UsuarioPlataforma[] = [
  { id: "u-001", nome: "Equipe TWO", email: "two", workspaceId: "ws-two", nomeWorkspace: "TWO DASH", papel: "admin", status: "ativo", ultimoAcesso: "2026-05-21T13:40:00Z", criadoEm: "2025-11-01" },
  { id: "u-002", nome: "Rafael Souza", email: "rafael@twodash.com", workspaceId: "ws-two", nomeWorkspace: "TWO DASH", papel: "vendedor", status: "ativo", ultimoAcesso: "2026-05-21T11:10:00Z", criadoEm: "2025-11-03" },
  { id: "u-003", nome: "CZ", email: "cz@twodash.com", workspaceId: "ws-two", nomeWorkspace: "TWO DASH", papel: "artista", status: "ativo", ultimoAcesso: "2026-05-20T22:05:00Z", criadoEm: "2025-11-05" },
  { id: "u-004", nome: "Marina Dias", email: "marina@twodash.com", workspaceId: "ws-two", nomeWorkspace: "TWO DASH", papel: "financeiro", status: "ativo", ultimoAcesso: "2026-05-21T09:30:00Z", criadoEm: "2025-11-10" },
  { id: "u-005", nome: "Carla Esteves", email: "carla@lunarbooking.com", workspaceId: "ws-002", nomeWorkspace: "Lunar Booking", papel: "admin", status: "ativo", ultimoAcesso: "2026-05-21T08:00:00Z", criadoEm: "2025-08-15" },
  { id: "u-006", nome: "Diego Martins", email: "diego@lunarbooking.com", workspaceId: "ws-002", nomeWorkspace: "Lunar Booking", papel: "produtor", status: "ativo", ultimoAcesso: "2026-05-19T17:20:00Z", criadoEm: "2025-08-20" },
  { id: "u-007", nome: "Rodrigo Nunes", email: "rodrigo@beatcollective.com", workspaceId: "ws-003", nomeWorkspace: "Beat Collective", papel: "admin", status: "ativo", ultimoAcesso: "2026-05-18T14:00:00Z", criadoEm: "2026-02-10" },
  { id: "u-008", nome: "Beatriz Lima", email: "bia@beatcollective.com", workspaceId: "ws-003", nomeWorkspace: "Beat Collective", papel: "vendedor", status: "bloqueado", ultimoAcesso: "2026-05-02T10:00:00Z", criadoEm: "2026-02-12" },
  { id: "u-009", nome: "Marcos Vieira", email: "marcos@djvieira.com", workspaceId: "ws-004", nomeWorkspace: "DJ Marcos Vieira", papel: "admin", status: "ativo", ultimoAcesso: "2026-05-21T07:15:00Z", criadoEm: "2026-03-22" },
  { id: "u-010", nome: "Juliana Prado", email: "juliana@primetalent.com", workspaceId: "ws-005", nomeWorkspace: "Prime Talent", papel: "admin", status: "ativo", ultimoAcesso: "2026-05-21T12:50:00Z", criadoEm: "2025-06-01" },
  { id: "u-011", nome: "Thiago Reis", email: "thiago@primetalent.com", workspaceId: "ws-005", nomeWorkspace: "Prime Talent", papel: "vendedor", status: "ativo", ultimoAcesso: "2026-05-20T19:40:00Z", criadoEm: "2025-06-10" },
  { id: "u-012", nome: "Pedro Salles", email: "pedro@nightfall.com", workspaceId: "ws-006", nomeWorkspace: "Nightfall Agency", papel: "admin", status: "ativo", ultimoAcesso: "2026-05-21T10:25:00Z", criadoEm: "2026-05-12" },
  { id: "u-013", nome: "Tatiana Lima", email: "tatiana@groovemgmt.com", workspaceId: "ws-007", nomeWorkspace: "Groove Management", papel: "admin", status: "desativado", ultimoAcesso: "2026-04-28T16:00:00Z", criadoEm: "2025-09-30" },
  { id: "u-014", nome: "André Castro", email: "andre@mcstudio.com", workspaceId: "ws-008", nomeWorkspace: "MC Studio Booking", papel: "admin", status: "desativado", ultimoAcesso: "2026-03-15T13:00:00Z", criadoEm: "2025-07-05" },
];

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
