-- ============================================================
-- GIGS CONTROL — 08_seed_demo_orcamentos.sql
-- Etapa 5: 2 orçamentos de demonstração.
--   1) Pendente — sem data definida ainda
--   2) Aceito — vinculado ao show de hoje (e0000001) gerado em 05_seed
--
-- Idempotente (on conflict do nothing).
-- ============================================================

-- IDs fixos:
--   workspace TWO DASH           = 11111111-1111-1111-1111-111111111111
--   bruno (admin TWO DASH)       = 64800812-d3bc-42eb-9849-c826cbda2b36
--   contratante Marcos Lima      = d0000001-0000-0000-0000-000000000001
--   contratante Fernando Costa   = d0000003-0000-0000-0000-000000000001
--   casa Club Laroc              = b0000001-0000-0000-0000-000000000001
--   casa Privilège               = b0000003-0000-0000-0000-000000000001
--   cidade São Paulo             = c0000001-0000-0000-0000-000000000001
--   cidade Rio de Janeiro        = c0000002-0000-0000-0000-000000000001
--   show de hoje                 = e0000001-0000-0000-0000-000000000001

-- ------------------------------------------------------------
-- 1. Orçamento pendente — sem data marcada
-- ------------------------------------------------------------
insert into orcamentos (
  id, workspace_id, numero, status, tipo_evento,
  contratante_id, casa_id, cidade_id, artist_id,
  valor_cache, duracao_horas, duracao_minutos,
  camarim, efeitos, hotel, logistica, observacoes,
  validade, criado_por
)
values (
  'f0000001-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'ORC-0001',
  'pendente',
  'casa-noturna',
  'd0000003-0000-0000-0000-000000000001',
  'b0000003-0000-0000-0000-000000000001',
  'c0000002-0000-0000-0000-000000000001',
  null,
  22000,
  2,
  0,
  '[{"nome":"Jack Daniels","qtd":2},{"nome":"Coca Cola Lata","qtd":12}]'::jsonb,
  '[{"nome":"Máquinas de CO²","qtd":2}]'::jsonb,
  '[{"nome":"Quarto Single","qtd":1}]'::jsonb,
  '{"aereaQtd":2,"transladoTerrestre":true}'::jsonb,
  'Aguardando definição de data pelo contratante.',
  (current_date + interval '14 days')::date,
  '64800812-d3bc-42eb-9849-c826cbda2b36'
)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2. Orçamento aceito — vinculado ao show de hoje
-- ------------------------------------------------------------
insert into orcamentos (
  id, workspace_id, numero, status, tipo_evento,
  contratante_id, casa_id, cidade_id, artist_id,
  valor_cache, duracao_horas, duracao_minutos,
  camarim, efeitos, hotel, logistica, observacoes,
  data_show, horario, show_id, criado_por
)
values (
  'f0000002-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'ORC-0002',
  'aceito',
  'casa-noturna',
  'd0000001-0000-0000-0000-000000000001',
  'b0000001-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000001',
  'a0000001-0000-0000-0000-000000000001',
  18000,
  2,
  0,
  '[{"nome":"Jack Daniels","qtd":2},{"nome":"Red Label","qtd":1},{"nome":"Coca Cola Lata","qtd":12}]'::jsonb,
  '[{"nome":"Máquinas de CO²","qtd":2},{"nome":"Cilindro(s) de 45KG de CO²","qtd":2}]'::jsonb,
  '[{"nome":"Quarto Single","qtd":1}]'::jsonb,
  '{"aereaQtd":2,"transladoTerrestre":true}'::jsonb,
  'Fechado via WhatsApp.',
  current_date,
  '23:30',
  'e0000001-0000-0000-0000-000000000001',
  '64800812-d3bc-42eb-9849-c826cbda2b36'
)
on conflict (id) do nothing;

-- Vincula o show existente ao orçamento aceito (caso 05_seed não tenha feito)
update shows
   set orcamento_id = 'f0000002-0000-0000-0000-000000000001'
 where id = 'e0000001-0000-0000-0000-000000000001'
   and orcamento_id is null;

-- ------------------------------------------------------------
-- Confere
-- ------------------------------------------------------------
select numero, status, tipo_evento, valor_cache, data_show
  from orcamentos
 where workspace_id = '11111111-1111-1111-1111-111111111111'
 order by numero;
