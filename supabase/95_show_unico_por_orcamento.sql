-- 95 — um SHOW por orçamento (anti-duplicação na aceitação)
--
-- Aceitar um orçamento cria o show vinculado. Sem guarda, um double-click (ou
-- dois membros aceitando ao mesmo tempo) faz as duas requisições lerem
-- showId=null e criarem DOIS shows pro mesmo orçamento — um vira órfão na
-- agenda. Índice único parcial: a 2a inserção falha (23505), e o service
-- captura e reusa o show existente. Conferido: zero duplicata hoje.

create unique index if not exists shows_orcamento_id_unico
  on public.shows (orcamento_id)
  where orcamento_id is not null and deletado_em is null;
