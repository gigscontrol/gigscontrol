-- 62: FKs de integridade ausentes + sanear o login-fantasma. Aplicada via MCP.
--
-- Auditoria: profiles.artista_id / notificacoes.destinatario_id /
-- contadores_numero.workspace_id nao tinham FK (orfaos e ponteiros pendurados).
-- E ja havia 1 login-fantasma real no banco (profile papel=artista ativo
-- apontando pra artista hard-deletado; auth.user vivo).

-- 1) Sanear: profile papel=artista apontando pra artista inexistente →
--    soft-delete (bloqueia o login; o cron remove o auth.user em 30 dias).
update public.profiles p
set deletado_em = now()
where p.papel = 'artista' and p.deletado_em is null
  and p.artista_id is not null
  and not exists (select 1 from public.artists a where a.id = p.artista_id);

-- 2) Zera qualquer artista_id ainda pendurado (pre-requisito da FK).
update public.profiles p
set artista_id = null
where p.artista_id is not null
  and not exists (select 1 from public.artists a where a.id = p.artista_id);

-- 3) FKs.
alter table public.profiles
  add constraint profiles_artista_id_fkey
  foreign key (artista_id) references public.artists(id) on delete set null;

alter table public.notificacoes
  add constraint notificacoes_destinatario_id_fkey
  foreign key (destinatario_id) references public.profiles(id) on delete cascade;

alter table public.contadores_numero
  add constraint contadores_numero_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces(id) on delete cascade;

-- 4) Consistencia: meu_workspace_id() sem SET search_path (as outras SECURITY
--    DEFINER ja tem).
alter function public.meu_workspace_id() set search_path to 'public';
