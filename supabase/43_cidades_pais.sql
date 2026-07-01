-- 43_cidades_pais.sql
-- Cidades globais: adiciona país (ISO 3166-1 alpha-2) e geoname_id na
-- tabela `cidades`. Aditivo/seguro — cidades existentes viram BR.
--
-- - pais: 'BR' por padrão (todas as cidades atuais são do Brasil/IBGE).
-- - geoname_id: id do catálogo GeoNames (cidades de fora do Brasil).
--   Fica NULL nas cidades do IBGE (elas usam ibge_id).

alter table cidades add column if not exists pais text not null default 'BR';
alter table cidades add column if not exists geoname_id text;
