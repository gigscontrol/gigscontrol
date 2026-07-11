-- Correção do mig 78: revogar de anon não bastava (grant default é pra PUBLIC).
-- Revoga de PUBLIC (bloqueia anon) e re-concede a authenticated + service_role
-- (o app usa esses papéis; authenticated JÁ tinha acesso via PUBLIC, então não
-- muda nada pra ele — só o anon perde). RLS segue OK (authenticated mantém).
revoke execute on function
  public.alcanca_operacional(uuid),
  public.proximo_numero(uuid, text, text),
  public.sync_profile_com_artista(),
  public.meu_artista_id(),
  public.meu_papel(),
  public.meu_workspace_id(),
  public.sou_membro_pasta(uuid),
  public.sou_super_admin(),
  public.trocas_slug_ultimos_30d(uuid),
  public.merge_show_meta(uuid, jsonb, jsonb),
  public.merge_parcela_meta(uuid, jsonb, text[], jsonb)
from public;

grant execute on function
  public.alcanca_operacional(uuid),
  public.proximo_numero(uuid, text, text),
  public.sync_profile_com_artista(),
  public.meu_artista_id(),
  public.meu_papel(),
  public.meu_workspace_id(),
  public.sou_membro_pasta(uuid),
  public.sou_super_admin(),
  public.trocas_slug_ultimos_30d(uuid),
  public.merge_show_meta(uuid, jsonb, jsonb),
  public.merge_parcela_meta(uuid, jsonb, text[], jsonb)
to authenticated, service_role;

-- Cleanup (purge por cron): só service_role.
revoke execute on function public.limpar_arquivo_expirado(), public.limpar_lixeira_expirada() from public;
grant execute on function public.limpar_arquivo_expirado(), public.limpar_lixeira_expirada() to service_role;
