-- 42_voucher_bucket.sql
-- Bucket PRIVADO 'vouchers' pros PDFs de voucher de voo. Acesso só via
-- service-role (rotas do servidor) + URLs assinadas — igual o bucket
-- 'assinaturas' (39_assinatura_fotos.sql). Sem policies em storage.objects.
-- Limite de 2MB por arquivo e só application/pdf, pra não pesar o storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vouchers', 'vouchers', false, 2097152, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
