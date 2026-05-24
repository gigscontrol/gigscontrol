-- ============================================================
-- flow.book — 04_usuarios_demo.sql
-- Passo 2: cria o workspace e os profiles dos usuários de teste
-- ============================================================
-- PRÉ-REQUISITO: os dois usuários já devem existir em
-- Authentication → Users (criados pelo painel do Supabase).
--
-- Como usar:
--   Supabase → SQL Editor → New query → cole este arquivo → Run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Workspace do cliente (a agência de demonstração)
-- ------------------------------------------------------------
insert into workspaces (id, nome, plano, ciclo, status)
values (
  '11111111-1111-1111-1111-111111111111',
  'TWO DASH',
  'agencia-plus',
  'anual',
  'ativa'
)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2. Profile do CLIENTE (admin do workspace)
--    UID: brunorafaelsocek@outlook.com
-- ------------------------------------------------------------
insert into profiles (id, workspace_id, nome, email, papel, is_super_admin, status)
values (
  '64800812-d3bc-42eb-9849-c826cbda2b36',
  '11111111-1111-1111-1111-111111111111',
  'Bruno Rafael',
  'brunorafaelsocek@outlook.com',
  'admin',
  false,
  'ativo'
)
on conflict (id) do update set
  workspace_id = excluded.workspace_id,
  nome         = excluded.nome,
  email        = excluded.email,
  papel        = excluded.papel,
  is_super_admin = excluded.is_super_admin,
  status       = excluded.status;

-- ------------------------------------------------------------
-- 3. Profile do SUPER-ADMIN (administrador da plataforma)
--    UID: gigscontrol26@gmail.com
--    Sem workspace — ele administra a plataforma inteira.
-- ------------------------------------------------------------
insert into profiles (id, workspace_id, nome, email, papel, is_super_admin, status)
values (
  'e3704b49-4ad7-4e4d-926c-3ccd2adaf38a',
  null,
  'Administrador flow.book',
  'gigscontrol26@gmail.com',
  'admin',
  true,
  'ativo'
)
on conflict (id) do update set
  workspace_id = excluded.workspace_id,
  nome         = excluded.nome,
  email        = excluded.email,
  papel        = excluded.papel,
  is_super_admin = excluded.is_super_admin,
  status       = excluded.status;

-- ------------------------------------------------------------
-- 4. Assinatura do workspace (para o painel super-admin)
-- ------------------------------------------------------------
insert into subscriptions (workspace_id, plano, ciclo, status, valor, inicio_em, proxima_cobranca)
values (
  '11111111-1111-1111-1111-111111111111',
  'agencia-plus',
  'anual',
  'ativa',
  999.90,
  '2025-11-01',
  '2026-11-01'
)
on conflict do nothing;

-- ------------------------------------------------------------
-- Conferência — deve listar os 2 profiles criados
-- ------------------------------------------------------------
select
  p.email,
  p.papel,
  p.is_super_admin,
  coalesce(w.nome, '— plataforma —') as workspace
from profiles p
left join workspaces w on w.id = p.workspace_id
order by p.is_super_admin desc;

-- ============================================================
-- Fim do 04_usuarios_demo.sql
-- ============================================================
