-- =============================================================
-- 18_notificacoes.sql
-- =============================================================
-- Sistema de notificações in-app por usuário.
--
-- Cada linha pertence a UM destinatário (`destinatario_id`). Quando
-- uma ação afeta vários admins, criamos várias linhas — uma por
-- admin — todas com o mesmo conteúdo.
--
-- Escrita: bloqueada pra cliente. Só service_role insere (via
-- `notificarAdmins`/`notificarUsuario` no backend), garantindo que
-- notificações não podem ser forjadas pelo cliente.
--
-- Leitura: cada usuário lê APENAS as próprias notificações.
-- =============================================================

create table if not exists notificacoes (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  destinatario_id uuid not null,

  titulo          text not null,
  mensagem        text not null,
  link            text,
  tipo            text not null default 'info'
                    check (tipo in ('info', 'sucesso', 'aviso', 'alerta')),
  modulo          text,
  entidade_id     uuid,

  lida_em         timestamptz,
  criado_em       timestamptz not null default now()
);

create index if not exists idx_notificacoes_destinatario_data
  on notificacoes (destinatario_id, criado_em desc);

create index if not exists idx_notificacoes_nao_lidas
  on notificacoes (destinatario_id, lida_em)
  where lida_em is null;

create index if not exists idx_notificacoes_workspace
  on notificacoes (workspace_id);

-- RLS
alter table notificacoes enable row level security;

-- LEITURA: só as próprias
drop policy if exists "notificacoes_leitura_propria" on notificacoes;
create policy "notificacoes_leitura_propria" on notificacoes
  for select using (destinatario_id = auth.uid());

-- ATUALIZAÇÃO: só posso marcar as MINHAS como lidas
drop policy if exists "notificacoes_marcar_propria" on notificacoes;
create policy "notificacoes_marcar_propria" on notificacoes
  for update using (destinatario_id = auth.uid())
  with check (destinatario_id = auth.uid());

-- INSERT/DELETE: nenhuma policy = bloqueado pra autenticated.
-- Backend usa service_role pra escrever.

-- Super-admin tem acesso total (admin do app)
drop policy if exists "notificacoes_super_admin" on notificacoes;
create policy "notificacoes_super_admin" on notificacoes
  for all using (sou_super_admin()) with check (sou_super_admin());
