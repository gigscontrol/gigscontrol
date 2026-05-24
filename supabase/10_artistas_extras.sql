-- ============================================================
-- GIGS CONTROL — 10_artistas_extras.sql
-- Etapa 7a: coluna acesso_suspenso em artists + os 3 artistas que
-- ainda faltavam (Dudu, Maninho, Blackdrumm).
--
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Schema: acesso_suspenso
-- ------------------------------------------------------------
alter table artists
  add column if not exists acesso_suspenso boolean not null default false;

-- ------------------------------------------------------------
-- 2. Artistas adicionais (workspace TWO DASH)
--    CZ já foi criado em 05_seed_demo_shows.sql (a0000001-...).
-- ------------------------------------------------------------
insert into artists (id, workspace_id, nome, cor) values
  ('a0000002-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Dudu',       '#22c55e'),
  ('a0000003-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Maninho',    '#a855f7'),
  ('a0000004-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Blackdrumm', '#3b82f6')
on conflict (id) do nothing;

-- Confere
select id, nome, cor, acesso_suspenso
  from artists
 where workspace_id = '11111111-1111-1111-1111-111111111111'
 order by nome;
