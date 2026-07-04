-- 56_parcelas_meta_comprovantes.sql
-- Financeiro detalhado: metadados ricos por parcela + bucket de comprovantes.
-- (aplicada via Supabase MCP em 2026-07-03)

-- (1) Coluna meta (jsonb) na parcela. Guarda:
--   pagamento:     { pagoPor, pagoEm, nota, comprovantePath }
--   cancelamento:  { cancelado(bool), motivo, canceladoPor, canceladoEm }
--   cobrancas:     [{ em, por }]   -- log de cobranças enviadas (quantas vezes cobrou)
alter table parcelas add column if not exists meta jsonb not null default '{}'::jsonb;

-- (2) Bucket PRIVADO de comprovantes de pagamento (JPG/PNG/WEBP/PDF). Acesso só
-- via service-role (rotas do servidor) + URLs assinadas, igual 'vouchers'/'assinaturas'.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 5242880,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
