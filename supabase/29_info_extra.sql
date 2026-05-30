-- ============================================================
-- 29: ORÇAMENTOS + VENDAS — campo "info_extra"
-- ============================================================
-- Texto livre opcional que o admin pode anexar ao fim do orçamento.
-- Aparece no texto gerado pro WhatsApp, no detalhe do orçamento e
-- (quando o orçamento vira venda) é copiado pra venda também.
--
-- Nullable, default null — orçamentos/vendas existentes ficam sem
-- impacto.
-- ============================================================

alter table orcamentos add column if not exists info_extra text;
alter table vendas add column if not exists info_extra text;

comment on column orcamentos.info_extra is
  'Texto livre opcional adicionado ao fim do orçamento (ex: notas pra o contratante). Aparece no texto do WhatsApp e no detalhe.';
comment on column vendas.info_extra is
  'Copiado do orçamento original quando concretizada. Editável separadamente depois.';
