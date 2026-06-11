-- ============================================================
-- 30: VENDAS + ORÇAMENTOS — número único (anti-duplicação)
-- ============================================================
-- Conserta e previne o bug de duas vendas com o mesmo número geradas
-- a partir do mesmo orçamento (double-click + race no proximoNumeroVenda
-- + ausência de constraint).
--
-- 1) Limpa duplicados existentes: mantém a venda/orçamento mais antigo
--    de cada (workspace_id, numero) ativo e manda os extras pra lixeira.
--    Também manda pra lixeira os shows vinculados a vendas trashadas
--    (consistência — show não pode ficar ativo sem venda ativa).
-- 2) Cria índice único PARCIAL (só linhas ativas, deletado_em is null) —
--    a lixeira pode conter números repetidos sem conflito.
--
-- Idempotente: re-rodar não faz nada (CTE não acha duplicado, índice
-- usa IF NOT EXISTS).
-- ============================================================

-- ---- VENDAS ----

-- 1a. Trasha vendas duplicadas (mantém a mais antiga por número)
with dups as (
  select id,
         row_number() over (
           partition by workspace_id, numero
           order by criado_em asc, id asc
         ) as rn
  from vendas
  where deletado_em is null
)
update vendas v
set deletado_em = now()
from dups
where v.id = dups.id
  and dups.rn > 1;

-- 1b. Trasha shows cuja venda está na lixeira mas o show não (inclui os
--     shows órfãos das vendas duplicadas recém-removidas)
update shows s
set deletado_em = now()
from vendas v
where s.venda_id = v.id
  and v.deletado_em is not null
  and s.deletado_em is null;

-- 1c. CONSERTO do over-trash: o show duplicado costuma estar vinculado à
--     venda MAIS NOVA (a que foi removida no 1a), então o 1b acabaria
--     trashando o único show e deixando a venda mantida sem show. Aqui
--     restauramos qualquer show que uma venda ATIVA ainda referencia
--     (via show_id) e re-vinculamos o venda_id pra ela.
update shows s
set deletado_em = null,
    venda_id = v.id
from vendas v
where v.show_id = s.id
  and v.deletado_em is null
  and s.deletado_em is not null;

-- 1d. Índice único parcial
create unique index if not exists vendas_workspace_numero_uniq
  on vendas (workspace_id, numero)
  where deletado_em is null;

-- ---- ORÇAMENTOS ----

-- 2a. Trasha orçamentos duplicados (mantém o mais antigo por número)
with dups as (
  select id,
         row_number() over (
           partition by workspace_id, numero
           order by criado_em asc, id asc
         ) as rn
  from orcamentos
  where deletado_em is null
)
update orcamentos o
set deletado_em = now()
from dups
where o.id = dups.id
  and dups.rn > 1;

-- 2b. Índice único parcial
create unique index if not exists orcamentos_workspace_numero_uniq
  on orcamentos (workspace_id, numero)
  where deletado_em is null;
