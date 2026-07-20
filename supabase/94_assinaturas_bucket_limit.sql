-- 94 — trava tamanho e mime do bucket `assinaturas`
--
-- A rota PÚBLICA /api/assinar/[token] sobe a assinatura (PNG de traço) e as
-- fotos de documento pro bucket `assinaturas`, que estava com file_size_limit
-- NULL e allowed_mime_types NULL — sem teto de bytes no servidor. O schema zod
-- já ganhou .max() (defesa na aplicação); isto é a defesa em profundidade na
-- borda do Storage, alinhando com os outros buckets (comprovantes 5 MB,
-- vouchers 2 MB). 5 MB cobre com folga uma foto de documento reduzida.

update storage.buckets
set file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = array['image/png','image/jpeg','image/webp']
where id = 'assinaturas';
