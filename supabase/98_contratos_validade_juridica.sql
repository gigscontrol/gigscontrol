-- 98 — VALIDADE JURÍDICA DOS CONTRATOS (feature 29/08/2026)
--
-- Pilares (spec do Bruno):
--  2. INTEGRIDADE   — hash SHA-256 do conteúdo, versionamento, PDF final
--                     imutável (hash + path content-addressed), lock pós-assinatura.
--  3. EVIDÊNCIAS    — fuso horário, telefone e método de autenticação do
--                     signatário (IP/dispositivo/geo/data já existiam).
--  1. AUTENTICAÇÃO  — OTP por e-mail (colunas de código/expiração/tentativas).
--  4. TRILHA        — contrato_eventos: APPEND-ONLY com CADEIA DE HASH
--                     (cada evento sela o anterior; adulterar quebra a cadeia),
--                     trigger que bloqueia UPDATE/DELETE até para service_role.
--  5. VERIFICAÇÃO   — verificacao_id público (página /verificar).
--
-- As RPCs computam e verificam a cadeia NO BANCO (pgcrypto), numa transação
-- com advisory lock por contrato — sem corrida e sem duas implementações
-- de hash pra divergirem.

-- ---------- Integridade / verificação no contrato ----------
alter table public.contratos
  add column if not exists conteudo_hash text,
  add column if not exists conteudo_versao integer not null default 1,
  add column if not exists finalizado_em timestamptz,
  add column if not exists verificacao_id text,
  add column if not exists pdf_final_hash text,
  add column if not exists pdf_final_path text;

create unique index if not exists contratos_verificacao_id_uidx
  on public.contratos (verificacao_id) where verificacao_id is not null;

comment on column public.contratos.conteudo_hash is
  'SHA-256 (hex) do conteúdo canônico no momento do envio p/ assinatura. Selado na trilha.';
comment on column public.contratos.conteudo_versao is
  'Versão do conteúdo — incrementa a cada alteração ANTES da 1ª assinatura (depois trava).';
comment on column public.contratos.finalizado_em is
  'Quando TODOS assinaram. A partir daqui o contrato é imutável.';
comment on column public.contratos.verificacao_id is
  'ID público de verificação (GC-XXXX-XXXX) — página /verificar/{id}, sem login.';
comment on column public.contratos.pdf_final_hash is
  'SHA-256 (hex) do PDF final carimbado — registrado 1x na finalização.';

-- ---------- Evidências + OTP no signatário ----------
alter table public.contrato_signatarios
  add column if not exists telefone text,
  add column if not exists fuso_horario text,
  add column if not exists metodo_autenticacao text,
  add column if not exists otp_hash text,
  add column if not exists otp_expira_em timestamptz,
  add column if not exists otp_tentativas integer not null default 0,
  add column if not exists otp_verificado_em timestamptz;

comment on column public.contrato_signatarios.metodo_autenticacao is
  'Como o signatário foi autenticado: email_otp | link (legado, só posse do token).';
comment on column public.contrato_signatarios.otp_hash is
  'SHA-256(token || codigo) do OTP vigente — o código em claro nunca é gravado.';

-- ---------- Trilha de auditoria APPEND-ONLY com cadeia de hash ----------
create table if not exists public.contrato_eventos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete restrict,
  workspace_id uuid not null,
  signatario_id uuid,
  -- criado|conteudo_alterado|enviado|aberto|otp_enviado|otp_verificado|
  -- assinado|finalizado|pdf_final_gerado|cancelado
  tipo text not null,
  detalhes jsonb not null default '{}'::jsonb,
  ip text,
  dispositivo text,
  fuso_horario text,
  criado_em timestamptz not null default now(),
  seq bigint not null,
  hash_anterior text,
  hash text not null
);

create index if not exists contrato_eventos_contrato_idx
  on public.contrato_eventos (contrato_id, seq);

-- RLS ligado SEM policies = negar tudo pra anon/authenticated; o acesso é
-- exclusivamente via service_role (rotas do servidor) e RPCs abaixo.
alter table public.contrato_eventos enable row level security;
revoke all on public.contrato_eventos from anon, authenticated;

