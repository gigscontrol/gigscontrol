-- ============================================================
-- flow.book — 02: ROW LEVEL SECURITY (policies)
-- ============================================================
-- Rode DEPOIS do 01_schema.sql.
--
-- O que este script faz:
--  - Liga o RLS em todas as tabelas.
--  - Cria 2 funções auxiliares: workspace do usuário logado, e se é super-admin.
--  - Cria as policies: cada usuário só acessa dados do PRÓPRIO workspace;
--    o super-admin acessa tudo.
-- ============================================================

-- ------------------------------------------------------------
-- FUNÇÕES AUXILIARES
-- ------------------------------------------------------------

-- Retorna o workspace_id do usuário logado (lido do profile dele)
create or replace function meu_workspace_id()
returns uuid
language sql stable security definer
as $$
  select workspace_id from profiles where id = auth.uid()
$$;

-- Retorna true se o usuário logado é super-admin da plataforma
create or replace function sou_super_admin()
returns boolean
language sql stable security definer
as $$
  select coalesce(
    (select is_super_admin from profiles where id = auth.uid()),
    false
  )
$$;

-- ------------------------------------------------------------
-- LIGAR RLS EM TODAS AS TABELAS
-- ------------------------------------------------------------
alter table plans          enable row level security;
alter table workspaces     enable row level security;
alter table profiles       enable row level security;
alter table artists        enable row level security;
alter table cidades        enable row level security;
alter table contratantes   enable row level security;
alter table casas          enable row level security;
alter table orcamentos     enable row level security;
alter table vendas         enable row level security;
alter table parcelas       enable row level security;
alter table shows          enable row level security;
alter table subscriptions  enable row level security;
alter table activity_logs  enable row level security;

-- ------------------------------------------------------------
-- PLANS — catálogo global: todos leem; só super-admin altera
-- ------------------------------------------------------------
drop policy if exists plans_leitura on plans;
create policy plans_leitura on plans
  for select using (true);

drop policy if exists plans_escrita on plans;
create policy plans_escrita on plans
  for all using (sou_super_admin()) with check (sou_super_admin());

-- ------------------------------------------------------------
-- WORKSPACES — vejo o meu; super-admin vê todos
-- ------------------------------------------------------------
drop policy if exists workspaces_leitura on workspaces;
create policy workspaces_leitura on workspaces
  for select using (id = meu_workspace_id() or sou_super_admin());

drop policy if exists workspaces_escrita on workspaces;
create policy workspaces_escrita on workspaces
  for all using (sou_super_admin()) with check (sou_super_admin());

-- ------------------------------------------------------------
-- PROFILES — vejo os do meu workspace; super-admin vê todos
-- ------------------------------------------------------------
drop policy if exists profiles_leitura on profiles;
create policy profiles_leitura on profiles
  for select using (
    id = auth.uid()
    or workspace_id = meu_workspace_id()
    or sou_super_admin()
  );

drop policy if exists profiles_escrita on profiles;
create policy profiles_escrita on profiles
  for all using (
    workspace_id = meu_workspace_id() or sou_super_admin()
  ) with check (
    workspace_id = meu_workspace_id() or sou_super_admin()
  );

-- ------------------------------------------------------------
-- TABELAS POR WORKSPACE — padrão: só o meu workspace (ou super-admin)
-- ------------------------------------------------------------
-- artists
drop policy if exists artists_tenant on artists;
create policy artists_tenant on artists
  for all using (workspace_id = meu_workspace_id() or sou_super_admin())
  with check (workspace_id = meu_workspace_id() or sou_super_admin());

-- cidades
drop policy if exists cidades_tenant on cidades;
create policy cidades_tenant on cidades
  for all using (workspace_id = meu_workspace_id() or sou_super_admin())
  with check (workspace_id = meu_workspace_id() or sou_super_admin());

-- contratantes
drop policy if exists contratantes_tenant on contratantes;
create policy contratantes_tenant on contratantes
  for all using (workspace_id = meu_workspace_id() or sou_super_admin())
  with check (workspace_id = meu_workspace_id() or sou_super_admin());

-- casas
drop policy if exists casas_tenant on casas;
create policy casas_tenant on casas
  for all using (workspace_id = meu_workspace_id() or sou_super_admin())
  with check (workspace_id = meu_workspace_id() or sou_super_admin());

-- orcamentos
drop policy if exists orcamentos_tenant on orcamentos;
create policy orcamentos_tenant on orcamentos
  for all using (workspace_id = meu_workspace_id() or sou_super_admin())
  with check (workspace_id = meu_workspace_id() or sou_super_admin());

-- vendas
drop policy if exists vendas_tenant on vendas;
create policy vendas_tenant on vendas
  for all using (workspace_id = meu_workspace_id() or sou_super_admin())
  with check (workspace_id = meu_workspace_id() or sou_super_admin());

-- parcelas
drop policy if exists parcelas_tenant on parcelas;
create policy parcelas_tenant on parcelas
  for all using (workspace_id = meu_workspace_id() or sou_super_admin())
  with check (workspace_id = meu_workspace_id() or sou_super_admin());

-- shows
drop policy if exists shows_tenant on shows;
create policy shows_tenant on shows
  for all using (workspace_id = meu_workspace_id() or sou_super_admin())
  with check (workspace_id = meu_workspace_id() or sou_super_admin());

-- subscriptions — leitura do meu workspace; escrita só super-admin
drop policy if exists subscriptions_leitura on subscriptions;
create policy subscriptions_leitura on subscriptions
  for select using (workspace_id = meu_workspace_id() or sou_super_admin());

drop policy if exists subscriptions_escrita on subscriptions;
create policy subscriptions_escrita on subscriptions
  for all using (sou_super_admin()) with check (sou_super_admin());

-- activity_logs
drop policy if exists logs_tenant on activity_logs;
create policy logs_tenant on activity_logs
  for all using (workspace_id = meu_workspace_id() or sou_super_admin())
  with check (workspace_id = meu_workspace_id() or sou_super_admin());

-- Pronto. Agora rode o 03_seed.sql
