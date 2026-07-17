-- ============================================================
-- 90 — Documentos acumulados do contratante
-- ============================================================
-- O documento (CPF/CNPJ) NÃO é chave de identidade do contratante — a chave é o
-- telefone (E.164). O mesmo contratante fecha um show com CPF e outro com CNPJ,
-- então o documento ACUMULA em vez de ser sobrescrito.
--
-- contratantes.documento continua sendo o PRINCIPAL (= o último usado); esta
-- coluna guarda o histórico completo.
--
-- Aditiva + default constante => zero rewrite de tabela (PG >= 11) e código
-- antigo simplesmente ignora a coluna. Sem RLS/grants novos: a policy
-- `contratantes_tenant` (02_policies.sql) é row-level por workspace_id, então a
-- coluna nova já nasce coberta.

alter table contratantes
  add column if not exists documentos jsonb not null default '[]'::jsonb;

comment on column contratantes.documentos is
  'Histórico de documentos usados em vendas/orçamentos. Item: {documento, pais, primeiro_uso, ultimo_uso}. contratantes.documento continua sendo o principal (= último usado).';

-- Rollback (manual):
-- alter table contratantes drop column if exists documentos;
