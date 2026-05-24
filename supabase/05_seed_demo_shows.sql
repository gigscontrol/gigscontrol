-- ============================================================
-- GIGS CONTROL — 05_seed_demo_shows.sql
-- Etapa 3: 1 show de demonstração + suas dependências mínimas.
--
-- Como usar:
--   Supabase → SQL Editor → New query → cole este arquivo → Run.
--   Pode rodar de novo sem duplicar (idempotente via on conflict).
--
-- Para apagar tudo depois do teste, ver bloco "ROLLBACK" no fim.
-- ============================================================

-- Constantes usadas no seed (todos uuid fixos para idempotência)
--   workspace TWO DASH = 11111111-1111-1111-1111-111111111111
--   bruno (admin)      = 64800812-d3bc-42eb-9849-c826cbda2b36

-- ------------------------------------------------------------
-- 1. Artista (CZ)
-- ------------------------------------------------------------
insert into artists (id, workspace_id, nome, cor)
values (
  'a0000001-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'CZ',
  '#ef4444'
)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2. Cidade (São Paulo / SP)
-- ------------------------------------------------------------
insert into cidades (id, workspace_id, nome, estado)
values (
  'c0000001-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'São Paulo',
  'SP'
)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 3. Casa (Club Laroc)
-- ------------------------------------------------------------
insert into casas (id, workspace_id, nome, tipo, cidade_id, capacidade, endereco)
values (
  'b0000001-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Club Laroc',
  'club',
  'c0000001-0000-0000-0000-000000000001',
  1200,
  'Rua Augusta, 1500 — Consolação, São Paulo/SP'
)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 4. Contratante (Marcos Lima)
-- ------------------------------------------------------------
insert into contratantes (
  id, workspace_id, nome, documento, email, telefone, endereco, cidade_id, criado_por
)
values (
  'd0000001-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Marcos Lima',
  '123.456.789-00',
  'marcos@laroc.com.br',
  '5511999990001',
  'Rua Augusta, 1500',
  'c0000001-0000-0000-0000-000000000001',
  '64800812-d3bc-42eb-9849-c826cbda2b36'
)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 5. Show de demonstração — na data de hoje, 23:30
-- ------------------------------------------------------------
insert into shows (
  id, workspace_id, artist_id, contratante_id, casa_id, cidade_id,
  data, horario, status, valor
)
values (
  'e0000001-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'a0000001-0000-0000-0000-000000000001',
  'd0000001-0000-0000-0000-000000000001',
  'b0000001-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000001',
  current_date,
  '23:30',
  'confirmado',
  18000
)
on conflict (id) do nothing;

-- Confere o que foi inserido
select s.id, a.nome as artista, ca.nome as casa, ci.nome as cidade,
       s.data, s.horario, s.status, s.valor
  from shows s
  left join artists a on a.id = s.artist_id
  left join casas ca on ca.id = s.casa_id
  left join cidades ci on ci.id = s.cidade_id
 where s.workspace_id = '11111111-1111-1111-1111-111111111111';

-- ============================================================
-- ROLLBACK (rode só se quiser apagar os dados de demo)
-- ============================================================
-- delete from shows        where id = 'e0000001-0000-0000-0000-000000000001';
-- delete from contratantes where id = 'd0000001-0000-0000-0000-000000000001';
-- delete from casas        where id = 'b0000001-0000-0000-0000-000000000001';
-- delete from cidades      where id = 'c0000001-0000-0000-0000-000000000001';
-- delete from artists      where id = 'a0000001-0000-0000-0000-000000000001';
