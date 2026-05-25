-- =============================================================
-- 20_shows_soft_delete.sql
-- =============================================================
-- Adiciona soft delete (lixeira 30 dias + arquivo 180 dias) na
-- tabela shows. Mesmo padrão das demais entidades.
-- =============================================================

alter table shows add column if not exists deletado_em timestamptz;

create index if not exists idx_shows_deletado_em on shows (deletado_em);

-- Aceita 'show' como tipo no arquivo de longa duração
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'lixeira_arquivo_tipo_check') then
    alter table lixeira_arquivo drop constraint lixeira_arquivo_tipo_check;
  end if;
end $$;

alter table lixeira_arquivo
  add constraint lixeira_arquivo_tipo_check
  check (tipo in (
    'artista', 'usuario',
    'orcamento', 'venda',
    'contratante', 'casa', 'cidade',
    'show'
  ));

-- Atualiza limpar_lixeira_expirada() para incluir shows
create or replace function limpar_lixeira_expirada()
returns void
language plpgsql
security definer
as $$
declare
  limite timestamptz := now() - interval '30 days';
begin
  -- PROFILES
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'usuario', id, workspace_id, to_jsonb(profiles)
    from profiles where deletado_em is not null and deletado_em < limite;
  delete from auth.users where id in (
    select id from profiles where deletado_em is not null and deletado_em < limite);
  delete from profiles where deletado_em is not null and deletado_em < limite;

  -- ARTISTS
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'artista', id, workspace_id, to_jsonb(artists)
    from artists where deletado_em is not null and deletado_em < limite;
  delete from artists where deletado_em is not null and deletado_em < limite;

  -- ORÇAMENTOS
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'orcamento', id, workspace_id, to_jsonb(orcamentos)
    from orcamentos where deletado_em is not null and deletado_em < limite;
  delete from orcamentos where deletado_em is not null and deletado_em < limite;

  -- VENDAS
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'venda', id, workspace_id, to_jsonb(vendas)
    from vendas where deletado_em is not null and deletado_em < limite;
  delete from vendas where deletado_em is not null and deletado_em < limite;

  -- CONTRATANTES
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'contratante', id, workspace_id, to_jsonb(contratantes)
    from contratantes where deletado_em is not null and deletado_em < limite;
  delete from contratantes where deletado_em is not null and deletado_em < limite;

  -- CASAS
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'casa', id, workspace_id, to_jsonb(casas)
    from casas where deletado_em is not null and deletado_em < limite;
  delete from casas where deletado_em is not null and deletado_em < limite;

  -- CIDADES
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'cidade', id, workspace_id, to_jsonb(cidades)
    from cidades where deletado_em is not null and deletado_em < limite;
  delete from cidades where deletado_em is not null and deletado_em < limite;

  -- SHOWS (NOVO)
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'show', id, workspace_id, to_jsonb(shows)
    from shows where deletado_em is not null and deletado_em < limite;
  delete from shows where deletado_em is not null and deletado_em < limite;
end;
$$;
