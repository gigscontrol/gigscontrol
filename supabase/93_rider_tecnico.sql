-- 93 — RIDER TÉCNICO no orçamento e na venda
--
-- O rider técnico já existia no CADASTRO DO ARTISTA (artists.rider_tecnico) e
-- no catálogo do produto (CATALOGO_TECNICO), mas morria ali: o Novo Orçamento
-- só lia riderCamarim e riderEfeitos, e não havia onde guardar o que foi
-- combinado. Sem coluna, o técnico não chega na venda nem na agenda.
--
-- Mesma forma dos irmãos (camarim/efeitos/hotel): jsonb com ItemQuantidade[],
-- default '[]' pra que toda linha existente já leia como "nada combinado" e
-- nenhum SELECT precise de coalesce.

alter table public.orcamentos
  add column if not exists tecnico jsonb not null default '[]'::jsonb;

alter table public.vendas
  add column if not exists tecnico jsonb not null default '[]'::jsonb;

comment on column public.orcamentos.tecnico is
  'Rider técnico combinado — ItemQuantidade[] (mesma forma de camarim/efeitos/hotel).';
comment on column public.vendas.tecnico is
  'Rider técnico combinado — ItemQuantidade[]. Herdado do orçamento na conversão.';
