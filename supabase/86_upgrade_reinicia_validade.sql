-- ============================================================
-- 86: UPGRADE JUSTO — reinicia a validade quando há crédito de upgrade
-- ============================================================
-- Problema (contagem dobrada): a RPC registrar_pagamento_estender (mig 84) soma
-- os dias a partir do MAIOR entre (acesso_ate, agora) — GREATEST. No UPGRADE, o
-- webhook concede diasDoCiclo + creditoDias, onde o creditoDias JÁ representa o
-- valor (convertido) dos dias restantes. Como o GREATEST também preserva esses
-- dias restantes, eles entram DUAS vezes (200 restantes -> 200 + 365 + 26).
--
-- Fix (modelo "justo"): a RPC ganha p_reiniciar_validade. Quando true, a base da
-- validade passa a ser AGORA (não o GREATEST) — os dias restantes são "trocados"
-- pelo creditoDias já embutido em p_dias, sem dobrar. O service liga isso
-- automaticamente sempre que há diasExtras (crédito de upgrade) > 0; nos demais
-- casos (renovação, onboarding, cortesia, cupom) o comportamento é IDÊNTICO ao
-- de antes (GREATEST — nunca encurta).
--
-- CREATE OR REPLACE não pode mudar a ASSINATURA (10 args != 9 args), então
-- dropamos a versão de 9 args e recriamos com o param novo (default false, então
-- chamadas antigas — ex: resgatar_cupom da mig 85, com 9 args posicionais —
-- continuam resolvendo pra esta função usando o default). Tudo o mais do corpo
-- (idempotência, ramo cortesia, INSERT) é preservado byte a byte.
-- ============================================================

-- Remove a assinatura antiga (9 args) da mig 84.
drop function if exists public.registrar_pagamento_estender(
  uuid, text, text, text, text, integer, text, text, integer
);

create or replace function public.registrar_pagamento_estender(
  p_workspace_id        uuid,
  p_provider            text,
  p_provider_payment_id text,
  p_plano               text,
  p_ciclo               text,
  p_valor               integer,
  p_moeda               text,
  p_metodo              text,
  p_dias                integer,
  p_reiniciar_validade  boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_pagamento_id uuid;
  v_nova_validade timestamptz;
  v_existe boolean;
begin
  -- Idempotência: o mesmo (provider, provider_payment_id) só entra uma vez.
  insert into public.pagamentos (
    workspace_id, provider, provider_payment_id, plano, ciclo,
    valor, moeda, metodo, dias_concedidos, status
  )
  values (
    p_workspace_id, p_provider, p_provider_payment_id, p_plano, p_ciclo,
    p_valor, p_moeda, p_metodo, p_dias, 'aprovado'
  )
  on conflict (provider, provider_payment_id) do nothing
  returning id into v_pagamento_id;

  -- Já processado antes → não estende de novo. Retorna cedo.
  if v_pagamento_id is null then
    return jsonb_build_object('ja_processado', true);
  end if;

  select exists (
    select 1 from public.subscriptions where workspace_id = p_workspace_id
  ) into v_existe;

  -- Base da validade: AGORA quando p_reiniciar_validade (upgrade — os dias
  -- restantes viram creditoDias em p_dias, sem dobrar), senão o MAIOR entre a
  -- validade atual e agora (renovação/onboarding/cortesia/cupom — nunca encurta).
  -- CORTESIA continua só estendendo (não sobrescreve plano/ciclo/provider/metodo/status).
  if v_existe then
    update public.subscriptions
       set acesso_ate = (case
                           when p_reiniciar_validade then now()
                           else greatest(coalesce(acesso_ate, now()), now())
                         end) + make_interval(days => p_dias),
           status   = case when p_provider = 'cortesia' then status else 'ativa' end,
           plano    = case when p_provider = 'cortesia' then plano else p_plano end,
           ciclo    = case when p_provider = 'cortesia' then ciclo else p_ciclo end,
           provider = case when p_provider = 'cortesia' then provider else p_provider end,
           metodo   = case when p_provider = 'cortesia' then metodo else p_metodo end
     where workspace_id = p_workspace_id
     returning acesso_ate into v_nova_validade;
  else
    insert into public.subscriptions (
      workspace_id, status, plano, ciclo, provider, metodo, acesso_ate
    )
    values (
      p_workspace_id, 'ativa', p_plano,
      case when p_provider = 'cortesia' then null else p_ciclo end,
      p_provider, p_metodo,
      now() + make_interval(days => p_dias)
    )
    returning acesso_ate into v_nova_validade;
  end if;

  update public.pagamentos
     set acesso_ate_resultante = v_nova_validade
   where id = v_pagamento_id;

  return jsonb_build_object('ja_processado', false, 'acesso_ate', v_nova_validade);
end;
$$;

-- Só o service_role chama (bypassa grant), mas mantém o hardening da mig 78/84.
revoke execute on function public.registrar_pagamento_estender(
  uuid, text, text, text, text, integer, text, text, integer, boolean
) from public;
revoke execute on function public.registrar_pagamento_estender(
  uuid, text, text, text, text, integer, text, text, integer, boolean
) from anon;
revoke execute on function public.registrar_pagamento_estender(
  uuid, text, text, text, text, integer, text, text, integer, boolean
) from authenticated;

-- ---- Rollback (manual) ----
-- drop function if exists public.registrar_pagamento_estender(uuid,text,text,text,text,integer,text,text,integer,boolean);
-- e reaplicar a versão de 9 args da migração 84.
