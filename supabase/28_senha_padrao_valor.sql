-- ============================================================
-- 28: PROFILES — guarda em plaintext a senha aleatória enquanto
--                ela ainda for a padrão do sistema.
-- ============================================================
-- Complementa a flag `senha_padrao` (migration 27). Quando o sistema
-- gera/reset a senha, guarda também o valor aqui — assim o admin do
-- workspace pode reabrir o modal do artista e copiar de novo a senha
-- inicial (caso tenha fechado o modal de credenciais antes do artista
-- receber).
--
-- Regras:
--   • Populada apenas enquanto `senha_padrao = true`.
--   • É APAGADA (set null) no instante em que o próprio usuário troca
--     a senha pelo painel de Segurança (rota /api/auth/senha-trocada).
--   • Trade-off de segurança: senhas iniciais ficam acessíveis a quem
--     tiver service_role do banco. Aceitável porque (a) o admin do
--     workspace é o único leitor via API e (b) a janela de exposição é
--     curta — desaparece no primeiro update de senha do usuário.
-- ============================================================

alter table profiles
  add column if not exists senha_padrao_valor text;

comment on column profiles.senha_padrao_valor is
  'Senha aleatória gerada pelo sistema, em plaintext. Só é preenchida enquanto senha_padrao = true. Apagada quando o usuário troca via /auth/update.';
