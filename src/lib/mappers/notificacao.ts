/**
 * Tipos de Notificações.
 */

export type TipoNotificacao = "info" | "sucesso" | "aviso" | "alerta";

export type NotificacaoRow = {
  id: string;
  workspace_id: string;
  destinatario_id: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  tipo: string;
  modulo: string | null;
  entidade_id: string | null;
  lida_em: string | null;
  criado_em: string;
};

export type Notificacao = {
  id: string;
  workspaceId: string;
  destinatarioId: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  tipo: TipoNotificacao;
  modulo: string | null;
  entidadeId: string | null;
  lidaEm: string | null;
  criadoEm: string;
};

export function rowParaNotificacao(row: NotificacaoRow): Notificacao {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    destinatarioId: row.destinatario_id,
    titulo: row.titulo,
    mensagem: row.mensagem,
    link: row.link,
    tipo: (row.tipo as TipoNotificacao) ?? "info",
    modulo: row.modulo,
    entidadeId: row.entidade_id,
    lidaEm: row.lida_em,
    criadoEm: row.criado_em,
  };
}

export type NotificacaoEscrita = {
  workspace_id: string;
  destinatario_id: string;
  titulo: string;
  mensagem: string;
  link?: string | null;
  tipo?: TipoNotificacao;
  modulo?: string | null;
  entidade_id?: string | null;
};
