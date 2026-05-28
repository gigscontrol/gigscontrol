-- ============================================================
-- 24: WORKSPACES — histórico de trocas do slug + limite de cota
-- ============================================================
-- Quando o admin troca o `slug` da agência (ex: twobookings →
-- twodash2026), precisamos:
--   1. Garantir que o slug novo está disponível (já é UNIQUE).
--   2. Limitar a 3 trocas em 30 dias (janela móvel) — evitar abuso.
--   3. Registrar a troca pra auditoria (quem trocou, quando, de/pra).
--
-- A operação de cascata (renomear todos os profiles.username do
-- workspace que terminam em -slug_antigo) é feita pelo service no
-- backend, transacional via lock no row do workspace.
-- ============================================================

create table if not exists workspace_slug_history (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  slug_anterior text not null,
  slug_novo     text not null,
  alterado_por  uuid references profiles(id) on delete set null,
  alterado_em   timestamptz not null default now()
);

create index if not exists workspace_slug_history_ws_idx
  on workspace_slug_history(workspace_id, alterado_em desc);

-- Habilita RLS — só admin do workspace lê o histórico
alter table workspace_slug_history enable row level security;

drop policy if exists "workspace_slug_history_select_admin"
  on workspace_slug_history;

create policy "workspace_slug_history_select_admin"
  on workspace_slug_history for select
  using (
    workspace_id in (
      select workspace_id from profiles
       where id = auth.uid()
         and papel = 'admin'
    )
  );

-- Função pra contar trocas dos últimos 30 dias do workspace.
-- Usada pelo service antes de aceitar uma nova troca.
create or replace function trocas_slug_ultimos_30d(p_workspace_id uuid)
returns int
language sql stable as $$
  select count(*)::int
    from workspace_slug_history
   where workspace_id = p_workspace_id
     and alterado_em > now() - interval '30 days';
$$;
