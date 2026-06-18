-- ============================================================
-- 39: ASSINATURA (Fase 2) — fotos (CPF / documento / selfie) no Storage
-- ============================================================
-- Bucket PRIVADO pras fotos enviadas pelo signatário. Só o service-role
-- escreve (upload na rota pública /api/assinar) e lê (URLs assinadas pro
-- relatório). Sem políticas pra anon — o bucket privado + service-role já
-- garantem que as fotos (dado sensível, LGPD) não ficam públicas.
--
-- Os caminhos das fotos ficam em contrato_signatarios.arquivos (jsonb):
--   { "fotoCpf": "<path>", "fotoDocumento": "<path>", "selfie": "<path>" }
-- ============================================================

insert into storage.buckets (id, name, public)
values ('assinaturas', 'assinaturas', false)
on conflict (id) do nothing;

alter table contrato_signatarios
  add column if not exists arquivos jsonb not null default '{}'::jsonb;
