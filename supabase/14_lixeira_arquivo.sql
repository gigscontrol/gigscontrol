-- ============================================================
-- GIGS CONTROL — 14_lixeira_arquivo.sql
-- Camada de arquivo (backup) de 180 dias.
--
-- Política completa de retenção:
--   0-30 dias  → Lixeira ativa (recuperável pela UI)
--   30 dias    → hard delete das tabelas ativas, snapshot vai pro arquivo
--   30-180 dias → existe em `lixeira_arquivo` (acesso só super-admin)
--   180 dias   → apagado de vez
--
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabela de arquivo
-- ------------------------------------------------------------
create table if not exists lixeira_arquivo (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('artista', 'usuario')),
  origem_id     uuid not null,
  workspace_id  uuid,
  dados         jsonb not null,
  arquivado_em  timestamptz not null default now()
);

create index if not exists idx_lixeira_arquivo_arquivado_em
  on lixeira_arquivo (arquivado_em);
create index if not exists idx_lixeira_arquivo_workspace
  on lixeira_arquivo (workspace_id);
create index if not exists idx_lixeira_arquivo_tipo_origem
  on lixeira_arquivo (tipo, origem_id);

-- ------------------------------------------------------------
-- 2. RLS — só super-admin acessa
-- ------------------------------------------------------------
alter table lixeira_arquivo enable row level security;

drop policy if exists "lixeira_arquivo_super_admin" on lixeira_arquivo;
create policy "lixeira_arquivo_super_admin" on lixeira_arquivo
  for all using (sou_super_admin()) with check (sou_super_admin());

-- ------------------------------------------------------------
-- 3. Substitui limpar_lixeira_expirada() — agora arquiva antes de apagar
-- ------------------------------------------------------------
create or replace function limpar_lixeira_expirada()
returns void
language plpgsql
security definer
as $$
declare
  limite timestamptz := now() - interval '30 days';
begin
  -- 3a) Arquiva profiles que vão ser apagados
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'usuario', id, workspace_id, to_jsonb(profiles)
    from profiles
   where deletado_em is not null
     and deletado_em < limite;

  -- 3b) Apaga auth users associados aos profiles expirados
  delete from auth.users
   where id in (
     select id from profiles
      where deletado_em is not null
        and deletado_em < limite
   );

  -- 3c) Apaga os profiles expirados
  delete from profiles
   where deletado_em is not null
     and deletado_em < limite;

  -- 3d) Arquiva artistas que vão ser apagados
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'artista', id, workspace_id, to_jsonb(artists)
    from artists
   where deletado_em is not null
     and deletado_em < limite;

  -- 3e) Apaga os artistas expirados
  delete from artists
   where deletado_em is not null
     and deletado_em < limite;
end;
$$;

-- ------------------------------------------------------------
-- 4. Nova função: limpa o arquivo após 180 dias
-- ------------------------------------------------------------
create or replace function limpar_arquivo_expirado()
returns void
language plpgsql
security definer
as $$
begin
  delete from lixeira_arquivo
   where arquivado_em < now() - interval '180 days';
end;
$$;

-- ------------------------------------------------------------
-- 5. Cron — limpa o arquivo 1x/dia às 03:30 UTC (30 min depois da lixeira)
-- ------------------------------------------------------------
select cron.unschedule('gigscontrol-limpar-arquivo')
 where exists (
   select 1 from cron.job where jobname = 'gigscontrol-limpar-arquivo'
 );

select cron.schedule(
  'gigscontrol-limpar-arquivo',
  '30 3 * * *',
  $$ select limpar_arquivo_expirado(); $$
);

-- ------------------------------------------------------------
-- 6. Confere — lista os 2 jobs de limpeza
-- ------------------------------------------------------------
select jobname, schedule, command, active
  from cron.job
 where jobname like 'gigscontrol-%'
 order by jobname;
