-- 45_workspace_preferencias.sql
-- Preferências da agência (workspace): idioma padrão, país padrão e
-- formato de data. Aditivo/seguro — workspaces existentes ficam com NULL
-- (o app cai nos defaults: pt / BR / dmy).

alter table workspaces add column if not exists idioma_padrao text;  -- 'pt'|'en'|'es'|'fr'|'de'|'it'
alter table workspaces add column if not exists pais_padrao text;    -- ISO2, ex 'BR'
alter table workspaces add column if not exists formato_data text;   -- 'dmy'|'mdy'
