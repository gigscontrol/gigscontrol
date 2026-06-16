-- =============================================================
-- 33_artistas_privacidade.sql
-- =============================================================
-- Privacidade do DJ (Fase 1 — persistência/configuração).
--
-- Cada artista ganha um objeto de permissões `privacidade` (jsonb)
-- que define o que aquele DJ pode VER e FAZER no sistema. É salvo e
-- lido ponta-a-ponta pelo backend; o ENFORCEMENT (calcularPermissoes,
-- APIs de vendas/orçamentos) vem numa fase posterior.
--
-- Shape do JSON em artists.privacidade:
--   {
--     "orcamentosVer": true,  "orcamentosCriar": false,
--     "vendasVer": true,      "vendasCriar": false,
--     "financeiroVer": true,  "financeiroInformar": false,
--     "contratosVer": true,   "contratosCriar": false,
--     "contatos": "proprios"            -- "todos" | "proprios"
--   }
--
-- A coluna nasce com default '{}' (objeto VAZIO). O objeto "cheio" com
-- todos os campos é produzido pelo merge campo-a-campo no mapper
-- (privacidadeValida sobre PRIVACIDADE_DJ_PADRAO) — NÃO vem do banco.
-- Artistas EXISTENTES ficam com privacidade = {} e herdam o padrão na
-- leitura.
-- =============================================================

alter table artists
  add column if not exists privacidade jsonb not null default '{}'::jsonb;

-- Garante CHECK soft: a coluna é sempre objeto JSON (não array, não null).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'artists_privacidade_obj_chk'
  ) then
    alter table artists
      add constraint artists_privacidade_obj_chk
      check (jsonb_typeof(privacidade) = 'object');
  end if;
end $$;
