-- ============================================================
-- 85: CUPONS ("1º mês grátis" = 30 dias fixos num plano-alvo)
-- ============================================================
-- Um cupom concede DIAS de acesso (por padrão 30) num PLANO ESPECÍFICO
-- escolhido pelo admin, válido nos 2 ciclos (mensal/anual). Com valor 0 ele
-- NUNCA passa por gateway (Stripe recusa PaymentIntent de amount 0): o resgate
-- estende a validade direto pela RPC central `registrar_pagamento_estender`
-- (mig 84), com um provider novo 'cupom' no ledger `pagamentos`.
--
-- O resgate é ATÔMICO (uma transação): valida + consome o cupom (usos_atuais)
-- + registra o uso (cupom_usos) + estende o acesso. Se qualquer passo falhar,
-- tudo faz ROLLBACK — nunca se consome um cupom sem conceder acesso, e nunca
-- se concede acesso sem consumir o cupom.
--
-- Reuso (D4): 1 cupom por WORKSPACE na vida — UNIQUE(workspace_id) em
-- cupom_usos. Isolado no SQL pra afrouxar fácil depois (ver comentário lá).
--
-- Tudo aditivo. Segue o padrão de RLS/hardening da mig 84: tabelas com RLS,
-- escrita só via service_role, RPC SECURITY DEFINER com search_path fixo e
-- EXECUTE revogado de public/anon/authenticated.
-- ============================================================

-- ---- 1) Tabela cupons (catálogo — escrito só pelo super-admin/service) ----
create table if not exists public.cupons (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique,               -- normalizado UPPER no resgate
  tipo            text not null default '1o_mes_gratis'
                    check (tipo in ('1o_mes_gratis')), -- extensível
  plano_alvo      text not null
                    check (plano_alvo in (
                      'individual','equipe','time',
                      'agencia','agencia-plus','agencia-max'
                    )),                                -- ids reais de src/lib/planos.ts
  dias_concedidos int not null default 30,
  limite_uso      int not null check (limite_uso > 0),
  usos_atuais     int not null default 0 check (usos_atuais <= limite_uso),
  ativo           boolean not null default true,
  validade        timestamptz null,                   -- null = sem expiração
  criado_por      uuid null,
  criado_em       timestamptz not null default now()
);

comment on table public.cupons is
  'Catálogo de cupons de dias grátis num plano-alvo. Consumido atomicamente pela RPC resgatar_cupom. Escrito só pelo super-admin (service_role).';

-- ---- 2) Tabela cupom_usos (ledger de resgates) ----
create table if not exists public.cupom_usos (
  id              uuid primary key default gen_random_uuid(),
  cupom_id        uuid not null references public.cupons(id) on delete cascade,
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  dias_concedidos int not null,
  usado_em        timestamptz not null default now(),
  -- D4: 1 cupom por WORKSPACE na vida. Pra afrouxar depois (permitir cupons
  -- DIFERENTES por workspace, 1x cada), troque esta UNIQUE por:
  --   unique (cupom_id, workspace_id)
  unique (workspace_id)
);

comment on table public.cupom_usos is
  'Ledger de resgates de cupom. UNIQUE(workspace_id) = 1 cupom por workspace na vida (D4). Inserido atomicamente por resgatar_cupom.';

create index if not exists idx_cupom_usos_cupom
  on public.cupom_usos (cupom_id);

-- ---- 3) RLS ----
-- cupons: RLS habilitado SEM policy pra authenticated/anon → nenhum cliente
-- lê nem escreve; só o service_role (que bypassa RLS) opera. (postura mig 84.)
alter table public.cupons enable row level security;

-- cupom_usos: SELECT só pro admin do próprio workspace (mesmo shape do
-- pagamentos_select_admin da mig 84). INSERT/UPDATE ficam só pro service_role
-- (sem policy de escrita = ninguém autenticado insere/altera).
alter table public.cupom_usos enable row level security;

drop policy if exists cupom_usos_select_admin on public.cupom_usos;
create policy cupom_usos_select_admin on public.cupom_usos for select using (
  workspace_id in (
    select p.workspace_id from public.profiles p
    where p.id = (select auth.uid()) and p.papel = 'admin'
  )
);

-- ---- 4) Provider 'cupom' no ledger de pagamentos ----
alter table public.pagamentos drop constraint if exists pagamentos_provider_check;
alter table public.pagamentos add constraint pagamentos_provider_check
  check (provider in ('stripe', 'mercadopago', 'cortesia', 'cupom'));

