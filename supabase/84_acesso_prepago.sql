-- ============================================================
-- 84: MODELO PRÉ-PAGO POR VALIDADE (subscriptions.acesso_ate)
-- ============================================================
-- O ACESSO deixa de ser derivado de status recorrente e passa a ser
-- derivado de uma VALIDADE em dias: subscriptions.acesso_ate. DOIS gateways
-- (Stripe intl + Mercado Pago BR) só ESTENDEM a mesma validade via uma RPC
-- central idempotente. Um trial de cortesia também escreve acesso_ate.
--
-- Tudo aditivo. As colunas legado (trial_termina_em, proxima_cobranca,
-- downgrade_para, downgrade_efetivo_em) ficam READ-ONLY como legado — NÃO
-- são dropadas. O backfill garante que assinaturas/trials existentes já
-- nasçam com acesso_ate coerente (senão virariam bloqueadas).
--
-- Idempotência da extensão: UNIQUE(provider, provider_payment_id) na tabela
-- pagamentos + ON CONFLICT DO NOTHING na RPC. A validade sempre soma a partir
-- do MAIOR entre (acesso_ate atual, agora) — GREATEST — pra nunca encurtar
-- nem perder dias de quem paga adiantado.
-- ============================================================

-- ---- 1) Coluna de validade + backfill ----
alter table subscriptions
  add column if not exists acesso_ate timestamptz;

comment on column subscriptions.acesso_ate is
  'Validade do acesso (modelo pré-pago). Estendida em DIAS pela RPC registrar_pagamento_estender. Fonte única do gate (src/lib/acesso.ts).';

-- Backfill: quem já tinha trial/assinatura recebe a validade a partir do que
-- existia. Preferimos trial_termina_em (trials com data); senão a próxima
-- cobrança (assinatura recorrente). Só toca linhas ainda sem acesso_ate.
update subscriptions
   set acesso_ate = coalesce(
         trial_termina_em,
         proxima_cobranca::timestamptz,
         -- Assinatura 'ativa' SEM data (estado legado/inconsistente): 30 dias de
         -- graça pra NÃO bloquear quem tinha acesso ativo na virada do modelo.
         -- (trials sem data continuam null → 'bloqueado', que é o correto p/ stub.)
         case when status = 'ativa' then now() + interval '30 days' else null end
       )
 where acesso_ate is null
   and coalesce(
         trial_termina_em,
         proxima_cobranca::timestamptz,
         case when status = 'ativa' then now() + interval '30 days' else null end
       ) is not null;

-- ---- 1b) Invariante 1-subscription-por-workspace ----
-- A RPC faz "se existe subscription → UPDATE, senão INSERT". Sem esta UNIQUE,
-- dois pagamentos concorrentes de um workspace sem linha poderiam inserir 2
-- linhas. Hoje é 1:1 (sem duplicatas), então adicionar é seguro e fecha a corrida.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.subscriptions'::regclass
      and contype = 'u'
      and conname = 'subscriptions_workspace_id_key'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_workspace_id_key unique (workspace_id);
  end if;
end $$;

-- ---- 2) Tabela pagamentos (ledger de extensões de validade) ----
create table if not exists public.pagamentos (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  provider              text not null check (provider in ('stripe', 'mercadopago', 'cortesia')),
  provider_payment_id   text not null,
  plano                 text,
  ciclo                 text,
  valor                 integer,          -- em centavos
  moeda                 text,
  metodo                text,             -- 'pix' | 'credit_card' | ...
  dias_concedidos       integer not null,
  status                text not null default 'aprovado',
  acesso_ate_resultante timestamptz,
  criado_em             timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

comment on table public.pagamentos is
  'Ledger de pagamentos que ESTENDEM a validade (acesso_ate). Idempotente por UNIQUE(provider, provider_payment_id): o mesmo pagamento nunca concede dias 2x.';

create index if not exists idx_pagamentos_ws
  on public.pagamentos (workspace_id, criado_em desc);

-- ---- RLS ----
-- SELECT: só o admin do workspace enxerga o próprio histórico de pagamentos
-- (mesmo padrão de workspace_slug_history — migração 24/81). INSERT/UPDATE
-- ficam SÓ pro service_role (que bypassa RLS): habilitar RLS sem policy de
-- escrita = nenhum authenticated/anon insere ou altera (postura da mig 31).
alter table public.pagamentos enable row level security;

drop policy if exists pagamentos_select_admin on public.pagamentos;
create policy pagamentos_select_admin on public.pagamentos for select using (
  workspace_id in (
    select p.workspace_id from public.profiles p
    where p.id = (select auth.uid()) and p.papel = 'admin'
  )
);

-- ---- 3) RPC central: registra pagamento + estende validade (idempotente) ----
-- SECURITY DEFINER com search_path fixado (padrão de hardening da migração 78).
-- Chamada SÓ pelo service_role (admin client) — nunca pelo cliente.
create or replace function public.registrar_pagamento_estender(
  p_workspace_id      uuid,
  p_provider          text,
  p_provider_payment_id text,
  p_plano             text,
  p_ciclo             text,
  p_valor             integer,
  p_moeda             text,
  p_metodo            text,
  p_dias              integer
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

  -- Estende a validade: soma p_dias CORRIDOS a partir do MAIOR entre a
  -- validade atual e agora (nunca encurta; preserva dias pagos adiantado).
  select exists (
    select 1 from public.subscriptions where workspace_id = p_workspace_id
  ) into v_existe;

  -- CORTESIA só estende a validade: NÃO sobrescreve plano/ciclo/provider/metodo
  -- (o service manda p_plano=null e p_ciclo=motivo — copiar isso pra subscription
  -- apagaria o plano do assinante) e NÃO mexe no status (dar dias grátis não
  -- reativa um workspace suspenso por chargeback; pra isso existe o Reativar).
  if v_existe then
    update public.subscriptions
       set acesso_ate = greatest(coalesce(acesso_ate, now()), now())
                        + make_interval(days => p_dias),
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

  -- Grava a validade resultante no registro do pagamento (auditoria).
  update public.pagamentos
     set acesso_ate_resultante = v_nova_validade
   where id = v_pagamento_id;

  return jsonb_build_object('ja_processado', false, 'acesso_ate', v_nova_validade);
end;
$$;

-- A RPC é chamada só pelo service_role (bypassa checagem de grant), mas por
-- higiene do padrão de hardening (mig 78/79) tiramos o EXECUTE de quem não deve.
revoke execute on function public.registrar_pagamento_estender(
  uuid, text, text, text, text, integer, text, text, integer
) from public;
revoke execute on function public.registrar_pagamento_estender(
  uuid, text, text, text, text, integer, text, text, integer
) from anon;
revoke execute on function public.registrar_pagamento_estender(
  uuid, text, text, text, text, integer, text, text, integer
) from authenticated;

-- ---- Rollback (manual) ----
-- drop function if exists public.registrar_pagamento_estender(uuid, text, text, text, text, integer, text, text, integer);
-- drop policy if exists pagamentos_select_admin on public.pagamentos;
-- drop table if exists public.pagamentos;
-- alter table subscriptions drop column if exists acesso_ate;
