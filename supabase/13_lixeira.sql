-- ============================================================
-- GIGS CONTROL — 13_lixeira.sql
-- Etapa 8: soft delete de 30 dias para artistas e usuários (profiles).
--
-- O que faz:
--   1. Adiciona coluna `deletado_em timestamptz` em artists e profiles.
--   2. Cria função `limpar_lixeira_expirada()` que apaga definitivamente
--      registros com mais de 30 dias na lixeira (e os auth users dos
--      profiles correspondentes).
--   3. Habilita pg_cron e agenda a função 1x/dia às 03:00 UTC.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colunas deletado_em
-- ------------------------------------------------------------
alter table artists  add column if not exists deletado_em timestamptz;
alter table profiles add column if not exists deletado_em timestamptz;

create index if not exists idx_artists_deletado_em  on artists (deletado_em);
create index if not exists idx_profiles_deletado_em on profiles (deletado_em);

-- ------------------------------------------------------------
-- 2. Função de limpeza
-- ------------------------------------------------------------
create or replace function limpar_lixeira_expirada()
returns void
language plpgsql
security definer
as $$
declare
  limite timestamptz := now() - interval '30 days';
  profile_record record;
begin
  -- 2a) Apaga auth users dos profiles expirados (precisa antes de apagar o profile
  --     porque profiles.id é FK para auth.users.id em alguns deploys; mas mesmo
  --     que não seja, queremos remover o login junto).
  for profile_record in
    select id from profiles
     where deletado_em is not null
       and deletado_em < limite
  loop
    begin
      perform auth.uid(); -- noop, só garante acesso ao schema auth
      delete from auth.users where id = profile_record.id;
    exception when others then
      -- Ignora falhas (pode acontecer se o user já foi removido manualmente)
      null;
    end;
  end loop;

  -- 2b) Apaga os profiles expirados
  delete from profiles
   where deletado_em is not null
     and deletado_em < limite;

  -- 2c) Apaga os artistas expirados
  delete from artists
   where deletado_em is not null
     and deletado_em < limite;
end;
$$;

-- ------------------------------------------------------------
-- 3. pg_cron — job 1x/dia
-- ------------------------------------------------------------
create extension if not exists pg_cron;

-- Remove qualquer job anterior com o mesmo nome
select cron.unschedule('gigscontrol-limpar-lixeira')
 where exists (
   select 1 from cron.job where jobname = 'gigscontrol-limpar-lixeira'
 );

-- Agenda nova execução 1x/dia às 03:00 UTC (00:00 BRT)
select cron.schedule(
  'gigscontrol-limpar-lixeira',
  '0 3 * * *',
  $$ select limpar_lixeira_expirada(); $$
);

-- ------------------------------------------------------------
-- 4. Confere
-- ------------------------------------------------------------
select jobname, schedule, command, active
  from cron.job
 where jobname = 'gigscontrol-limpar-lixeira';
