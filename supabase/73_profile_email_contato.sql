-- Migration 73 — e-mail de contato da equipe (pessoa)
--
-- profiles.email já guarda o LOGIN (e-mail fake interno "raiz-slug@..."
-- pros membros criados pelo admin), então NÃO dá pra reaproveitar pra
-- e-mail de contato. Cria uma coluna dedicada, espelhando o que a
-- migration 72 fez pro artista (artists.email).
--
-- data_nascimento já foi adicionado a profiles na migration 72.
alter table profiles add column if not exists email_contato text;
