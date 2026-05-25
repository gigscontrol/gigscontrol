-- =============================================================
-- 17_lixeira_completa.sql
-- =============================================================
-- Expande o sistema de lixeira (soft delete 30 dias + arquivo 180
-- dias) para cobrir também:
--   - orcamentos
--   - vendas
--   - contratantes
--   - casas
--   - cidades
--
-- Mesmo padrão que artists/profiles já usam.
-- =============================================================

-- ------------------------------------------------------------
-- 1. Colunas deletado_em
-- ------------------------------------------------------------
alter table orcamentos    add column if not exists deletado_em timestamptz;
alter table vendas        add column if not exists deletado_em timestamptz;
alter table contratantes  add column if not exists deletado_em timestamptz;
alter table casas         add column if not exists deletado_em timestamptz;
alter table cidades       add column if not exists deletado_em timestamptz;

create index if not exists idx_orcamentos_deletado_em
  on orcamentos (deletado_em);
create index if not exists idx_vendas_deletado_em
  on vendas (deletado_em);
create index if not exists idx_contratantes_deletado_em
  on contratantes (deletado_em);
create index if not exists idx_casas_deletado_em
  on casas (deletado_em);
create index if not exists idx_cidades_deletado_em
  on cidades (deletado_em);

-- ------------------------------------------------------------
-- 2. Atualiza lixeira_arquivo.tipo pra aceitar os novos tipos.
--    A coluna é text simples (sem CHECK constraint enum), então
--    só precisamos garantir que aceita os valores novos.
--    Se houver CHECK constraint antiga, removemos e recriamos.
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'lixeira_arquivo_tipo_check'
  ) then
    alter table lixeira_arquivo
      drop constraint lixeira_arquivo_tipo_check;
  end if;
end $$;

alter table lixeira_arquivo
  add constraint lixeira_arquivo_tipo_check
  check (tipo in (
    'artista', 'usuario',
    'orcamento', 'venda',
    'contratante', 'casa', 'cidade'
  ));

-- ------------------------------------------------------------
-- 3. Atualiza limpar_lixeira_expirada() para incluir os novos
-- ------------------------------------------------------------
create or replace function limpar_lixeira_expirada()
returns void
language plpgsql
security definer
as $$
declare
  limite timestamptz := now() - interval '30 days';
begin
  -- 3a) PROFILES
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'usuario', id, workspace_id, to_jsonb(profiles)
    from profiles
   where deletado_em is not null and deletado_em < limite;

  delete from auth.users
   where id in (
     select id from profiles
      where deletado_em is not null and deletado_em < limite
   );

  delete from profiles
   where deletado_em is not null and deletado_em < limite;

  -- 3b) ARTISTS
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'artista', id, workspace_id, to_jsonb(artists)
    from artists
   where deletado_em is not null and deletado_em < limite;

  delete from artists
   where deletado_em is not null and deletado_em < limite;

  -- 3c) ORÇAMENTOS (apaga antes de vendas, sem FK forte entre eles)
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'orcamento', id, workspace_id, to_jsonb(orcamentos)
    from orcamentos
   where deletado_em is not null and deletado_em < limite;

  delete from orcamentos
   where deletado_em is not null and deletado_em < limite;

  -- 3d) VENDAS (parcelas vão junto via FK ON DELETE CASCADE)
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'venda', id, workspace_id, to_jsonb(vendas)
    from vendas
   where deletado_em is not null and deletado_em < limite;

  delete from vendas
   where deletado_em is not null and deletado_em < limite;

  -- 3e) CONTRATANTES
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'contratante', id, workspace_id, to_jsonb(contratantes)
    from contratantes
   where deletado_em is not null and deletado_em < limite;

  delete from contratantes
   where deletado_em is not null and deletado_em < limite;

  -- 3f) CASAS
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'casa', id, workspace_id, to_jsonb(casas)
    from casas
   where deletado_em is not null and deletado_em < limite;

  delete from casas
   where deletado_em is not null and deletado_em < limite;

  -- 3g) CIDADES
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'cidade', id, workspace_id, to_jsonb(cidades)
    from cidades
   where deletado_em is not null and deletado_em < limite;

  delete from cidades
   where deletado_em is not null and deletado_em < limite;
end;
$$;
