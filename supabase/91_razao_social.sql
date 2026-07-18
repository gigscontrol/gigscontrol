-- ============================================================
-- 91 — Razão social (quando CNPJ)
-- ============================================================
-- A razão social pertence ao DOCUMENTO, não à pessoa. Como o documento do
-- contratante ACUMULA (migração 90 — o mesmo contratante fecha um show com CPF
-- e outro com CNPJ), guardar UMA razão social solta repetiria o erro de tratar
-- como único algo que varia. Então:
--
--   • contratantes.documentos (jsonb, migração 90) — cada item ganha
--     `razao_social` (a do SEU documento). Enriquecer o jsonb não precisa de
--     DDL: o item passa a ser {documento, pais, razao_social?, primeiro_uso,
--     ultimo_uso}.
--   • contratantes.razao_social — a PRINCIPAL (= a do `documento` principal).
--     Espelha exatamente a relação documento (principal) × documentos
--     (histórico) que já existe.
--   • vendas.contratante_razao_social — SNAPSHOT no momento da venda,
--     espelhando o contratante_documento que já é snapshotado.
--
-- Só é preenchida quando o documento é CNPJ (BR, 14 dígitos) — pessoa física
-- não tem razão social. Ver `ehCnpj` em src/lib/data/documentos.ts.
--
-- Mesmo nome/tamanho/nulabilidade de artists.razao_social (migração 37).
--
-- Aditivas + nullable => zero rewrite de tabela e código antigo simplesmente
-- ignora as colunas. Sem RLS/grants novos: as policies `contratantes_tenant` e
-- `vendas_tenant` (02_policies.sql) são row-level por workspace_id, então as
-- colunas novas já nascem cobertas.

alter table contratantes
  add column if not exists razao_social text;

comment on column contratantes.razao_social is
  'Razão social do documento PRINCIPAL (só quando CNPJ). O histórico por documento vive em contratantes.documentos[].razao_social.';

alter table vendas
  add column if not exists contratante_razao_social text;

comment on column vendas.contratante_razao_social is
  'Snapshot da razão social do contratante no momento da venda (só quando o documento é CNPJ). Espelha contratante_documento.';

-- Rollback (manual):
-- alter table contratantes drop column if exists razao_social;
-- alter table vendas drop column if exists contratante_razao_social;
