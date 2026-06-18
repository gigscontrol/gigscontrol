-- ============================================================
-- 37: ARTISTAS — dados do CONTRATADO (para contratos)
-- ============================================================
-- O `nome` do artista é o NOME ARTÍSTICO (ex: "Maninhoo"), usado como
-- rótulo no app. Para emitir contrato a gente precisa dos dados legais
-- do CONTRATADO, que ficam nestas colunas:
--   • nome_legal     — nome civil / responsável (sempre obrigatório)
--   • documento_tipo — 'cpf' ou 'cnpj'
--   • documento      — número do CPF/CNPJ (guardado já com máscara)
--   • razao_social   — razão social / nome da empresa (quando CNPJ)
--   • endereco       — endereço completo (opcional)
--   • telefone       — telefone de contato (opcional)
-- Cidade já existe desde a migração 21 (cidade_nome/uf/ibge_id).
-- RLS inalterada — já coberta pela workspace_id em `artists`.
-- ============================================================

alter table artists add column if not exists nome_legal     text;
alter table artists add column if not exists documento_tipo text
  check (documento_tipo is null or documento_tipo in ('cpf','cnpj'));
alter table artists add column if not exists documento      text;
alter table artists add column if not exists razao_social   text;
alter table artists add column if not exists endereco       text;
alter table artists add column if not exists telefone       text;

-- Recarrega o schema cache do PostgREST (senão a API pode não enxergar
-- as colunas novas imediatamente).
notify pgrst, 'reload schema';
