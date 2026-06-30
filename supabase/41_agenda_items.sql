-- 41_agenda_items.sql
-- Itens da agenda além de shows: eventos personalizados (Fase 2) e, no futuro,
-- voos e transportes terrestres (Fase 3, via `tipo` + `dados` JSON).
-- Aditiva — não altera nenhuma tabela existente.

create table if not exists agenda_items (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  artist_id     uuid references artists(id) on delete set null,  -- de quem é o item (opcional; filtra por DJ)
  tipo          text not null,             -- 'evento' | 'voo' | 'transporte'
  titulo        text,                      -- título livre ("Studio", "Day Off", "Férias")
  data          date not null,             -- dia do item (casa com a agenda)
  data_fim      date,                      -- multi-dia opcional (Férias, voo overnight)
  dia_inteiro   boolean default false,
  hora_inicio   text,                      -- "HH:mm" (null se dia inteiro)
  hora_fim      text,                      -- "HH:mm" (opcional)
  dados         jsonb default '{}'::jsonb, -- payload específico por tipo (voo/transporte na Fase 3)
  observacoes   text,
  criado_em     timestamptz default now(),
  deletado_em   timestamptz                -- soft delete (igual shows)
);

create index if not exists idx_agenda_items_ws on agenda_items(workspace_id);
create index if not exists idx_agenda_items_data on agenda_items(workspace_id, data);

alter table agenda_items enable row level security;
drop policy if exists agenda_items_tenant on agenda_items;
create policy agenda_items_tenant on agenda_items
  for all using (workspace_id = meu_workspace_id() or sou_super_admin())
  with check (workspace_id = meu_workspace_id() or sou_super_admin());
