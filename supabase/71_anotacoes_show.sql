-- 71: Anotações em SHOWS.
--
-- Uma nota agora pertence a uma PASTA *ou* a um SHOW (máx 4 por show — limite
-- enforçado no servidor). Reusa a tabela `anotacoes`: pasta_id vira nullable e
-- entra show_id (FK). A leitura de nota de show segue o RLS de shows (tenant);
-- o gate fino por-artista (podeVerAgenda) fica no servidor, como no resto da
-- agenda. Aditivo — não toca dado existente.

alter table public.anotacoes alter column pasta_id drop not null;

alter table public.anotacoes
  add column if not exists show_id uuid references public.shows(id) on delete cascade;

-- Toda nota tem um dono: pasta OU show.
do $$ begin
  alter table public.anotacoes
    add constraint anotacoes_dono_chk check (pasta_id is not null or show_id is not null);
exception when duplicate_object then null; end $$;

create index if not exists idx_anotacoes_show
  on public.anotacoes (show_id, criado_em) where deletado_em is null;

-- Leitura: nota de pasta segue o RLS da pasta (subselect já filtra visibilidade,
-- migration 70); nota de show segue o RLS de shows (tenant).
drop policy if exists anotacoes_leitura on public.anotacoes;
create policy anotacoes_leitura on public.anotacoes for select using (
  workspace_id in (select workspace_id from public.profiles where id = auth.uid())
  and (
    (pasta_id is not null and exists (select 1 from public.anotacao_pastas p where p.id = anotacoes.pasta_id))
    or
    (show_id is not null and exists (select 1 from public.shows s where s.id = anotacoes.show_id))
  )
);