-- ---- 5) RPC atômica: resgatar_cupom ----
-- SECURITY DEFINER com search_path fixado (padrão de hardening mig 78/84).
-- Chamada SÓ pelo service_role (admin client) — nunca pelo cliente.
--
-- Faz TUDO numa transação:
--   a) consome o cupom (UPDATE ... usos_atuais+1) com todas as validações no
--      WHERE. Se NOT FOUND, diferencia o motivo com selects pós-falha.
--   b) registra o uso (INSERT cupom_usos).
--   c) estende o acesso via registrar_pagamento_estender (provider 'cupom',
--      cai no ramo NORMAL da RPC = ativa o plano + linha no ledger).
--
-- ATOMICIDADE do 'ja_usado': o unique_violation do INSERT em (b) é capturado
-- pelo EXCEPTION do PRÓPRIO bloco da função (não por um sub-bloco). Ao subir
-- pro handler do bloco onde o UPDATE de (a) rodou, o Postgres desfaz TUDO que
-- o bloco fez desde o início — inclusive o incremento de usos_atuais. Um
-- sub-bloco BEGIN...EXCEPTION interno só voltaria ao próprio savepoint e
-- DEIXARIA o incremento de (a) vazado (consumiria o cupom sem conceder acesso).
create or replace function public.resgatar_cupom(
  p_codigo       text,
  p_workspace_id uuid,
  p_plano        text,
  p_ciclo        text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cupom_id uuid;
  v_dias     int;
  v_uso_id   uuid;
  v_res      jsonb;
  v_existe   boolean;
begin
  -- (a) Consome atomicamente: só passa se ativo, plano bate, dentro do limite
  -- e não expirado. usos_atuais < limite_uso serializa contra corrida (o UPDATE
  -- trava a linha; um 2º resgate concorrente relê o valor já incrementado).
  update public.cupons
     set usos_atuais = usos_atuais + 1
   where upper(codigo) = upper(p_codigo)
     and ativo
     and plano_alvo = p_plano
     and usos_atuais < limite_uso
     and (validade is null or validade > now())
   returning id, dias_concedidos into v_cupom_id, v_dias;

  if not found then
    -- Diferencia o motivo pra UX (o cupom não foi consumido; nada a desfazer).
    select exists (
      select 1 from public.cupons where upper(codigo) = upper(p_codigo)
    ) into v_existe;
    if not v_existe then
      return jsonb_build_object('ok', false, 'erro', 'codigo_invalido');
    end if;

    -- Existe o código: descobre por que não passou (ordem = mais específico).
    if not exists (
      select 1 from public.cupons where upper(codigo) = upper(p_codigo) and ativo
    ) then
      return jsonb_build_object('ok', false, 'erro', 'inativo');
    end if;

    if not exists (
      select 1 from public.cupons
       where upper(codigo) = upper(p_codigo) and ativo
         and (validade is null or validade > now())
    ) then
      return jsonb_build_object('ok', false, 'erro', 'expirado');
    end if;

    if not exists (
      select 1 from public.cupons
       where upper(codigo) = upper(p_codigo) and ativo
         and plano_alvo = p_plano
    ) then
      return jsonb_build_object('ok', false, 'erro', 'plano_nao_bate');
    end if;

    -- Sobrou o limite: ativo, plano bate, na validade, mas esgotado.
    return jsonb_build_object('ok', false, 'erro', 'esgotado');
  end if;

  -- (b) Registra o uso. UNIQUE(workspace_id) ⇒ workspace já resgatou algum
  -- cupom: o unique_violation sobe pro EXCEPTION do bloco da função (abaixo),
  -- que desfaz TAMBÉM o incremento de (a) — nunca consome sem conceder acesso.
  insert into public.cupom_usos (cupom_id, workspace_id, dias_concedidos)
  values (v_cupom_id, p_workspace_id, v_dias)
  returning id into v_uso_id;

  -- (c) Estende o acesso: provider 'cupom' cai no ramo normal (ativa o plano
  -- por v_dias). Idempotente por (provider, provider_payment_id) único —
  -- 'cupom_<uso_id>' é único porque uso_id é PK recém-criada.
  select public.registrar_pagamento_estender(
    p_workspace_id,
    'cupom',
    'cupom_' || v_uso_id::text,
    p_plano,
    p_ciclo,
    0,
    'brl',
    'cupom',
    v_dias
  ) into v_res;

  return jsonb_build_object(
    'ok', true,
    'uso_id', v_uso_id,
    'dias', v_dias,
    'acesso_ate', v_res -> 'acesso_ate'
  );

exception
  -- Capturado no bloco da FUNÇÃO ⇒ ROLLBACK de todo o corpo (inclui o UPDATE
  -- de usos_atuais de (a)). Sem isto o cupom seria consumido sem conceder acesso.
  when unique_violation then
    return jsonb_build_object('ok', false, 'erro', 'ja_usado');
end;
$$;

-- EXECUTE só pro service_role (bypassa grant). Higiene do padrão de hardening
-- (mig 78/84): revoga de quem não deve — também evita o advisor
-- authenticated_security_definer_function_executable.
revoke execute on function public.resgatar_cupom(text, uuid, text, text) from public;
revoke execute on function public.resgatar_cupom(text, uuid, text, text) from anon;
revoke execute on function public.resgatar_cupom(text, uuid, text, text) from authenticated;

-- ---- Rollback (manual) ----
-- drop function if exists public.resgatar_cupom(text, uuid, text, text);
-- alter table public.pagamentos drop constraint if exists pagamentos_provider_check;
-- alter table public.pagamentos add constraint pagamentos_provider_check
--   check (provider in ('stripe', 'mercadopago', 'cortesia'));
-- drop policy if exists cupom_usos_select_admin on public.cupom_usos;
-- drop table if exists public.cupom_usos;
-- drop table if exists public.cupons;
