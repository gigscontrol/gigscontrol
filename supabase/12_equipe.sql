-- ============================================================
-- GIGS CONTROL — 12_equipe.sql
-- Etapa 7c (Equipe): coluna `escopo` jsonb em profiles para
-- guardar as flags de privacidade (verTodosContatos, verTodasVendas,
-- editarTodosEventos).
--
-- Idempotente.
-- ============================================================

alter table profiles
  add column if not exists escopo jsonb not null default '{}'::jsonb;

-- Confere
select id, nome, email, papel, status, escopo
  from profiles
 where workspace_id = '11111111-1111-1111-1111-111111111111'
 order by papel;
