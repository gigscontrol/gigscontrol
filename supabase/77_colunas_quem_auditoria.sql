-- Colunas de auditoria "quem" (referenciam profiles; SET NULL se o autor sair).
-- deletado_por → todas as soft-deletáveis (14).
do $$
declare t text;
begin
  foreach t in array array[
    'agenda_items','anotacao_pastas','anotacoes','artists','casas','cidades',
    'contratantes','contrato_modelos','contratos','membros_artista','orcamentos',
    'profiles','shows','vendas'
  ] loop
    execute format('alter table %I add column if not exists deletado_por uuid references profiles(id) on delete set null', t);
    execute format('create index if not exists idx_%s_deletado_por on %I(deletado_por)', t, t);
  end loop;
end $$;

-- criado_por → tabelas de domínio que faltam.
do $$
declare t text;
begin
  foreach t in array array['artists','casas','contrato_modelos','membros_artista'] loop
    execute format('alter table %I add column if not exists criado_por uuid references profiles(id) on delete set null', t);
    execute format('create index if not exists idx_%s_criado_por on %I(criado_por)', t, t);
  end loop;
end $$;

-- atualizado_por → tabelas que o usuário edita.
do $$
declare t text;
begin
  foreach t in array array[
    'shows','orcamentos','vendas','contratos','contratantes','casas','artists',
    'agenda_items','contrato_modelos','membros_artista','profiles'
  ] loop
    execute format('alter table %I add column if not exists atualizado_por uuid references profiles(id) on delete set null', t);
    execute format('create index if not exists idx_%s_atualizado_por on %I(atualizado_por)', t, t);
  end loop;
end $$;
