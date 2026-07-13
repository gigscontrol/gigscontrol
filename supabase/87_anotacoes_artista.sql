-- ============================================================
-- 87: ANOTAÇÕES vira BASE DE CONHECIMENTO — escopo por ARTISTA
-- ============================================================
-- Redesign do módulo Anotações. Três mudanças de schema, todas aditivas e
-- preservando os dados existentes:
--
--   (a) anotacao_pasta_membros passa a aceitar ARTISTAS (não só usuários).
--       Um membro é agora um USUÁRIO *ou* um ARTISTA (exatamente um). Membro
--       artista = ESCOPO: quem trabalha com o artista via membros_artista
--       enxerga a pasta (mesma semântica do gate da Agenda). A PK composta
--       (pasta_id, usuario_id) — que exigia usuario_id NOT NULL — dá lugar a
--       uma PK surrogate (id) + dois índices únicos parciais (um por tipo de
--       membro). As linhas atuais (todas com usuario_id) são preservadas.
--
--   (b) sou_membro_pasta (SECURITY DEFINER, mig 70) ganha um ramo: é membro
--       também quem está vinculado (membros_artista) a um artista que consta
--       como membro-artista da pasta. O sub-EXISTS em membros_artista fica
--       DENTRO da função definer — NUNCA como EXISTS direto numa policy —, se
--       não a recursão 42P17 que a mig 70 fechou volta.
--
--   (c) anotacoes ganha artist_id NULL: ETIQUETA de contexto (o artista a que
--       a nota se refere), NÃO dono. ON DELETE SET NULL — apagar um artista
--       não apaga conhecimento; só solta a etiqueta.
--
--   (d) anotacoes_dono_chk endurece de "pasta_id OU show_id" para XOR exato
--       (num_nonnulls(pasta_id, show_id) = 1): uma nota é de PASTA ou de SHOW,
--       nunca dos dois nem de nenhum.
--
-- Segue o padrão de RLS/hardening das migs 70/84/85 (função SECURITY DEFINER
-- com search_path fixo). Idempotente (if not exists / guards em pg_constraint).
-- ============================================================

-- ============================================================
-- (a) anotacao_pasta_membros: usuário OU artista
-- ============================================================

-- artista_id (escopo via membros_artista). CASCADE: se o artista some, o
-- vínculo de escopo com a pasta some junto.
alter table public.anotacao_pasta_membros
  add column if not exists artista_id uuid references public.artists(id) on delete cascade;

-- Surrogate id (a PK composta antiga não admite usuario_id NULL). Coluna NOT
-- NULL com default volátil → o Postgres gera um uuid distinto por linha
-- existente ao adicionar.
alter table public.anotacao_pasta_membros
  add column if not exists id uuid not null default gen_random_uuid();

-- Troca a PK composta (pasta_id, usuario_id) pela surrogate (id). A PK composta
-- tem que sair ANTES de afrouxar usuario_id (coluna de PK é implicitamente NOT
-- NULL — só depois de largar a PK dá pra torná-la nullable).
alter table public.anotacao_pasta_membros
  drop constraint if exists anotacao_pasta_membros_pkey;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.anotacao_pasta_membros'::regclass
      and contype = 'p'
  ) then
    alter table public.anotacao_pasta_membros
      add constraint anotacao_pasta_membros_pkey primary key (id);
  end if;
end $$;

-- Agora usuario_id pode ser NULL (linha de artista não tem usuario_id).
alter table public.anotacao_pasta_membros
  alter column usuario_id drop not null;

-- Exatamente um alvo por linha: usuário XOR artista.
do $$
begin
  alter table public.anotacao_pasta_membros
    add constraint anotacao_pasta_membros_alvo_chk
    check (num_nonnulls(usuario_id, artista_id) = 1);
exception when duplicate_object then null; end $$;

-- Unicidade por tipo (a PK composta antiga só cobria usuários): um usuário e
-- um artista aparecem no máximo uma vez por pasta.
create unique index if not exists anotacao_pasta_membros_usuario_uniq
  on public.anotacao_pasta_membros (pasta_id, usuario_id) where usuario_id is not null;
