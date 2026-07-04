-- 57: Trava a AUTO-ESCALAÇÃO de privilégio na RLS.
--
-- PROBLEMA: profiles (papel/is_super_admin) e membros_artista (perfis/permissoes)
-- eram graváveis por QUALQUER membro authenticated do workspace — as policies
-- `profiles_escrita` e `membros_artista_rw` eram FOR ALL escopadas só por
-- workspace_id. Como o bundle expõe o client anon+JWT, um operacional podia, do
-- console do browser, se auto-promover a admin/super ou dar a si mesmo todas as
-- permissões, contornando 100% do enforcement server-side (Fase 4).
--
-- CORREÇÃO: TODAS as escritas legítimas dessas 2 tabelas já passam pelo client
-- service_role (signup, senha-trocada, e as rotas admin de equipe/usuário —
-- criarClienteAdmin, que BYPASSA a RLS). Logo, restringir a escrita ao
-- service_role/super-admin fecha o vetor de auto-promoção SEM quebrar nenhum
-- fluxo. A LEITURA por tenant permanece aberta (a sessão e o auth-context
-- precisam ler os próprios vínculos/perfil).

-- ---------- profiles ----------
-- Escrita: só service_role (bypassa RLS) ou super-admin. A conta-mãe (papel
-- admin) gerencia a equipe pelas rotas /api/usuarios|artistas (service_role).
drop policy if exists profiles_escrita on public.profiles;
create policy profiles_escrita_super on public.profiles
  for all
  using (sou_super_admin())
  with check (sou_super_admin());
-- profiles_leitura permanece intacta (id = auth.uid() OR tenant OR super).

-- ---------- membros_artista ----------
-- Leitura: tenant (sessão/auth-context leem os vínculos). Escrita: só
-- service_role/super-admin (o editor de permissões usa service_role).
drop policy if exists membros_artista_rw on public.membros_artista;
create policy membros_artista_select on public.membros_artista
  for select
  using ((workspace_id = meu_workspace_id()) or sou_super_admin());
create policy membros_artista_super_write on public.membros_artista
  for all
  using (sou_super_admin())
  with check (sou_super_admin());
