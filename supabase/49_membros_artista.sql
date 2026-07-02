-- ============================================================
-- 49 — Permissões por artista (vínculo usuário × artista)
-- ============================================================
-- Fase 1 do novo modelo de permissões (estilo ERP): as permissões passam a ser
-- por VÍNCULO (usuário × artista), semeadas por perfis (presets) e
-- personalizáveis. Esta migração cria a tabela + faz o BACKFILL a partir do
-- modelo atual (profiles.funcoes), pra ninguém perder acesso.
--
-- Nada de comportamento muda ainda: o backend só passa a USAR estes vínculos
-- nas fases seguintes (o motor de permissões tem fallback pro modelo antigo).
-- ============================================================

CREATE TABLE IF NOT EXISTS membros_artista (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  artist_id    uuid NOT NULL REFERENCES artists(id)    ON DELETE CASCADE,
  -- Perfis (presets) aplicados ao vínculo — só pra exibição/re-semear na UI.
  perfis       text[] NOT NULL DEFAULT '{}',
  -- Conjunto EFETIVO de chaves de permissão concedidas (fonte da verdade do
  -- enforcement). Ex.: ["vendas.ver","vendas.criar_orcamento"].
  permissoes   jsonb  NOT NULL DEFAULT '[]',
  criado_em    timestamptz NOT NULL DEFAULT now(),
  deletado_em  timestamptz
);

CREATE INDEX IF NOT EXISTS membros_artista_workspace_idx ON membros_artista (workspace_id);
CREATE INDEX IF NOT EXISTS membros_artista_user_idx      ON membros_artista (user_id);
CREATE INDEX IF NOT EXISTS membros_artista_artist_idx    ON membros_artista (artist_id);
-- Um vínculo ativo por (usuário, artista).
CREATE UNIQUE INDEX IF NOT EXISTS membros_artista_uniq
  ON membros_artista (user_id, artist_id) WHERE deletado_em IS NULL;

-- RLS: mesmo padrão das outras tabelas — isolamento por workspace; a checagem
-- de "só admin escreve" fica na aplicação (writes vão pelo cliente admin).
ALTER TABLE membros_artista ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS membros_artista_rw ON membros_artista;
CREATE POLICY membros_artista_rw ON membros_artista
  FOR ALL
  USING (workspace_id = meu_workspace_id() OR sou_super_admin())
  WITH CHECK (workspace_id = meu_workspace_id() OR sou_super_admin());

-- ============================================================
-- BACKFILL — profiles.funcoes → vínculos
-- ============================================================
-- profiles.funcoes = { "vendedor": [artist_ids], "financeiro": [...], "produtor": [...] }
-- Cada (usuário, artista, função) vira um vínculo com o perfil equivalente e as
-- permissões-padrão desse perfil. Se o mesmo usuário tem o mesmo artista em mais
-- de uma função, vira UM vínculo com os dois perfis + união das permissões.
--
-- IMPORTANTE: as chaves abaixo espelham src/lib/permissoes/perfis.ts (presets
-- vendedor/financeiro/equipe). Mantê-las em sincronia se os presets mudarem.
WITH pares AS (
  SELECT
    p.id           AS user_id,
    p.workspace_id AS workspace_id,
    f.key          AS funcao,
    jsonb_array_elements_text(f.value) AS artist_id
  FROM profiles p, jsonb_each(p.funcoes) AS f(key, value)
  WHERE p.funcoes IS NOT NULL
    AND jsonb_typeof(p.funcoes) = 'object'
    AND p.deletado_em IS NULL
    AND f.key IN ('vendedor', 'financeiro', 'produtor')
    AND jsonb_typeof(f.value) = 'array'
),
perfilmap AS (
  SELECT
    user_id, workspace_id, artist_id,
    CASE funcao WHEN 'produtor' THEN 'equipe' ELSE funcao END AS perfil
  FROM pares
  WHERE artist_id IS NOT NULL
),
perfil_perms(perfil, perm) AS (
  VALUES
    -- Perfil VENDEDOR
    ('vendedor', 'agenda.ver'), ('vendedor', 'vendas.ver'),
    ('vendedor', 'vendas.criar_orcamento'), ('vendedor', 'vendas.editar_orcamento'),
    ('vendedor', 'vendas.converter'), ('vendedor', 'vendas.criar_venda'),
    ('vendedor', 'vendas.editar_venda'), ('vendedor', 'contatos.ver'),
    ('vendedor', 'contatos.criar'),
    -- Perfil FINANCEIRO
    ('financeiro', 'vendas.ver'), ('financeiro', 'financeiro.ver'),
    ('financeiro', 'financeiro.ver_caches'), ('financeiro', 'financeiro.ver_pagamentos'),
    ('financeiro', 'financeiro.registrar_pagamento'), ('financeiro', 'financeiro.editar_pagamento'),
    ('financeiro', 'financeiro.cancelar_pagamento'), ('financeiro', 'contatos.ver'),
    -- Perfil EQUIPE (ex-produtor)
    ('equipe', 'agenda.ver'), ('equipe', 'agenda.criar'), ('equipe', 'agenda.editar'),
    ('equipe', 'vendas.ver'), ('equipe', 'contatos.ver')
),
vinc AS (
  SELECT
    pm.user_id, pm.workspace_id, pm.artist_id,
    array_agg(DISTINCT pm.perfil)  AS perfis,
    array_agg(DISTINCT pp.perm)    AS perms
  FROM perfilmap pm
  JOIN perfil_perms pp ON pp.perfil = pm.perfil
  GROUP BY pm.user_id, pm.workspace_id, pm.artist_id
)
INSERT INTO membros_artista (workspace_id, user_id, artist_id, perfis, permissoes)
SELECT workspace_id, user_id, artist_id, perfis, to_jsonb(perms)
FROM vinc
ON CONFLICT DO NOTHING;
