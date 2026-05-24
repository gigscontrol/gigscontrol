-- ============================================================
-- flow.book — 99: RESET (apaga tudo)
-- ============================================================
-- ⚠️  CUIDADO: este script APAGA todas as tabelas do flow.book e
-- todos os dados. Use só se quiser recriar o banco do zero.
--
-- Depois de rodar este, rode de novo na ordem:
--   01_schema.sql → 02_policies.sql → 03_seed.sql
-- ============================================================

drop table if exists activity_logs  cascade;
drop table if exists subscriptions  cascade;
drop table if exists shows          cascade;
drop table if exists parcelas       cascade;
drop table if exists vendas         cascade;
drop table if exists orcamentos     cascade;
drop table if exists casas          cascade;
drop table if exists contratantes   cascade;
drop table if exists cidades        cascade;
drop table if exists artists        cascade;
drop table if exists profiles       cascade;
drop table if exists workspaces     cascade;
drop table if exists plans          cascade;

drop function if exists meu_workspace_id() cascade;
drop function if exists sou_super_admin()  cascade;
