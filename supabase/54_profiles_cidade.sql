-- 54 — Cidade do usuário da equipe (dados pessoais / contrato).
--
-- profiles ganha cidade_id (FK pro catálogo cidades), preenchido no "Criar
-- usuário" via lookup-or-create (mesmo fluxo de contratante/casa). Anulável.

alter table profiles
  add column if not exists cidade_id uuid references cidades(id) on delete set null;
