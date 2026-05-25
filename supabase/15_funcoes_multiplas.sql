-- =============================================================
-- 15_funcoes_multiplas.sql
-- =============================================================
-- Adiciona suporte a múltiplas FUNÇÕES operacionais por usuário,
-- cada uma com sua própria lista de DJs (artists.id) atendidos.
--
-- Estrutura do JSON em profiles.funcoes:
--   {
--     "vendedor":   [ "<uuid-dj-1>", "<uuid-dj-2>" ],
--     "financeiro": [ "<uuid-dj-3>" ],
--     "produtor":   []
--   }
--
-- A coluna `papel` continua existindo — usaremos seu valor como
-- "papel primário" (admin / artista / vendedor / financeiro /
-- produtor) pra compatibilidade com policies e queries existentes.
-- Para usuários operacionais que combinam funções, `papel` recebe
-- a função primária (geralmente a primeira marcada na UI).
--
-- Usuários EXISTENTES com papel operacional ficarão com
-- funcoes = {} — o admin precisa reconfigurar pra liberar acesso
-- aos DJs corretos.
-- =============================================================

alter table profiles
  add column if not exists funcoes jsonb not null default '{}'::jsonb;

-- Garante CHECK soft: a coluna é sempre objeto JSON (não array, não null).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_funcoes_obj_chk'
  ) then
    alter table profiles
      add constraint profiles_funcoes_obj_chk
      check (jsonb_typeof(funcoes) = 'object');
  end if;
end $$;
