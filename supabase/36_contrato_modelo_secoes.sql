-- ============================================================
-- 36: CONTRATOS — seções do modelo editável
-- ============================================================
-- O modelo de contrato editável passa a ser montado como uma LISTA ordenada
-- de seções (cada uma: título + corpo com variáveis {{...}}), em vez de um
-- texto único. Guardado em jsonb. O `corpo` antigo (migration 32) vira
-- legado — modelos editáveis novos usam `secoes`.
-- ============================================================

alter table contrato_modelos
  add column if not exists secoes jsonb not null default '[]'::jsonb;
