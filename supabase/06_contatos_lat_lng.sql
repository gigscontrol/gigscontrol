-- ============================================================
-- GIGS CONTROL — 06_contatos_lat_lng.sql
-- Etapa 4 (Contatos + Mapa de Dobras):
--   1. Adiciona latitude/longitude em `cidades`.
--   2. Popula coordenadas das 10 cidades de referência (fonte IBGE).
--   3. Cria casas e contratantes-base para testes.
--
-- Idempotente (on conflict do nothing / do update).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Schema: lat/lng em cidades
-- ------------------------------------------------------------
alter table cidades add column if not exists latitude  numeric(10,7);
alter table cidades add column if not exists longitude numeric(10,7);

-- ------------------------------------------------------------
-- 2. 10 cidades de referência (todas no workspace TWO DASH)
--    Workspace TWO DASH = 11111111-1111-1111-1111-111111111111
-- ------------------------------------------------------------

-- A cidade São Paulo já foi criada em 05_seed_demo_shows.sql
-- (id = c0000001-0000-0000-0000-000000000001). Apenas atualizamos lat/lng.
update cidades
   set latitude = -23.5505, longitude = -46.6333
 where id = 'c0000001-0000-0000-0000-000000000001';

-- As demais cidades — id sequencial c0000002..c0000010
insert into cidades (id, workspace_id, nome, estado, latitude, longitude) values
  ('c0000002-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Rio de Janeiro', 'RJ', -22.9068, -43.1729),
  ('c0000003-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Belo Horizonte', 'MG', -19.9167, -43.9345),
  ('c0000004-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Curitiba',       'PR', -25.4284, -49.2733),
  ('c0000005-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Florianópolis',  'SC', -27.5949, -48.5482),
  ('c0000006-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Porto Alegre',   'RS', -30.0346, -51.2177),
  ('c0000007-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Campinas',       'SP', -22.9099, -47.0626),
  ('c0000008-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Salvador',       'BA', -12.9716, -38.5016),
  ('c0000009-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Recife',         'PE', -8.0578,  -34.8829),
  ('c0000010-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Goiânia',        'GO', -16.6864, -49.2643)
on conflict (id) do update set
  nome      = excluded.nome,
  estado    = excluded.estado,
  latitude  = excluded.latitude,
  longitude = excluded.longitude;

-- ------------------------------------------------------------
-- 3. Casas (algumas além da Club Laroc que já existe)
--    Casa Club Laroc já existe em 05_seed (b0000001-...).
-- ------------------------------------------------------------
insert into casas (id, workspace_id, nome, tipo, cidade_id, capacidade, endereco) values
  ('b0000002-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'D-Edge',     'club',          'c0000001-0000-0000-0000-000000000001',   800, 'Alameda Olga, 170 — Barra Funda, São Paulo/SP'),
  ('b0000003-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Privilège',  'club',          'c0000002-0000-0000-0000-000000000001',  1500, 'Av. Niemeyer, 121 — Rio de Janeiro/RJ'),
  ('b0000004-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Ame Club',   'club',          'c0000003-0000-0000-0000-000000000001',   600, 'Rua Pernambuco, 1000 — Belo Horizonte/MG'),
  ('b0000008-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'P12',        'festa-privada', 'c0000005-0000-0000-0000-000000000001',  2000, 'Av. dos Búzios, 1750 — Jurerê Internacional, Florianópolis/SC')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 4. Contratantes adicionais (além do Marcos Lima de 05_seed)
--    criado_por = Bruno (admin TWO DASH)
-- ------------------------------------------------------------
insert into contratantes (id, workspace_id, nome, documento, email, telefone, endereco, cidade_id, criado_por) values
  ('d0000002-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Renata Souza',    '987.654.321-00', 'renata@dedge.com.br',    '5511999990002', 'Alameda Olga, 170',          'c0000001-0000-0000-0000-000000000001', '64800812-d3bc-42eb-9849-c826cbda2b36'),
  ('d0000003-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Fernando Costa',  '111.222.333-44', 'fernando@privilege.com', '5521999990003', 'Av. Niemeyer, 121',          'c0000002-0000-0000-0000-000000000001', '64800812-d3bc-42eb-9849-c826cbda2b36'),
  ('d0000004-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Júlia Mendes',    '222.333.444-55', 'julia@ameclub.com',      '5531999990004', 'Rua Pernambuco, 1000',       'c0000003-0000-0000-0000-000000000001', '64800812-d3bc-42eb-9849-c826cbda2b36'),
  ('d0000006-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bruna Lopes',     '333.444.555-66', 'bruna@p12.com.br',       '5548999990006', 'Av. dos Búzios, 1750',       'c0000005-0000-0000-0000-000000000001', '64800812-d3bc-42eb-9849-c826cbda2b36')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 5. Confere
-- ------------------------------------------------------------
select 'cidades' as tipo, count(*) as total from cidades where workspace_id = '11111111-1111-1111-1111-111111111111'
union all
select 'casas',           count(*)         from casas    where workspace_id = '11111111-1111-1111-1111-111111111111'
union all
select 'contratantes',    count(*)         from contratantes where workspace_id = '11111111-1111-1111-1111-111111111111';
