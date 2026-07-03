-- 55 — Cor de identificação + nome civil + razão social do usuário da equipe.
--
-- O "Criar usuário" passou a espelhar o "Novo artista": ganha cor de
-- identificação, nome completo (civil) e razão social (quando CNPJ). Anuláveis.

alter table profiles
  add column if not exists cor text,
  add column if not exists nome_legal text,
  add column if not exists razao_social text;
