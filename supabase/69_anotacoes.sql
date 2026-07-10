-- 69: Anotações — base de conhecimento colaborativa na Agenda.
--
-- PASTAS (tópicos compartilháveis) + NOTAS (thread tipo chat dentro da pasta).
-- Visibilidade por pasta: 'todos' (do workspace) | 'proprio' (só o criador) |
-- 'selecionados' (lista em anotacao_pasta_membros). A NOTA herda a visibilidade
-- da PASTA. Criar pasta = flag profiles.pode_criar_anotacoes (admin sempre pode).
-- Editar/excluir nota = só o autor (admin qualquer) — gate no servidor.
-- Tudo aditivo (tabelas novas + 1 coluna) — não toca dado existente.

-- ---------------- Tabelas ----------------
create table if not exists public.anotacao_pastas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nome text not null,
  cor text,
  icone text,
  visibilidade text not null default 'todos'
    check (visibilidade in ('todos', 'proprio', 'selecionados')),
  criado_por uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  deletado_em timestamptz
);

create table if not exists public.anotacao_pasta_membros (
  pasta_id uuid not null references public.anotacao_pastas(id) on delete cascade,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  primary key (pasta_id, usuario_id)
);

create table if not exists public.anotacoes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pasta_id uuid not null references public.anotacao_pastas(id) on delete cascade,
  titulo text,
  conteudo text not null default '',
  cor text,
  fixada boolean not null default false,
  criado_por uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.profiles(id) on delete set null,
  deletado_em timestamptz
);

create index if not exists idx_anotacao_pastas_ws
  on public.anotacao_pastas (workspace_id) where deletado_em is null;
create index if not exists idx_anotacoes_pasta
  on public.anotacoes (pasta_id, criado_em) where deletado_em is null;
create index if not exists idx_anotacao_membros_usuario
  on public.anotacao_pasta_membros (usuario_id);

-- Permissão dedicada de criar pasta (concedível por usuário; admin sempre pode).
alter table public.profiles
  add column if not exists pode_criar_anotacoes boolean not null default false;

-- ---------------- RLS ----------------
alter table public.anotacao_pastas enable row level security;
alter table public.anotacao_pasta_membros enable row level security;
alter table public.anotacoes enable row level security;

-- PASTAS: leitura respeita a visibilidade; escrita fica no tenant (gate fino no servidor).
drop policy if exists anotacao_pastas_leitura on public.anotacao_pastas;
create policy anotacao_pastas_leitura on public.anotacao_pastas for select using (
  workspace_id in (select workspace_id from public.profiles where id = auth.uid())
  and (
    visibilidade = 'todos'
    or criado_por = auth.uid()
    or exists (
      select 1 from public.anotacao_pasta_membros m
      where m.pasta_id = anotacao_pastas.id and m.usuario_id = auth.uid()
    )
  )
);
drop policy if exists anotacao_pastas_escrita on public.anotacao_pastas;
create policy anotacao_pastas_escrita on public.anotacao_pastas for all using (
  workspace_id in (select workspace_id from public.profiles where id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.profiles where id = auth.uid())
);

-- MEMBROS: só de pastas do próprio workspace.
drop policy if exists anotacao_membros_rw on public.anotacao_pasta_membros;
create policy anotacao_membros_rw on public.anotacao_pasta_membros for all using (
  exists (
    select 1 from public.anotacao_pastas p
    where p.id = anotacao_pasta_membros.pasta_id
      and p.workspace_id in (select workspace_id from public.profiles where id = auth.uid())
  )
) with check (
  exists (
    select 1 from public.anotacao_pastas p
    where p.id = anotacao_pasta_membros.pasta_id
      and p.workspace_id in (select workspace_id from public.profiles where id = auth.uid())
  )
);

-- NOTAS: leitura só se a PASTA é visível pro usuário; escrita no tenant (gate no servidor).
drop policy if exists anotacoes_leitura on public.anotacoes;
create policy anotacoes_leitura on public.anotacoes for select using (
  workspace_id in (select workspace_id from public.profiles where id = auth.uid())
  and exists (
    select 1 from public.anotacao_pastas p
    where p.id = anotacoes.pasta_id
      and (
        p.visibilidade = 'todos'
        or p.criado_por = auth.uid()
        or exists (
          select 1 from public.anotacao_pasta_membros m
          where m.pasta_id = p.id and m.usuario_id = auth.uid()
        )
      )
  )
);
drop policy if exists anotacoes_escrita on public.anotacoes;
create policy anotacoes_escrita on public.anotacoes for all using (
  workspace_id in (select workspace_id from public.profiles where id = auth.uid())
) with check (
  workspace_id in (select workspace_id from public.profiles where id = auth.uid())
);
