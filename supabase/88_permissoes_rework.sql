-- ============================================================
-- 88 — Rework de permissões (D1..D7) — coluna vendas.status + dados dos vínculos
-- ============================================================
-- Esta migração NÃO deve ser aplicada automaticamente — roda depois, junto do
-- deploy do rework. Ela faz três coisas:
--   (A) cria vendas.status (ativa|cancelada) — D5, cancelamento de venda;
--   (B) MIGRA os dados dos vínculos (membros_artista.permissoes) para o novo
--       catálogo: funde as duas chaves financeiras mortas em financeiro.ver,
--       remove contratos.excluir (agora admin-only, D4) e passa a conceder
--       vendas.ver_orcamentos a quem já via vendas (leitura separada, D3/D6);
--   (C) rede de segurança (D1): recria os vínculos de qualquer profile que
--       AINDA tenha funcoes legado sem vínculo ativo — pra ninguém perder
--       acesso quando o caminho legado (profiles.funcoes/escopo) morrer.
-- ============================================================


-- ============================================================
-- (A) vendas.status — D5 (cancelar venda)
-- ============================================================
-- Toda venda nasce 'ativa'. Cancelar (via /api/vendas/[id]/cancelar) grava
-- 'cancelada': a venda continua no histórico (com badge) mas sai dos dashboards
-- e do "a receber"; as parcelas NÃO pagas são canceladas em separado
-- (parcelas.meta.cancelamento — mecanismo já existente da migração 56/68).
alter table vendas
  add column if not exists status text not null default 'ativa'
  check (status in ('ativa', 'cancelada'));

-- Índice para as listas/dashboards que filtram por workspace + status
-- (só linhas vivas — as da lixeira já são excluídas por deletado_em).
create index if not exists vendas_status_idx
  on vendas (workspace_id, status)
  where deletado_em is null;


-- ============================================================
-- (B) DADOS dos vínculos existentes → novo catálogo de chaves
-- ============================================================
-- membros_artista.permissoes é um array JSON de chaves. Para cada vínculo ATIVO:
--   • financeiro.ver_caches / financeiro.ver_pagamentos  →  financeiro.ver
--     (as duas chaves foram FUNDIDAS numa só — D7);
--   • contratos.excluir  →  REMOVIDA (excluir contrato virou admin-only — D4);
--   • quem tem vendas.ver GANHA vendas.ver_orcamentos (a leitura de orçamentos
--     passou a ser uma chave separada da de vendas — D3/D6). Sem isso, quem só
--     via vendas deixaria de ver a lista de orçamentos.
-- O array é reconstruído sem duplicatas (array_agg DISTINCT). Só toca vínculos
-- que realmente precisam mudar (WHERE), e é idempotente. O LEFT JOIN LATERAL +
-- FILTER garante que um vínculo que ficasse SEM chaves após a limpeza (ex.: só
-- tinha contratos.excluir) vire '[]' em vez de sumir do update.
update membros_artista m
set permissoes = novo.perms
from (
  select
    mm.id,
    coalesce(to_jsonb(array_agg(distinct x.perm) filter (where x.perm is not null)), '[]'::jsonb) as perms
  from membros_artista mm
  left join lateral (
    -- funde as chaves financeiras mortas e descarta contratos.excluir
    select case
             when e in ('financeiro.ver_caches', 'financeiro.ver_pagamentos')
               then 'financeiro.ver'
             else e
           end as perm
    from jsonb_array_elements_text(mm.permissoes) as e
    where e <> 'contratos.excluir'
    union
    -- concede a leitura de orçamentos a quem já via vendas
    select 'vendas.ver_orcamentos'
    where mm.permissoes ? 'vendas.ver'
  ) x on true
  where mm.deletado_em is null
    and (
      mm.permissoes ?| array['financeiro.ver_caches', 'financeiro.ver_pagamentos', 'contratos.excluir']
      or (mm.permissoes ? 'vendas.ver' and not (mm.permissoes ? 'vendas.ver_orcamentos'))
    )
  group by mm.id
) as novo
where m.id = novo.id;


