-- Bloqueio de contato (feature "Bloquear contratante/casa").
-- Marca um contratante ou casa como bloqueado (contato problemático), com
-- motivo, quem bloqueou e quando. Cidades NÃO têm bloqueio (fora de escopo).
--
-- Idempotente (IF NOT EXISTS) e reversível:
--   Reverter → alter table contratantes drop column if exists bloqueado, ...
--   (mesmo para casas). Ver bloco de rollback comentado no fim.
do $$
declare t text;
begin
  foreach t in array array['contratantes', 'casas'] loop
    execute format(
      'alter table %I add column if not exists bloqueado boolean not null default false',
      t
    );
    execute format(
      'alter table %I add column if not exists bloqueado_motivo text',
      t
    );
    -- Quem bloqueou (SET NULL se o autor sair da equipe, como as demais
    -- colunas de auditoria "quem" — migração 77).
    execute format(
      'alter table %I add column if not exists bloqueado_por uuid references profiles(id) on delete set null',
      t
    );
    execute format(
      'alter table %I add column if not exists bloqueado_em timestamptz',
      t
    );
    -- Índice parcial: só as linhas bloqueadas (o card VERMELHO do dashboard e
    -- a aba "Bloqueados" filtram por bloqueado = true).
    execute format(
      'create index if not exists idx_%s_bloqueado on %I(workspace_id) where bloqueado = true',
      t, t
    );
  end loop;
end $$;

-- Rollback (manual):
-- do $$
-- declare t text;
-- begin
--   foreach t in array array['contratantes', 'casas'] loop
--     execute format('drop index if exists idx_%s_bloqueado', t);
--     execute format('alter table %I drop column if exists bloqueado_em', t);
--     execute format('alter table %I drop column if exists bloqueado_por', t);
--     execute format('alter table %I drop column if exists bloqueado_motivo', t);
--     execute format('alter table %I drop column if exists bloqueado', t);
--   end loop;
-- end $$;
