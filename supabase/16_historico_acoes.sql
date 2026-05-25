-- =============================================================
-- 16_historico_acoes.sql
-- =============================================================
-- Trilha de auditoria por workspace: registra ações importantes
-- realizadas por usuários (criar venda, aceitar orçamento, etc).
--
-- Modelo: append-only. Linhas são inseridas pelo backend via
-- service_role (criarClienteAdmin) — assim ignora RLS na escrita
-- mas a leitura via cliente normal continua filtrada pelo
-- workspace_id do usuário.
--
-- Snapshots: guardamos `actor_nome`, `actor_email` e `entidade_nome`
-- como texto pra manter o histórico legível mesmo depois que o
-- usuário ou a entidade forem removidos.
-- =============================================================

create table if not exists historico_acoes (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,

  -- Autor da ação
  actor_id      uuid,  -- ref. auth.users (sem FK rígida pra sobreviver à exclusão)
  actor_nome    text,
  actor_email   text,

  -- Classificação
  modulo        text not null,
  tipo          text not null,

  -- Entidade afetada
  entidade_id   uuid,
  entidade_nome text,

  -- Display
  descricao     text not null,
  dados         jsonb,

  criado_em     timestamptz not null default now()
);

-- Índices: o uso principal é listar do workspace ordenado por data desc,
-- com filtros opcionais por módulo / actor.
create index if not exists idx_historico_workspace_data
  on historico_acoes (workspace_id, criado_em desc);

create index if not exists idx_historico_actor
  on historico_acoes (workspace_id, actor_id);

create index if not exists idx_historico_modulo
  on historico_acoes (workspace_id, modulo);

-- RLS
alter table historico_acoes enable row level security;

-- LEITURA: usuários do workspace lêem suas próprias linhas.
-- (Decisão de produto: na v1 só admin vê na UI, mas o backend
-- já libera no RLS — o filtro fica no service handler.)
drop policy if exists "historico_leitura" on historico_acoes;
create policy "historico_leitura" on historico_acoes
  for select using (
    workspace_id = (
      select workspace_id from profiles where id = auth.uid()
    )
  );

-- ESCRITA: bloqueada pra cliente normal. Só o service_role
-- (admin client) consegue inserir, garantindo que a trilha não
-- pode ser forjada pelo cliente.
drop policy if exists "historico_escrita_proibida" on historico_acoes;
-- (sem policy de INSERT/UPDATE/DELETE = bloqueado pra autenticated)

-- Super-admin tem acesso total
drop policy if exists "historico_super_admin" on historico_acoes;
create policy "historico_super_admin" on historico_acoes
  for all using (sou_super_admin()) with check (sou_super_admin());
