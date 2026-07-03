-- 53 — Dados pessoais do usuário da equipe (servem para contrato).
--
-- profiles não tinha documento/telefone/endereço/país. O "Criar usuário"
-- passa a coletar esses dados (opcionais), country-aware como na venda direta.
-- Tudo anulável (usuários antigos ficam sem). Idempotente.

alter table profiles
  add column if not exists pais text,
  add column if not exists documento_tipo text,
  add column if not exists documento text,
  add column if not exists endereco text,
  add column if not exists telefone text;
