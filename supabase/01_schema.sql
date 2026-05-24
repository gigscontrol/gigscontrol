-- ============================================================
-- flow.book — 01: SCHEMA (tabelas)
-- ============================================================
-- Como usar:
--   Supabase → seu projeto → SQL Editor → New query
--   Cole este arquivo inteiro → Run.
--   Depois rode o 02_policies.sql e o 03_seed.sql, nessa ordem.
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- TABELAS GLOBAIS (sem workspace — compartilhadas pela plataforma)
-- ============================================================

-- Catálogo de planos
create table if not exists plans (
  id                   text primary key,
  nome                 text not null,
  tagline              text,
  preco_mensal         numeric(10,2) not null,
  preco_anual_por_mes  numeric(10,2) not null,
  max_artistas         int not null,
  max_usuarios_equipe  int not null,
  destaque             boolean default false,
  recursos             jsonb default '[]'::jsonb,
  criado_em            timestamptz default now()
);

-- Workspaces (as agências / contas-cliente)
create table if not exists workspaces (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  plano      text references plans(id),
  ciclo      text not null default 'mensal' check (ciclo in ('mensal','anual')),
  status     text not null default 'trial'
               check (status in ('ativa','trial','suspensa','cancelada')),
  criado_em  timestamptz default now()
);

-- Perfis de usuário (estende auth.users do Supabase)
create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  workspace_id    uuid references workspaces(id) on delete cascade,
  nome            text not null,
  email           text not null,
  papel           text not null default 'admin'
                    check (papel in ('admin','artista','vendedor','produtor','financeiro')),
  is_super_admin  boolean not null default false,
  artista_id      uuid,
  escopo_vendedor jsonb,
  status          text not null default 'ativo'
                    check (status in ('ativo','bloqueado','desativado')),
  criado_em       timestamptz default now()
);

-- ============================================================
-- TABELAS POR WORKSPACE (multi-tenant)
-- ============================================================

create table if not exists artists (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  nome          text not null,
  cor           text default '#3b82f6',
  criado_em     timestamptz default now()
);

create table if not exists cidades (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  nome          text not null,
  estado        text
);

create table if not exists contratantes (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  nome          text not null,
  documento     text,
  email         text,
  telefone      text,
  endereco      text,
  cidade_id     uuid references cidades(id) on delete set null,
  observacoes   text,
  criado_por    uuid references profiles(id) on delete set null,
  criado_em     timestamptz default now()
);

create table if not exists casas (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  nome                text not null,
  tipo                text,
  cidade_id           uuid references cidades(id) on delete set null,
  capacidade          int,
  endereco            text,
  contato_responsavel text,
  telefone            text,
  criado_em           timestamptz default now()
);

create table if not exists orcamentos (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  numero          text not null,
  status          text not null default 'pendente',
  tipo_evento     text,
  contratante_id  uuid references contratantes(id) on delete set null,
  casa_id         uuid references casas(id) on delete set null,
  cidade_id       uuid references cidades(id) on delete set null,
  artist_id       uuid references artists(id) on delete set null,
  valor_cache     numeric(10,2) default 0,
  duracao_horas   int default 0,
  duracao_minutos int default 0,
  camarim         jsonb default '[]'::jsonb,
  efeitos         jsonb default '[]'::jsonb,
  hotel           jsonb default '[]'::jsonb,
  logistica       jsonb default '{}'::jsonb,
  observacoes     text,
  criado_por      uuid references profiles(id) on delete set null,
  criado_em       timestamptz default now()
);

create table if not exists vendas (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  numero          text not null,
  orcamento_id    uuid references orcamentos(id) on delete set null,
  show_id         uuid,
  contratante_id        uuid references contratantes(id) on delete set null,
  contratante_nome      text,
  contratante_email     text,
  contratante_telefone  text,
  contratante_documento text,
  contratante_endereco  text,
  nome_evento        text,
  evento_instagram   text,
  nome_local         text,
  capacidade_publico int,
  endereco_local     text,
  data_show          date,
  horario            text,
  horario_fim        text,
  cidade_id          uuid references cidades(id) on delete set null,
  casa_id            uuid references casas(id) on delete set null,
  artist_id          uuid references artists(id) on delete set null,
  line_up            jsonb default '[]'::jsonb,
  cache              numeric(10,2) default 0,
  duracao_horas      int default 0,
  duracao_minutos    int default 0,
  camarim            jsonb default '[]'::jsonb,
  efeitos            jsonb default '[]'::jsonb,
  hotel              jsonb default '[]'::jsonb,
  logistica          jsonb default '{}'::jsonb,
  observacoes        text,
  criado_por         uuid references profiles(id) on delete set null,
  criado_em          timestamptz default now(),
  atualizado_em      timestamptz default now()
);

create table if not exists parcelas (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  venda_id         uuid not null references vendas(id) on delete cascade,
  percentual       numeric(5,2) not null default 0,
  valor            numeric(10,2) not null default 0,
  data_vencimento  date,
  status_base      text not null default 'pendente'
                     check (status_base in ('pendente','pago')),
  data_pagamento   date,
  observacao       text
);

create table if not exists shows (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  artist_id       uuid references artists(id) on delete set null,
  contratante_id  uuid references contratantes(id) on delete set null,
  casa_id         uuid references casas(id) on delete set null,
  cidade_id       uuid references cidades(id) on delete set null,
  data            date,
  horario         text,
  status          text default 'confirmado',
  valor           numeric(10,2),
  orcamento_id    uuid references orcamentos(id) on delete set null,
  venda_id        uuid references vendas(id) on delete set null,
  criado_em       timestamptz default now()
);

create table if not exists subscriptions (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  plano            text references plans(id),
  ciclo            text not null default 'mensal',
  status           text not null default 'trial',
  valor            numeric(10,2),
  inicio_em        date,
  proxima_cobranca date
);

create table if not exists activity_logs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  tipo          text,
  descricao     text,
  usuario_id    uuid references profiles(id) on delete set null,
  data          timestamptz default now()
);

-- ============================================================
-- ÍNDICES — aceleram os filtros por workspace
-- ============================================================
create index if not exists idx_artists_ws       on artists(workspace_id);
create index if not exists idx_cidades_ws       on cidades(workspace_id);
create index if not exists idx_contratantes_ws  on contratantes(workspace_id);
create index if not exists idx_casas_ws         on casas(workspace_id);
create index if not exists idx_orcamentos_ws    on orcamentos(workspace_id);
create index if not exists idx_vendas_ws        on vendas(workspace_id);
create index if not exists idx_parcelas_ws      on parcelas(workspace_id);
create index if not exists idx_parcelas_venda   on parcelas(venda_id);
create index if not exists idx_shows_ws         on shows(workspace_id);
create index if not exists idx_subscriptions_ws on subscriptions(workspace_id);
create index if not exists idx_logs_ws          on activity_logs(workspace_id);
create index if not exists idx_profiles_ws      on profiles(workspace_id);

-- Pronto. Agora rode o 02_policies.sql
