-- 52 — País de origem do artista (documento/telefone/endereço por país).
--
-- Até aqui o artista era implicitamente do Brasil (CPF/CNPJ, telefone BR).
-- Agora o cadastro tem "País de origem" que dirige documento + DDI + endereço,
-- igual ao contratante da venda direta. Default 'BR' (todos os atuais). Idempotente.

alter table artists
  add column if not exists pais text not null default 'BR';