-- ============================================================
-- (C) STRAGGLERS legado — rede de segurança (D1)
-- ============================================================
-- Reexecuta o ESPÍRITO do backfill da migração 49 (profiles.funcoes → vínculos)
-- com ON CONFLICT DO NOTHING, agora já no NOVO catálogo de chaves. Serve pra
-- profiles que ainda têm funcoes mas por algum motivo não têm o vínculo ativo
-- correspondente (ex.: criados/alterados depois da migração 49). Assim, quando o
-- caminho legado (funcoes/escopo) for desligado, ninguém fica sem acesso.
--
-- Refinamento do escopo antigo: profiles com escopo->>verTodasVendas = 'false'
-- só enxergavam as PRÓPRIAS vendas — para esses, o vínculo nasce com
-- vendas.ver_proprios no lugar de vendas.ver (preserva o recorte).
--
-- IMPORTANTE: as chaves abaixo espelham src/lib/permissoes/perfis.ts. Mantê-las
-- em sincronia se os presets mudarem.
with pares as (
  select
    p.id           as user_id,
    p.workspace_id as workspace_id,
    f.key          as funcao,
    jsonb_array_elements_text(f.value) as artist_id_txt,
    -- verTodasVendas ausente == true (não recorta) — só 'false' explícito recorta.
    coalesce(p.escopo->>'verTodasVendas', 'true') as ver_todas_vendas
  from profiles p, jsonb_each(p.funcoes) as f(key, value)
  where p.funcoes IS NOT NULL
    and jsonb_typeof(p.funcoes) = 'object'
    and p.deletado_em IS NULL
    and f.key IN ('vendedor', 'financeiro', 'produtor')
    and jsonb_typeof(f.value) = 'array'
),
perfilmap as (
  select
    user_id, workspace_id,
    artist_id_txt::uuid AS artist_id,   -- funcoes guarda o id como texto no JSON
    case funcao when 'produtor' then 'equipe' else funcao end AS perfil,
    ver_todas_vendas
  from pares
  where artist_id_txt IS NOT NULL AND artist_id_txt <> ''
),
perfil_perms(perfil, perm) as (
  values
    -- Perfil VENDEDOR (catálogo novo: orçamentos separado + cancelar_venda)
    ('vendedor', 'agenda.ver'), ('vendedor', 'vendas.ver'), ('vendedor', 'vendas.ver_orcamentos'),
    ('vendedor', 'vendas.criar_orcamento'), ('vendedor', 'vendas.editar_orcamento'),
    ('vendedor', 'vendas.converter'), ('vendedor', 'vendas.criar_venda'),
    ('vendedor', 'vendas.editar_venda'), ('vendedor', 'vendas.cancelar_venda'),
    ('vendedor', 'contatos.ver'), ('vendedor', 'contatos.criar'),
    -- Perfil FINANCEIRO (financeiro.ver fundido; ver_caches/ver_pagamentos MORTAS)
    ('financeiro', 'vendas.ver'), ('financeiro', 'vendas.ver_orcamentos'),
    ('financeiro', 'financeiro.ver'),
    ('financeiro', 'financeiro.registrar_pagamento'), ('financeiro', 'financeiro.editar_pagamento'),
    ('financeiro', 'financeiro.cancelar_pagamento'), ('financeiro', 'contatos.ver'),
    -- Perfil EQUIPE (ex-produtor)
    ('equipe', 'agenda.ver'), ('equipe', 'agenda.criar'), ('equipe', 'agenda.editar'),
    ('equipe', 'vendas.ver'), ('equipe', 'vendas.ver_orcamentos'), ('equipe', 'contatos.ver')
),
vinc as (
  select
    pm.user_id, pm.workspace_id, pm.artist_id,
    -- se QUALQUER papel do usuário tinha verTodasVendas=false, recorta pra próprias.
    bool_or(pm.ver_todas_vendas = 'false') as forcar_proprios,
    array_agg(DISTINCT pm.perfil)  AS perfis,
    array_agg(DISTINCT pp.perm)    AS perms
  from perfilmap pm
  join perfil_perms pp on pp.perfil = pm.perfil
  join artists a on a.id = pm.artist_id   -- só artista que existe (satisfaz o FK)
  group by pm.user_id, pm.workspace_id, pm.artist_id
),
vinc_final as (
  select
    user_id, workspace_id, artist_id, perfis,
    case
      when forcar_proprios
        -- respeita o escopo antigo: troca vendas.ver por vendas.ver_proprios
        then array_replace(perms, 'vendas.ver', 'vendas.ver_proprios')
      else perms
    end as perms
  from vinc
)
insert into membros_artista (workspace_id, user_id, artist_id, perfis, permissoes)
select workspace_id, user_id, artist_id, perfis, to_jsonb(perms)
from vinc_final
on conflict do nothing;
