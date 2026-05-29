-- ============================================================
-- 27: PROFILES — flag "senha ainda é a padrão gerada pelo sistema"
-- ============================================================
-- Acrescenta `senha_padrao` em `profiles` pra que o admin do workspace
-- saiba, ao olhar um artista/membro da equipe, se o usuário já trocou
-- a senha aleatória que foi gerada na criação/reset.
--
-- Regra:
--   • true  → ainda está com a senha aleatória que o sistema gerou.
--             (acabou de ser criado ou de ter senha resetada e nunca
--              passou pelo /auth/update do AbaSeguranca)
--   • false → o próprio usuário já alterou a senha pelo painel.
--
-- Existentes ficam `false` por default — alarmar admin de workspace
-- antigo seria pior que omitir o aviso. Novos artistas/usuários e
-- resets vão setar `true` explicitamente no service.
-- ============================================================

alter table profiles
  add column if not exists senha_padrao boolean not null default false;

comment on column profiles.senha_padrao is
  'true = usuário ainda está com a senha aleatória gerada pelo sistema; false = já trocou pela própria via /auth/update.';
