-- ============================================================
-- 38: ASSINATURA DE CONTRATOS (Fase 1) — signatários + links públicos
-- ============================================================
-- Cada contrato pode ter N signatários (ex.: contratante + artista). Cada
-- signatário tem um `token` que vira o link público /assinar/{token}. A
-- agência gerencia via RLS de workspace; a PÁGINA PÚBLICA (sem login) lê e
-- escreve pelo token usando service-role (o token é a credencial).
--
-- Fase 1 captura: assinatura na tela (PNG base64), CPF/CNPJ, IP, dispositivo,
-- geolocalização, data/hora. Fotos/selfie (Storage) e reconhecimento facial
-- ficam pras Fases 2/3 — já há flags em `exige` pra elas.
-- ============================================================

create table if not exists contrato_signatarios (
  id             uuid primary key default gen_random_uuid(),
  contrato_id    uuid not null references contratos(id) on delete cascade,
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  nome           text not null,
  email          text,
  papel          text,                  -- 'contratante' | 'contratado' | 'testemunha' | livre
  ordem          int not null default 0,
  token          text not null,         -- link público /assinar/{token}
  exige          jsonb not null default '{}'::jsonb,  -- métodos exigidos
  status         text not null default 'pendente',    -- 'pendente' | 'assinado'
  assinatura     text,                  -- PNG (data URL base64) da assinatura na tela
  documento      text,                  -- CPF/CNPJ informado pelo signatário
  ip             text,
  geolocalizacao text,
  dispositivo    text,                  -- user agent
  assinado_em    timestamptz,
  criado_em      timestamptz not null default now()
);

comment on table contrato_signatarios is
  'Signatários de um contrato (Fase 1 da assinatura). token = link público. RLS por workspace pra a agência; a página pública lê/escreve por token via service-role.';

alter table contrato_signatarios enable row level security;

drop policy if exists contrato_signatarios_tenant on contrato_signatarios;
create policy contrato_signatarios_tenant on contrato_signatarios
  for all using (workspace_id = meu_workspace_id() or sou_super_admin())
  with check (workspace_id = meu_workspace_id() or sou_super_admin());

create index if not exists contrato_signatarios_contrato_idx
  on contrato_signatarios (contrato_id);

create unique index if not exists contrato_signatarios_token_uniq
  on contrato_signatarios (token);
