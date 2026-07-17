-- ============================================================
-- 92 — Moeda (BRL / USD / EUR) na agência, na venda e no orçamento
-- ============================================================
-- O app passa a operar em 3 moedas. A moeda é ESCOLHIDA por venda/orçamento
-- (com o padrão da agência pré-selecionado) e cada registro LEMBRA a sua — não
-- se converte nada por cotação (não há fonte de câmbio; converter seria mentira
-- guardada). Os dashboards somam POR moeda; nunca misturam num número só.
--
-- Aditiva + default 'BRL' => zero rewrite (PG >= 11) e todo o histórico
-- existente é BRL de verdade (o app nasceu BR-only). CHECK restringe ao enum.
-- workspaces.moeda espelha o padrão do fuso (workspaces.fuso_padrao), definido
-- no signup pela região do IP e editável em Preferências pelo admin.

alter table workspaces
  add column if not exists moeda text not null default 'BRL';
alter table workspaces drop constraint if exists workspaces_moeda_check;
alter table workspaces add constraint workspaces_moeda_check
  check (moeda = any (array['BRL'::text, 'USD'::text, 'EUR'::text]));

alter table vendas
  add column if not exists moeda text not null default 'BRL';
alter table vendas drop constraint if exists vendas_moeda_check;
alter table vendas add constraint vendas_moeda_check
  check (moeda = any (array['BRL'::text, 'USD'::text, 'EUR'::text]));

alter table orcamentos
  add column if not exists moeda text not null default 'BRL';
alter table orcamentos drop constraint if exists orcamentos_moeda_check;
alter table orcamentos add constraint orcamentos_moeda_check
  check (moeda = any (array['BRL'::text, 'USD'::text, 'EUR'::text]));

comment on column workspaces.moeda is
  'Moeda padrão da agência (BRL/USD/EUR). Default de vendas/orçamentos novos; definida no signup pela região do IP, editável em Preferências. NÃO reescreve registros antigos.';
comment on column vendas.moeda is
  'Moeda da venda (BRL/USD/EUR), escolhida no fechamento. As parcelas herdam. Snapshot: não muda se a agência trocar de moeda depois.';
comment on column orcamentos.moeda is
  'Moeda do orçamento (BRL/USD/EUR). Herdada pela venda na conversão.';
