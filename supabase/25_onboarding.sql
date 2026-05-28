-- ============================================================
-- 25: WORKSPACES — flag de onboarding completo
-- ============================================================
-- Marca se o admin já passou pelo checklist inicial "Comece por
-- aqui" (logo, primeiro artista, primeiro contratante, etc).
--
-- Workspaces existentes (Bruno e qualquer admin que já está usando
-- o app) ficam como TRUE automaticamente — não faz sentido forçá-los
-- a passar pelo onboarding agora.
-- ============================================================

alter table workspaces
  add column if not exists onboarding_completo boolean default false;

-- Backfill: tudo que já existe está "completo" (não passa pelo onboarding)
update workspaces
   set onboarding_completo = true
 where onboarding_completo is null
    or onboarding_completo = false;

-- Garante NOT NULL daqui em diante
alter table workspaces alter column onboarding_completo set not null;
