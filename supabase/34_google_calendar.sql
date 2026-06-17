-- ============================================================
-- 34: GOOGLE CALENDAR — conexão OAuth por artista + sync de shows
-- ============================================================
-- Cada artista pode ter UMA conta Google conectada (pelo admin) para
-- sincronizar os shows com o Google Calendar. Os tokens OAuth ficam numa
-- tabela DEDICADA (não na `artists`) pra ficarem isolados e nunca vazarem
-- pelo repositório do artista. O refresh_token/access_token são guardados
-- CRIPTOGRAFADOS em repouso (AES-GCM, chave GOOGLE_TOKEN_ENC_KEY no app).
--
-- Multi-tenant: escopado por workspace_id, RLS no padrão `_tenant`.
-- ============================================================

create table if not exists artist_google_calendar (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  artist_id       uuid not null references artists(id) on delete cascade,
  google_email    text not null,                 -- conta conectada (exibição)
  refresh_token   text not null,                 -- CRIPTOGRAFADO (AES-GCM)
  access_token    text,                          -- CRIPTOGRAFADO; renovado sob demanda
  token_expira_em timestamptz,                   -- validade do access_token
  calendar_id     text not null default 'primary',
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

comment on table artist_google_calendar is
  'Conexão OAuth do Google Calendar por artista. Tokens criptografados em repouso; lidos só pelo backend. 1 conexão por artista.';

-- 1 conexão por artista (upsert por artist_id)
create unique index if not exists artist_google_calendar_artist_uniq
  on artist_google_calendar (artist_id);

create index if not exists artist_google_calendar_workspace_idx
  on artist_google_calendar (workspace_id);

alter table artist_google_calendar enable row level security;

drop policy if exists artist_google_calendar_tenant on artist_google_calendar;
create policy artist_google_calendar_tenant on artist_google_calendar
  for all using (workspace_id = meu_workspace_id() or sou_super_admin())
  with check (workspace_id = meu_workspace_id() or sou_super_admin());

-- Guarda o id do evento criado no Google Calendar, pra atualizar/remover
-- depois (Fase 3) quando o show for editado ou cancelado.
alter table shows add column if not exists google_event_id text;
