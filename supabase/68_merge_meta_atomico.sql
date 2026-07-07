-- 68: merge ATÔMICO de meta (shows/parcelas) — fecha lost-update de PATCH
-- concorrentes (auditoria #4).
--
-- PROBLEMA: as rotas liam meta, mesclavam no Node e gravavam o blob inteiro
-- (.update({meta})). Dois PATCH simultâneos na mesma linha se sobrescreviam
-- (ex.: salvar booking + cancelar → um perde o do outro; dois appends em
-- cobrancas[] viram um "set"). Perda silenciosa.
--
-- SOLUÇÃO: mesclar só as chaves que mudaram, dentro de UM UPDATE (atômico sob o
-- row lock). SECURITY INVOKER (padrão) → a função roda com as permissões do
-- usuário e o RLS continua valendo (mesma proteção do .update() via cliente da
-- sessão). NÃO é security definer → sem risco de IDOR cross-tenant.

-- shows.meta: p_patch = chaves top-level a mesclar (cancelamento/histórico);
-- p_booking_patch = delta do sub-objeto booking (mesclado com || em jsonb_set).
create or replace function public.merge_show_meta(
  p_id uuid, p_patch jsonb, p_booking_patch jsonb
) returns void language sql as $$
  update shows set meta = case
    when p_booking_patch is null
      then coalesce(meta, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
    else jsonb_set(
           coalesce(meta, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb),
           '{booking}',
           coalesce(meta->'booking', '{}'::jsonb) || p_booking_patch
         )
  end
  where id = p_id;
$$;

-- parcelas.meta: p_patch = chaves top-level a mesclar (pagamento/cancelamento/
-- fixada); p_remove = chaves a apagar (ex.: 'pagamento' no desfazer); p_cobranca
-- = entrada única a appendar em cobrancas[] (ou null).
create or replace function public.merge_parcela_meta(
  p_id uuid, p_patch jsonb, p_remove text[], p_cobranca jsonb
) returns void language sql as $$
  update parcelas set meta = case
    when p_cobranca is null
      then (coalesce(meta, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)) - coalesce(p_remove, array[]::text[])
    else jsonb_set(
           (coalesce(meta, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)) - coalesce(p_remove, array[]::text[]),
           '{cobrancas}',
           coalesce(meta->'cobrancas', '[]'::jsonb) || p_cobranca
         )
  end
  where id = p_id;
$$;

grant execute on function public.merge_show_meta(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.merge_parcela_meta(uuid, jsonb, text[], jsonb) to authenticated;