create unique index if not exists anotacao_pasta_membros_artista_uniq
  on public.anotacao_pasta_membros (pasta_id, artista_id) where artista_id is not null;

-- Índice pro ramo novo da função (lookup por artista_id).
create index if not exists idx_anotacao_membros_artista
  on public.anotacao_pasta_membros (artista_id) where artista_id is not null;

-- ============================================================
-- (b) sou_membro_pasta: + ramo do artista (DENTRO do SECURITY DEFINER)
-- ============================================================
-- É membro da pasta quem:
--   - consta como membro-USUÁRIO (usuario_id = auth.uid()), OU
--   - está vinculado (membros_artista, vínculo ativo) a algum artista que
--     consta como membro-ARTISTA da pasta.
-- Todo o EXISTS em membros_artista fica AQUI, dentro da função definer — não
-- na policy — pra não reintroduzir a recursão 42P17 fechada na mig 70.
create or replace function public.sou_membro_pasta(p_pasta uuid)
returns boolean
language sql
security definer
stable
set search_path to 'public'
as $$
  select exists (
    select 1 from public.anotacao_pasta_membros m
    where m.pasta_id = p_pasta
      and (
        m.usuario_id = auth.uid()
        or (
          m.artista_id is not null
          and exists (
            select 1 from public.membros_artista ma
            where ma.artist_id = m.artista_id
              and ma.user_id = auth.uid()
              and ma.deletado_em is null
          )
        )
      )
  );
$$;

grant execute on function public.sou_membro_pasta(uuid) to authenticated;

-- ============================================================
-- (c) anotacoes.artist_id — etiqueta de contexto (não dono)
-- ============================================================
alter table public.anotacoes
  add column if not exists artist_id uuid references public.artists(id) on delete set null;

comment on column public.anotacoes.artist_id is
  'Etiqueta de contexto: o artista a que a nota se refere. NÃO é dono (o dono é pasta_id/show_id). ON DELETE SET NULL.';

-- ============================================================
-- (d) anotacoes_dono_chk: pasta XOR show (exatamente um)
-- ============================================================
alter table public.anotacoes drop constraint if exists anotacoes_dono_chk;
alter table public.anotacoes
  add constraint anotacoes_dono_chk check (num_nonnulls(pasta_id, show_id) = 1);

-- ============================================================
-- Rollback (manual)
-- ============================================================
-- -- (d)
-- alter table public.anotacoes drop constraint if exists anotacoes_dono_chk;
-- alter table public.anotacoes
--   add constraint anotacoes_dono_chk check (pasta_id is not null or show_id is not null);
-- -- (c)
-- alter table public.anotacoes drop column if exists artist_id;
-- -- (b)
-- create or replace function public.sou_membro_pasta(p_pasta uuid)
-- returns boolean language sql security definer stable set search_path to 'public' as $$
--   select exists (
--     select 1 from public.anotacao_pasta_membros m
--     where m.pasta_id = p_pasta and m.usuario_id = auth.uid()
--   );
-- $$;
-- -- (a) — só reverter num banco onde nenhuma linha de artista foi criada:
-- drop index if exists public.anotacao_pasta_membros_artista_uniq;
-- drop index if exists public.anotacao_pasta_membros_usuario_uniq;
-- drop index if exists public.idx_anotacao_membros_artista;
-- alter table public.anotacao_pasta_membros drop constraint if exists anotacao_pasta_membros_alvo_chk;
-- alter table public.anotacao_pasta_membros drop constraint if exists anotacao_pasta_membros_pkey;
-- alter table public.anotacao_pasta_membros drop column if exists id;
-- alter table public.anotacao_pasta_membros drop column if exists artista_id;
-- alter table public.anotacao_pasta_membros alter column usuario_id set not null;
-- alter table public.anotacao_pasta_membros add primary key (pasta_id, usuario_id);
