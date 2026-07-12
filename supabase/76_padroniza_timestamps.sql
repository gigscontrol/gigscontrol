-- Padroniza criado_em + atualizado_em nas tabelas de domínio, com trigger
-- que auto-mantém atualizado_em (zero código, sempre correto).

-- 1) criado_em onde falta.
alter table cidades       add column if not exists criado_em timestamptz not null default now();
alter table parcelas      add column if not exists criado_em timestamptz not null default now();
alter table subscriptions add column if not exists criado_em timestamptz not null default now();

-- 2) atualizado_em onde falta (nas mutáveis de domínio).
alter table agenda_items         add column if not exists atualizado_em timestamptz not null default now();
alter table artists              add column if not exists atualizado_em timestamptz not null default now();
alter table casas                add column if not exists atualizado_em timestamptz not null default now();
alter table cidades              add column if not exists atualizado_em timestamptz not null default now();
alter table contratantes         add column if not exists atualizado_em timestamptz not null default now();
alter table membros_artista      add column if not exists atualizado_em timestamptz not null default now();
alter table profiles             add column if not exists atualizado_em timestamptz not null default now();
alter table shows                add column if not exists atualizado_em timestamptz not null default now();
alter table subscriptions        add column if not exists atualizado_em timestamptz not null default now();
alter table workspaces           add column if not exists atualizado_em timestamptz not null default now();
alter table contrato_signatarios add column if not exists atualizado_em timestamptz not null default now();
alter table parcelas             add column if not exists atualizado_em timestamptz not null default now();

-- 3) Trigger que seta atualizado_em = now() em todo UPDATE (search_path fixo).
create or replace function set_atualizado_em()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- 4) Aplica o trigger em todas as tabelas de domínio que têm atualizado_em.
do $$
declare t text;
begin
  foreach t in array array[
    'agenda_items','artists','casas','cidades','contratantes','membros_artista',
    'profiles','shows','subscriptions','workspaces','contrato_signatarios','parcelas',
    'anotacao_pastas','anotacoes','contrato_modelos','contratos','orcamentos','vendas'
  ] loop
    execute format('drop trigger if exists trg_atualizado_em on %I', t);
    execute format('create trigger trg_atualizado_em before update on %I for each row execute function set_atualizado_em()', t);
  end loop;
end $$;
