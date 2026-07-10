-- 72_pessoa_nascimento_email.sql
-- Campos de "pessoa" que ainda faltavam para unificar o cadastro de
-- admin (profile), DJ (artist) e equipe (profile):
--   - data de nascimento (nova em profiles e artists)
--   - e-mail de contato do DJ (artists ainda não tinha)
-- pais, documento_tipo, documento, telefone e cidade já existem
-- (migrations 21/37/52/53/54). Aditivo e idempotente — não destrói nada.

alter table profiles add column if not exists data_nascimento date;

alter table artists  add column if not exists data_nascimento date;
alter table artists  add column if not exists email text;
