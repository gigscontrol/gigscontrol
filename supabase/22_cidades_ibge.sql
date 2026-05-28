-- ============================================================
-- 22: CIDADES — integração com o catálogo do IBGE
-- ============================================================
-- A partir daqui o app passa a usar o catálogo nacional do IBGE
-- (5.570 municípios) como fonte canônica de cidades. A tabela
-- `cidades` continua existindo (FK em orcamentos/vendas/shows/etc),
-- mas agora é alimentada automaticamente via lookup-or-create por
-- `ibge_id`.
--
-- O que muda:
--   - cidades.ibge_id (text): identificador do IBGE (ex: "3550308" =
--     São Paulo). UNIQUE por workspace — cada workspace tem sua
--     própria cópia da cidade (mantém isolamento multi-tenant).
--   - lat/lng já existem desde a migração 06.
--   - Nenhuma cidade existente é alterada — `ibge_id` fica NULL pra
--     cidades antigas. O app entende cidades com ibge_id NULL como
--     "legado/manual".
-- ============================================================

alter table cidades add column if not exists ibge_id text;

-- UNIQUE por workspace — duas cidades do mesmo workspace não podem
-- apontar pro mesmo município do IBGE. Workspaces diferentes podem ter
-- seu próprio registro local pra mesma cidade IBGE (multi-tenant).
create unique index if not exists cidades_workspace_ibge_unique
  on cidades(workspace_id, ibge_id) where ibge_id is not null;

-- Index pra acelerar a busca por ibge_id (lookup-or-create faz isso
-- toda hora)
create index if not exists cidades_ibge_idx on cidades(ibge_id) where ibge_id is not null;
