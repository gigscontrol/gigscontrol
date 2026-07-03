-- 50 — criado_por para suportar o escopo "editar/excluir só os que ele criou"
-- (Fase 4 do enforcement de permissões por artista).
--
-- shows / agenda_items / contratos hoje têm só criado_em. Sem saber QUEM criou,
-- não dá pra diferenciar "agenda.editar (só os que ele criou)" de
-- "agenda.editar_todos (qualquer)". Vendas e orçamentos já têm criado_por.
--
-- Linhas existentes ficam com criado_por NULL (dono desconhecido) → só quem tem
-- a permissão "_todos" consegue editá-las; a partir de agora toda linha nova
-- grava o criador. Idempotente.

alter table shows
  add column if not exists criado_por uuid references profiles(id) on delete set null;

alter table agenda_items
  add column if not exists criado_por uuid references profiles(id) on delete set null;

alter table contratos
  add column if not exists criado_por uuid references profiles(id) on delete set null;
