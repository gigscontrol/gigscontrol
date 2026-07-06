-- 65: Fuso horario (display-only). Aplicada via MCP.
--
-- É APENAS EXIBIÇÃO: o backend/cron continuam em UTC. Nada converte horário.
--  - workspaces.fuso_padrao: default da agência (IANA, ex.: "America/Sao_Paulo").
--    Pré-preenche o seletor de fuso do evento + display. Editável na aba
--    Preferências (admin).
--  - vendas/orcamentos/shows.fuso_horario: rótulo do horário do show ("22:00 ·
--    horário de Lisboa"), definido a cada evento (default = fuso_padrao / cidade).
--    Guardado como texto, SEM conversão do horário.

alter table public.workspaces add column if not exists fuso_padrao text;
alter table public.vendas add column if not exists fuso_horario text;
alter table public.orcamentos add column if not exists fuso_horario text;
alter table public.shows add column if not exists fuso_horario text;
