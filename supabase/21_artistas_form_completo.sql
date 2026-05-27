-- ============================================================
-- 21: ARTISTAS — formulário completo
-- ============================================================
-- Adiciona ao cadastro de artista:
--   • Cidade onde reside (referência IBGE — id + nome + UF)
--   • Taxa de agência (5 modos: sem / % fixa / % variável / R$ fixo / R$ variável)
--   • Rider de camarim e rider de efeitos (jsonb por artista)
-- Adiciona ao orçamento:
--   • Valor calculado da taxa de agência + modo aplicado (histórico)
-- Adiciona à plataforma:
--   • workspaces.slug — usado pra compor username do artista
--     (ex: brunosocek-twobookings). Backfill automático pelos workspaces
--     já existentes.
--   • profiles.username — login único do artista (e opcionalmente do
--     admin futuramente).
-- ============================================================

create extension if not exists unaccent;

-- ------------------------------------------------------------
-- 1) workspaces.slug + backfill
-- ------------------------------------------------------------
alter table workspaces add column if not exists slug text;

do $$
declare
  ws record;
  candidate text;
  i int;
begin
  for ws in select id, nome from workspaces where slug is null order by criado_em loop
    -- normaliza: minúsculo, sem acento, só [a-z0-9]
    candidate := regexp_replace(lower(unaccent(coalesce(ws.nome, ''))), '[^a-z0-9]', '', 'g');
    if candidate = '' then candidate := 'agencia'; end if;
    -- evita colisão: appendar 2, 3, ... até achar livre
    i := 0;
    while exists (
      select 1 from workspaces
       where slug = candidate || (case when i = 0 then '' else i::text end)
         and id <> ws.id
    ) loop
      i := i + 1;
    end loop;
    update workspaces
       set slug = candidate || (case when i = 0 then '' else i::text end)
     where id = ws.id;
  end loop;
end$$;

alter table workspaces alter column slug set not null;
create unique index if not exists workspaces_slug_unique on workspaces(slug);

-- ------------------------------------------------------------
-- 2) artists: cidade + taxa + riders
-- ------------------------------------------------------------
alter table artists add column if not exists cidade_ibge_id text;
alter table artists add column if not exists cidade_nome    text;
alter table artists add column if not exists cidade_uf      text;

alter table artists add column if not exists taxa_modo  text default 'sem-taxa'
  check (taxa_modo in ('sem-taxa','perc-fixa','perc-variavel','valor-fixo','valor-variavel'));
-- Em modos perc-*: guarda o percentual (ex 15.00 = 15%).
-- Em modos valor-*: guarda o valor em R$ (ex 500.00).
-- Em 'sem-taxa' ou nos modos '-variavel': pode ficar null.
alter table artists add column if not exists taxa_valor numeric(10,2);

-- Rider salvo no artista (sugestões pro vendedor escolher por orçamento).
-- Shape: [{ "nome": "Jack Daniels", "qtdSugerida": 1 }, ...]
alter table artists add column if not exists rider_camarim jsonb default '[]'::jsonb;
alter table artists add column if not exists rider_efeitos jsonb default '[]'::jsonb;

-- ------------------------------------------------------------
-- 3) profiles.username — login único do artista
-- ------------------------------------------------------------
-- Pode ser null pra usuários admin/equipe que entram por email.
-- Pro artista é obrigatório (validado na aplicação).
alter table profiles add column if not exists username text;
-- UNIQUE só onde não é null (admin existente não precisa de username)
create unique index if not exists profiles_username_unique
  on profiles (username) where username is not null;

-- ------------------------------------------------------------
-- 4) orcamentos: taxa aplicada (histórico)
-- ------------------------------------------------------------
-- Valor calculado da taxa nesse orçamento específico. Salvamos pra
-- não recalcular toda vez (e pra que o histórico não mude se o
-- artista trocar de taxa depois).
alter table orcamentos add column if not exists taxa_agencia_valor numeric(10,2);
alter table orcamentos add column if not exists taxa_modo_aplicado text
  check (taxa_modo_aplicado is null or taxa_modo_aplicado in
         ('sem-taxa','perc-fixa','perc-variavel','valor-fixo','valor-variavel'));

-- ------------------------------------------------------------
-- 5) Vendas espelha o mesmo (porque ConcretizarVenda copia do orçamento)
-- ------------------------------------------------------------
alter table vendas add column if not exists taxa_agencia_valor numeric(10,2);
alter table vendas add column if not exists taxa_modo_aplicado text
  check (taxa_modo_aplicado is null or taxa_modo_aplicado in
         ('sem-taxa','perc-fixa','perc-variavel','valor-fixo','valor-variavel'));

-- ============================================================
-- Pronto. Sem mudança em policies — RLS já cobre pela workspace_id
-- nas tabelas alteradas.
-- ============================================================
