-- ============================================================
-- 26: WORKSPACES — identidade completa + trial controlado
-- ============================================================
-- Acrescenta campos da agência usados no onboarding:
--   • whatsapp           — telefone principal pra contato
--   • cor_acento         — cor de preferência da agência (hex)
--   • cidade_ibge_id     — município sede (catálogo IBGE)
--   • cidade_nome
--   • cidade_uf
--
-- E controla o fim do TRIAL grátis:
--   • subscriptions.trial_termina_em — quando o teste grátis acaba
--     (NULL = não está em trial; passou da data = trial expirado)
-- ============================================================

alter table workspaces add column if not exists whatsapp       text;
alter table workspaces add column if not exists cor_acento     text;
alter table workspaces add column if not exists cidade_ibge_id text;
alter table workspaces add column if not exists cidade_nome    text;
alter table workspaces add column if not exists cidade_uf      text;

alter table subscriptions
  add column if not exists trial_termina_em timestamptz;
