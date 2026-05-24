-- ============================================================
-- GIGS CONTROL — 11_aparencia.sql
-- Etapa 7b (Aparência): nome da agência + logo via Supabase Storage.
--
-- O que faz:
--   1. Adiciona `logo_url` em `workspaces`.
--   2. Cria o bucket público `workspace-logos`.
--   3. Cria 3 policies em storage.objects:
--      - Leitura: público (qualquer URL no bucket é acessível).
--      - Upload/Update/Delete: só profiles do mesmo workspace que
--        é dono da pasta `<workspace_id>/...`.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Coluna logo_url
-- ------------------------------------------------------------
alter table workspaces add column if not exists logo_url text;

-- ------------------------------------------------------------
-- 2. Bucket público de logos
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('workspace-logos', 'workspace-logos', true)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 3. Policies do bucket
-- ------------------------------------------------------------
-- Leitura pública (qualquer URL no bucket é servida sem auth)
drop policy if exists "workspace_logos_select_public" on storage.objects;
create policy "workspace_logos_select_public" on storage.objects
  for select
  using (bucket_id = 'workspace-logos');

-- Insert: o usuário autenticado só escreve em
-- `workspace-logos/<seu_workspace_id>/...`
drop policy if exists "workspace_logos_insert_tenant" on storage.objects;
create policy "workspace_logos_insert_tenant" on storage.objects
  for insert
  with check (
    bucket_id = 'workspace-logos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = meu_workspace_id()::text
  );

-- Update no objeto da própria pasta
drop policy if exists "workspace_logos_update_tenant" on storage.objects;
create policy "workspace_logos_update_tenant" on storage.objects
  for update
  using (
    bucket_id = 'workspace-logos'
    and (storage.foldername(name))[1] = meu_workspace_id()::text
  );

-- Delete no objeto da própria pasta
drop policy if exists "workspace_logos_delete_tenant" on storage.objects;
create policy "workspace_logos_delete_tenant" on storage.objects
  for delete
  using (
    bucket_id = 'workspace-logos'
    and (storage.foldername(name))[1] = meu_workspace_id()::text
  );

-- ------------------------------------------------------------
-- 4. Confere
-- ------------------------------------------------------------
select id, nome, plano, logo_url from workspaces;
