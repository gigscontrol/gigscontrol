-- ============================================================
-- GIGS CONTROL — 07_orcamentos_extras.sql
-- Etapa 5 (Orçamentos): colunas que o schema original não tinha mas
-- a UI usa.
--
-- Idempotente (add column if not exists).
-- ============================================================

alter table orcamentos add column if not exists data_show      date;
alter table orcamentos add column if not exists horario        text;
alter table orcamentos add column if not exists validade       date;
alter table orcamentos add column if not exists show_id        uuid references shows(id) on delete set null;
alter table orcamentos add column if not exists atualizado_em  timestamptz default now();

-- Confere
select column_name, data_type
  from information_schema.columns
 where table_name = 'orcamentos'
 order by ordinal_position;
