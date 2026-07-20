-- 96 — hardening de RLS (achados INFO da auditoria)
--
-- (a) alcanca_operacional FAIL-CLOSED
--     A função tinha um ramo fail-open: `or not exists (vínculo)` — um usuário
--     OPERACIONAL sem NENHUMA linha em membros_artista passava a policy pra
--     QUALQUER artista do próprio workspace (SELECT/UPDATE/DELETE), contradizendo
--     o invariante do app ("operacional sem vínculo é NEGADO", vinculos={}). Não
--     era vazamento cross-tenant (a policy PERMISSIVE de tenant confina ao
--     workspace) e o app já negava na prática — mas o backstop RLS deixava de
--     valer se alguma query rodasse na sessão do usuário sem o filtro de app.
--     Removido o ramo → o banco também nega. Conferido 2x antes de aplicar:
--     operacionais sem vínculo = 0 (de 1 operacional), então ninguém é trancado.
--     Reversível: readicionar o ramo `or not exists (...)`.

create or replace function public.alcanca_operacional(aid uuid)
  returns boolean
  language sql
  stable security definer
  set search_path to 'public'
as $function$
  select
    sou_super_admin()
    or public.meu_papel() in ('admin','artista')
    or aid in (select m.artist_id from public.membros_artista m
               where m.user_id = auth.uid() and m.deletado_em is null)
$function$;

-- (b) sync_profile_com_artista: revoga EXECUTE de authenticated
--     É função de TRIGGER (RETURNS trigger). O PostgREST não a expõe por RPC e
--     uma chamada direta falha ("trigger functions can only be called as
--     triggers"), então não é explorável — mas o grant é ruído desnecessário no
--     advisor. O trigger continua rodando (como owner, via SECURITY DEFINER),
--     independente deste grant.

revoke execute on function public.sync_profile_com_artista() from authenticated;
