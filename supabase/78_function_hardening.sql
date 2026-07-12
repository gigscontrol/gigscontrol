-- Revoga EXECUTE do papel anon nas funções SECURITY DEFINER (o app é sempre
-- authenticated/service; anon não deve chamar nenhuma). NÃO quebra RLS: as
-- policies chamam essas funções internamente, independente de grant de RPC.
-- (NOTA: revogar de anon não bastou — o grant default é pra PUBLIC. A mig 79
--  corrige revogando de PUBLIC.)
revoke execute on function public.alcanca_operacional(uuid) from anon;
revoke execute on function public.limpar_arquivo_expirado() from anon;
revoke execute on function public.limpar_lixeira_expirada() from anon;
revoke execute on function public.proximo_numero(uuid, text, text) from anon;
revoke execute on function public.sync_profile_com_artista() from anon;
revoke execute on function public.meu_artista_id() from anon;
revoke execute on function public.meu_papel() from anon;
revoke execute on function public.meu_workspace_id() from anon;
revoke execute on function public.sou_membro_pasta(uuid) from anon;
revoke execute on function public.sou_super_admin() from anon;

-- Cleanup só por cron/service (Vercel Cron via service-role) — tira também
-- do authenticated (nenhum usuário logado dispara purge manualmente).
revoke execute on function public.limpar_arquivo_expirado() from authenticated;
revoke execute on function public.limpar_lixeira_expirada() from authenticated;

-- Fixa search_path nas 5 funções flagadas (operam em public; sem risco).
alter function public.sou_super_admin() set search_path = pg_catalog, public;
alter function public.limpar_arquivo_expirado() set search_path = pg_catalog, public;
alter function public.trocas_slug_ultimos_30d(uuid) set search_path = pg_catalog, public;
alter function public.merge_show_meta(uuid, jsonb, jsonb) set search_path = pg_catalog, public;
alter function public.merge_parcela_meta(uuid, jsonb, text[], jsonb) set search_path = pg_catalog, public;