-- IMUTABILIDADE DE VERDADE: nem o service_role edita/apaga a trilha.
-- (Só o owner do banco consegue, dropando o trigger — ação rastreável.)
create or replace function public.contrato_eventos_imutavel()
returns trigger language plpgsql as $$
begin
  raise exception 'contrato_eventos é append-only: % proibido', tg_op
    using errcode = 'P0001';
end;
$$;

drop trigger if exists contrato_eventos_bloqueia_mutacao on public.contrato_eventos;
create trigger contrato_eventos_bloqueia_mutacao
  before update or delete on public.contrato_eventos
  for each row execute function public.contrato_eventos_imutavel();

-- ---------- RPC: registrar evento (cadeia atômica) ----------
-- Advisory lock por contrato → sem corrida na cadeia. Fórmula do hash:
--   sha256( coalesce(hash_anterior,'genesis') || '|' || seq || '|' || tipo
--           || '|' || coalesce(signatario_id::text,'') || '|' || detalhes::text
--           || '|' || to_char(criado_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') )
-- detalhes::text de jsonb é canônico (chaves ordenadas/dedup pelo PG).
create or replace function public.registrar_contrato_evento(
  p_contrato_id   uuid,
  p_workspace_id  uuid,
  p_signatario_id uuid,
  p_tipo          text,
  p_detalhes      jsonb default '{}'::jsonb,
  p_ip            text default null,
  p_dispositivo   text default null,
  p_fuso          text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_prev_hash text;
  v_seq bigint;
  v_agora timestamptz := clock_timestamp();
  v_hash text;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('contrato_eventos:' || p_contrato_id::text));

  select hash, seq into v_prev_hash, v_seq
    from public.contrato_eventos
   where contrato_id = p_contrato_id
   order by seq desc
   limit 1;
  v_seq := coalesce(v_seq, 0) + 1;

  v_hash := encode(digest(
    coalesce(v_prev_hash, 'genesis') || '|' || v_seq::text || '|' || p_tipo || '|' ||
    coalesce(p_signatario_id::text, '') || '|' || coalesce(p_detalhes, '{}'::jsonb)::text || '|' ||
    to_char(v_agora at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'sha256'), 'hex');

  insert into public.contrato_eventos
    (contrato_id, workspace_id, signatario_id, tipo, detalhes, ip, dispositivo,
     fuso_horario, criado_em, seq, hash_anterior, hash)
  values
    (p_contrato_id, p_workspace_id, p_signatario_id, p_tipo,
     coalesce(p_detalhes, '{}'::jsonb), p_ip, p_dispositivo, p_fuso,
     v_agora, v_seq, v_prev_hash, v_hash)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'seq', v_seq, 'hash', v_hash);
end;
$$;

-- ---------- RPC: verificar a cadeia inteira de um contrato ----------
create or replace function public.verificar_cadeia_contrato(p_contrato_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  ev record;
  v_prev text := null;
  v_esperado text;
  v_total integer := 0;
begin
  for ev in
    select * from public.contrato_eventos
     where contrato_id = p_contrato_id
     order by seq asc
  loop
    v_total := v_total + 1;
    v_esperado := encode(digest(
      coalesce(v_prev, 'genesis') || '|' || ev.seq::text || '|' || ev.tipo || '|' ||
      coalesce(ev.signatario_id::text, '') || '|' || ev.detalhes::text || '|' ||
      to_char(ev.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'sha256'), 'hex');
    if ev.hash is distinct from v_esperado
       or ev.hash_anterior is distinct from v_prev then
      return jsonb_build_object(
        'integra', false, 'eventos', v_total, 'furo_seq', ev.seq);
    end if;
    v_prev := ev.hash;
  end loop;
  return jsonb_build_object('integra', true, 'eventos', v_total, 'furo_seq', null);
end;
$$;

-- Só o servidor (service_role, que bypassa grants) chama as RPCs.
revoke execute on function public.registrar_contrato_evento(uuid, uuid, uuid, text, jsonb, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.verificar_cadeia_contrato(uuid)
  from public, anon, authenticated;
revoke execute on function public.contrato_eventos_imutavel() from public, anon, authenticated;
