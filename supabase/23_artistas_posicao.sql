-- ============================================================
-- 23: ARTISTAS — coluna `posicao` pra reordenação manual
-- ============================================================
-- Permite que o admin arraste artistas em Configurações → Artistas
-- e essa ordem reflita na sidebar de DJs, agenda, filtros, etc.
--
-- Cada artista ganha uma `posicao` (integer). A query de listagem
-- ordena por `posicao ASC, nome ASC` (fallback alfabético se houver
-- empate por algum motivo).
--
-- O backfill usa ROW_NUMBER ordenado por NOME, que é exatamente como
-- a lista aparece HOJE — então a ordem inicial não muda visualmente.
-- A partir daí, o admin reordena por drag&drop e o app obedece.
-- ============================================================

alter table artists add column if not exists posicao integer;

-- Backfill: para cada workspace, sequencia 0, 10, 20, ... ordenando por
-- nome. Usar incrementos de 10 deixa espaço pra inserções intermediárias
-- futuras sem precisar renumerar tudo (gambi do PostgreSQL clássico).
with ordenados as (
  select id,
         (row_number() over (partition by workspace_id order by nome)) * 10 as nova_pos
    from artists
   where posicao is null
)
update artists set posicao = ordenados.nova_pos
  from ordenados
 where artists.id = ordenados.id;

-- Index pra acelerar a ordenação na listagem
create index if not exists artists_posicao_idx
  on artists(workspace_id, posicao) where deletado_em is null;
