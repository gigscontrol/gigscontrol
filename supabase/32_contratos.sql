-- ============================================================
-- 32: CONTRATOS — modelos de contrato + contratos gerados
-- ============================================================
-- Módulo Contratos. Dois conceitos:
--
--  1. contrato_modelos: os modelos que a agência cria/gerencia.
--     - tipo 'editavel': texto com variáveis ({{artista}}, {{cache}}…)
--       preenchidas com os dados da venda ao gerar o contrato.
--     - tipo 'pdf': um PDF pronto enviado pela agência (Storage).
--
--  2. contratos: o contrato em si, gerado a partir de uma VENDA + um
--     modelo. Guarda número, status e um SNAPSHOT do corpo já preenchido
--     (pra não mudar se o modelo for editado depois).
--
-- Multi-tenant: tudo escopado por workspace_id, RLS no padrão `_tenant`
-- (só o meu workspace ou super-admin). Soft delete via deletado_em,
-- igual aos outros módulos.
-- ============================================================

-- ---- Modelos de contrato ----
create table if not exists contrato_modelos (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  nome          text not null,
  tipo          text not null default 'editavel',   -- 'editavel' | 'pdf'
  corpo         text,            -- texto com variáveis (tipo 'editavel')
  arquivo_url   text,            -- URL no Storage (tipo 'pdf')
  arquivo_nome  text,            -- nome original do arquivo (exibição)
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  deletado_em   timestamptz
);

comment on table contrato_modelos is
  'Modelos de contrato da agência. tipo=editavel guarda o texto com variáveis; tipo=pdf guarda a referência do arquivo no Storage.';

alter table contrato_modelos enable row level security;

drop policy if exists contrato_modelos_tenant on contrato_modelos;
create policy contrato_modelos_tenant on contrato_modelos
  for all using (workspace_id = meu_workspace_id() or sou_super_admin())
  with check (workspace_id = meu_workspace_id() or sou_super_admin());

create index if not exists contrato_modelos_workspace_idx
  on contrato_modelos (workspace_id)
  where deletado_em is null;

-- ---- Contratos ----
create table if not exists contratos (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  venda_id         uuid references vendas(id) on delete set null,
  modelo_id        uuid references contrato_modelos(id) on delete set null,
  numero           text not null,                    -- "CTR-0001"
  status           text not null default 'rascunho', -- rascunho|enviado|assinado|cancelado
  corpo_preenchido text,            -- snapshot do texto já preenchido (modelo editavel)
  arquivo_url      text,            -- PDF do contrato (modelo pdf / exportado)
  local_assinatura text,
  data_emissao     date,
  data_assinatura  date,
  observacoes      text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  deletado_em      timestamptz
);

comment on table contratos is
  'Contrato gerado a partir de uma venda + um modelo. corpo_preenchido é um snapshot (não muda se o modelo for editado depois).';

alter table contratos enable row level security;

drop policy if exists contratos_tenant on contratos;
create policy contratos_tenant on contratos
  for all using (workspace_id = meu_workspace_id() or sou_super_admin())
  with check (workspace_id = meu_workspace_id() or sou_super_admin());

create index if not exists contratos_workspace_idx
  on contratos (workspace_id)
  where deletado_em is null;

create index if not exists contratos_venda_idx
  on contratos (venda_id);

-- Número único por workspace (entre os não-deletados) — igual vendas/orçamentos (mig 30).
create unique index if not exists contratos_numero_uniq
  on contratos (workspace_id, numero)
  where deletado_em is null;
