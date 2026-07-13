-- Cidade GLOBAL no artista: normaliza pro mesmo padrao de profiles/casas/
-- orcamentos (FK cidades) em vez dos campos denormalizados so-BR
-- (cidade_ibge_id/nome/uf). Os denormalizados FICAM (exibicao + mapa por ora);
-- o cidade_id vira a referencia canonica e permite cidade de qualquer pais.
alter table artists
  add column if not exists cidade_id uuid references cidades(id) on delete set null;
create index if not exists idx_artists_cidade_id on artists(cidade_id);
