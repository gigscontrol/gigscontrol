/**
 * Tipos do módulo Histórico de Ações.
 *
 * `tipo` e `modulo` são livres no banco (text), mas tipados aqui pra
 * autocomplete e detecção de typos.
 */

export type ModuloHistorico =
  | "venda"
  | "orcamento"
  | "parcela"
  | "show"
  | "artista"
  | "equipe"
  | "contato"
  | "aparencia"
  | "lixeira";

export type TipoHistorico =
  | "criar"
  | "editar"
  | "remover"
  | "restaurar"
  | "aceitar"
  | "pagar"
  | "desfazer-pagamento"
  | "cancelar"
  | "cobranca"
  | "suspender"
  | "resetar-senha"
  | "upload-logo"
  | "remover-logo";

export type HistorioAcaoRow = {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  actor_nome: string | null;
  actor_email: string | null;
  modulo: string;
  tipo: string;
  entidade_id: string | null;
  entidade_nome: string | null;
  descricao: string;
  dados: Record<string, unknown> | null;
  criado_em: string;
};

export type HistoricoAcao = {
  id: string;
  workspaceId: string;
  actorId: string | null;
  actorNome: string | null;
  actorEmail: string | null;
  modulo: ModuloHistorico;
  tipo: TipoHistorico;
  entidadeId: string | null;
  entidadeNome: string | null;
  descricao: string;
  dados: Record<string, unknown> | null;
  criadoEm: string;
};

export function rowParaHistorico(row: HistorioAcaoRow): HistoricoAcao {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    actorId: row.actor_id,
    actorNome: row.actor_nome,
    actorEmail: row.actor_email,
    modulo: row.modulo as ModuloHistorico,
    tipo: row.tipo as TipoHistorico,
    entidadeId: row.entidade_id,
    entidadeNome: row.entidade_nome,
    descricao: row.descricao,
    dados: row.dados,
    criadoEm: row.criado_em,
  };
}

export type HistoricoEscrita = {
  workspace_id: string;
  actor_id: string | null;
  actor_nome: string | null;
  actor_email: string | null;
  modulo: ModuloHistorico;
  tipo: TipoHistorico;
  entidade_id: string | null;
  entidade_nome: string | null;
  descricao: string;
  dados?: Record<string, unknown> | null;
};
