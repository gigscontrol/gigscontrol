-- ============================================================
-- GIGS CONTROL — 09_seed_demo_venda.sql
-- Etapa 6 (Vendas + Parcelas): 1 venda VND-0001 vinculada ao show
-- de hoje + 3 parcelas (1 paga, 1 pendente, 1 vencida).
--
-- Pré-requisitos: 05_seed_demo_shows.sql, 06_contatos_lat_lng.sql,
-- 08_seed_demo_orcamentos.sql já executados.
--
-- Idempotente (on conflict do nothing).
-- ============================================================

-- IDs fixos (vinculam ao seed das fatias anteriores):
--   workspace TWO DASH     = 11111111-1111-1111-1111-111111111111
--   bruno (criado_por)     = 64800812-d3bc-42eb-9849-c826cbda2b36
--   show de hoje           = e0000001-0000-0000-0000-000000000001
--   artista CZ             = a0000001-0000-0000-0000-000000000001
--   contratante Marcos     = d0000001-0000-0000-0000-000000000001
--   casa Club Laroc        = b0000001-0000-0000-0000-000000000001
--   cidade São Paulo       = c0000001-0000-0000-0000-000000000001

-- ------------------------------------------------------------
-- 1. Venda VND-0001 — vinculada ao show de hoje
-- ------------------------------------------------------------
insert into vendas (
  id, workspace_id, numero, show_id,
  contratante_id, contratante_nome, contratante_email, contratante_telefone,
  contratante_documento, contratante_endereco,
  nome_evento, evento_instagram, nome_local, capacidade_publico, endereco_local,
  data_show, horario, horario_fim,
  cidade_id, casa_id, artist_id,
  line_up, cache, duracao_horas, duracao_minutos,
  camarim, efeitos, hotel, logistica, observacoes,
  criado_por
)
values (
  'f0000001-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'VND-0001',
  'e0000001-0000-0000-0000-000000000001',
  'd0000001-0000-0000-0000-000000000001',
  'Marcos Lima',
  'marcos@laroc.com.br',
  '5511999990001',
  '123.456.789-00',
  'Rua Augusta, 1500 — Consolação, São Paulo/SP — CEP 01304-001',
  'Laroc Sunset — Edição Aniversário',
  '@larocclub',
  'Club Laroc',
  1200,
  'Rua Augusta, 1500 — Consolação, São Paulo/SP',
  current_date,
  '23:30',
  '01:30',
  'c0000001-0000-0000-0000-000000000001',
  'b0000001-0000-0000-0000-000000000001',
  'a0000001-0000-0000-0000-000000000001',
  '["Vintage Culture", "Cat Dealers"]'::jsonb,
  18000,
  2,
  0,
  '[{"nome":"Jack Daniels","qtd":2},{"nome":"Coca Cola Lata","qtd":12},{"nome":"Garrafa de Água","qtd":12}]'::jsonb,
  '[{"nome":"Máquinas de CO²","qtd":2},{"nome":"Cilindro(s) de 45KG de CO²","qtd":2}]'::jsonb,
  '[{"nome":"Quarto Single","qtd":1}]'::jsonb,
  '{"aereaQtd":2,"transladoTerrestre":true}'::jsonb,
  'Cliente quer fechamento por WhatsApp.',
  '64800812-d3bc-42eb-9849-c826cbda2b36'
)
on conflict (id) do nothing;

-- Vincula o show ao venda (sincronia bidirecional)
update shows
   set venda_id = 'f0000001-0000-0000-0000-000000000001'
 where id = 'e0000001-0000-0000-0000-000000000001'
   and venda_id is null;

-- ------------------------------------------------------------
-- 2. Parcelas — sinal pago / metade pendente / cauda vencida
-- ------------------------------------------------------------
insert into parcelas (
  id, workspace_id, venda_id,
  percentual, valor, data_vencimento, status_base, data_pagamento, observacao
) values
  -- 1ª parcela: 30% pago no fechamento
  (
    'f1000001-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'f0000001-0000-0000-0000-000000000001',
    30, 5400,
    (current_date - interval '30 days')::date,
    'pago',
    (current_date - interval '28 days')::date,
    'Sinal recebido via PIX.'
  ),
  -- 2ª parcela: 50% pendente, vence em 7 dias
  (
    'f1000002-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'f0000001-0000-0000-0000-000000000001',
    50, 9000,
    (current_date + interval '7 days')::date,
    'pendente',
    null,
    null
  ),
  -- 3ª parcela: 20% — venceu ontem (vai aparecer como "atrasado" no UI)
  (
    'f1000003-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'f0000001-0000-0000-0000-000000000001',
    20, 3600,
    (current_date - interval '1 day')::date,
    'pendente',
    null,
    'Combinado para o dia anterior ao show.'
  )
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 3. Confere
-- ------------------------------------------------------------
select v.numero, v.contratante_nome, v.data_show, v.cache,
       count(p.id) as parcelas,
       sum(case when p.status_base = 'pago' then p.valor else 0 end) as recebido,
       sum(case when p.status_base = 'pendente' then p.valor else 0 end) as a_receber
  from vendas v
  left join parcelas p on p.venda_id = v.id
 where v.id = 'f0000001-0000-0000-0000-000000000001'
 group by v.id, v.numero, v.contratante_nome, v.data_show, v.cache;
