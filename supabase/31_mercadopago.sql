-- ============================================================
-- 31: SUBSCRIPTIONS — campos do Mercado Pago (Checkout Pro)
-- ============================================================
-- Suporte ao pagamento real via Mercado Pago Checkout Pro. Guarda a
-- referência da preference (ordem) e do pagamento aprovado, o método
-- usado e o provider. Mais uma tabela de log de eventos do webhook
-- pra idempotência (não processar o mesmo pagamento 2x) e auditoria.
--
-- Tudo aditivo/nullable — assinaturas e trials existentes não mudam.
-- ============================================================

-- ---- Colunas na subscriptions ----
alter table subscriptions
  add column if not exists provider text;            -- 'mercadopago' | 'stripe' | null
alter table subscriptions
  add column if not exists mp_preference_id text;    -- id da preference (Checkout Pro)
alter table subscriptions
  add column if not exists mp_payment_id text;       -- id do pagamento aprovado
alter table subscriptions
  add column if not exists metodo text;              -- 'pix' | 'boleto' | 'credit_card' | 'debit_card' | null

comment on column subscriptions.provider is
  'Gateway usado na última cobrança. mercadopago no MVP; stripe no futuro.';
comment on column subscriptions.mp_preference_id is
  'ID da preference do Checkout Pro (a "ordem" criada no Mercado Pago).';
comment on column subscriptions.mp_payment_id is
  'ID do pagamento aprovado no Mercado Pago (referência + dedupe).';
comment on column subscriptions.metodo is
  'Método do pagamento aprovado: pix, boleto, credit_card, debit_card.';

-- ---- Log de eventos do webhook (idempotência + auditoria) ----
create table if not exists pagamento_eventos (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  provider      text not null default 'mercadopago',
  tipo          text,            -- tipo do evento MP ('payment', etc)
  mp_payment_id text,            -- id do pagamento no MP
  status        text,            -- 'approved' | 'pending' | 'rejected' | 'in_process' | ...
  raw           jsonb,           -- payload bruto pra auditoria/debug
  criado_em     timestamptz not null default now()
);

comment on table pagamento_eventos is
  'Log de webhooks de pagamento recebidos. O índice único por mp_payment_id garante idempotência (não ativar a assinatura 2x pro mesmo pagamento).';

-- RLS: a tabela é tocada SÓ pelo webhook (service_role, que bypassa RLS).
-- Habilitar RLS sem policies de cliente = nenhum anon/authenticated lê ou
-- escreve. Mesma postura do `notificacoes` (escrita só por service_role).
-- (Um futuro painel admin lê via service_role, então também não precisa
-- de policy de cliente.)
alter table pagamento_eventos enable row level security;

-- Idempotência: o mesmo pagamento aprovado só é processado uma vez.
create unique index if not exists pagamento_eventos_mp_payment_uniq
  on pagamento_eventos (mp_payment_id)
  where mp_payment_id is not null;

-- Busca por workspace
create index if not exists pagamento_eventos_workspace_idx
  on pagamento_eventos (workspace_id);
