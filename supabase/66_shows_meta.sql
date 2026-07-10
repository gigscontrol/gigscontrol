-- 66_shows_meta.sql
-- Coluna `meta` (jsonb) na tabela shows — guarda dados estruturados que não
-- merecem coluna própria:
--   • meta.cancelamento          → { por, porNome, em, motivo } (auditoria)
--   • meta.cancelamentoHistorico → CancelamentoInfo[] (histórico ao reverter)
--   • meta.booking (futuro)      → dados de hospedagem/booking
-- Mesmo padrão de parcelas.meta (migração 56). Aditiva e segura: coluna nova
-- com default '{}', não altera nenhum registro existente.
alter table public.shows
  add column if not exists meta jsonb not null default '{}'::jsonb;

comment on column public.shows.meta is
  'Dados estruturados do show: cancelamento (quem/quando/motivo), histórico de cancelamentos e (futuro) booking/hospedagem.';
