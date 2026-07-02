-- 47_contrato_pastas.sql
-- "Meus contratos": pastas pra organizar os contratos (máx. 5 por workspace).
-- 2 colunas aditivas/seguras (nulláveis):
--   workspaces.contrato_pastas → lista de pastas [{id, nome, ordem}] (JSON, ≤5)
--   contratos.pasta_id         → id da pasta a que o contrato pertence (null = sem pasta)
-- Nada é destrutivo; contratos existentes ficam com pasta_id NULL (sem pasta).

alter table workspaces add column if not exists contrato_pastas jsonb;
alter table contratos  add column if not exists pasta_id text;
