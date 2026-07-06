-- 61: Corrige o cron de purge (limpar_lixeira_expirada) — auditoria de confiabilidade.
--
-- CRITICO: a funcao arquivava so to_jsonb(vendas) e fazia `delete from vendas`;
-- a FK parcelas_venda_id_fkey e ON DELETE CASCADE, entao as PARCELAS (valor,
-- vencimento, comprovante, log de cobrancas) sumiam sem NENHUM backup apos 30
-- dias. Alem disso agenda_items e contratos nunca eram purgados (lixeira nunca
-- esvaziava pra esses tipos).
--
-- CORRECAO: arquiva as parcelas ANTES do delete das vendas + inclui
-- agenda_items e contratos no purge. Amplia o CHECK de tipo. Aplicada via MCP.

alter table public.lixeira_arquivo drop constraint if exists lixeira_arquivo_tipo_check;
alter table public.lixeira_arquivo add constraint lixeira_arquivo_tipo_check
  check (tipo = any (array['artista','usuario','orcamento','venda','contratante','casa','cidade','show','parcela','agenda','contrato']));

create or replace function public.limpar_lixeira_expirada()
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  limite timestamptz := now() - interval '30 days';
  n_parcelas int; n_vendas int; n_agenda int; n_contratos int;
begin
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'usuario', id, workspace_id, to_jsonb(profiles) from profiles
   where deletado_em is not null and deletado_em < limite;
  delete from auth.users where id in (select id from profiles where deletado_em is not null and deletado_em < limite);
  delete from profiles where deletado_em is not null and deletado_em < limite;

  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'artista', id, workspace_id, to_jsonb(artists) from artists
   where deletado_em is not null and deletado_em < limite;
  delete from artists where deletado_em is not null and deletado_em < limite;

  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'orcamento', id, workspace_id, to_jsonb(orcamentos) from orcamentos
   where deletado_em is not null and deletado_em < limite;
  delete from orcamentos where deletado_em is not null and deletado_em < limite;

  -- PARCELAS: arquiva ANTES do delete das vendas (o CASCADE as apagaria sem backup).
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'parcela', p.id, p.workspace_id, to_jsonb(p) from parcelas p
   join vendas v on v.id = p.venda_id
   where v.deletado_em is not null and v.deletado_em < limite;
  get diagnostics n_parcelas = row_count;

  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'venda', id, workspace_id, to_jsonb(vendas) from vendas
   where deletado_em is not null and deletado_em < limite;
  delete from vendas where deletado_em is not null and deletado_em < limite;
  get diagnostics n_vendas = row_count;

  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'contratante', id, workspace_id, to_jsonb(contratantes) from contratantes
   where deletado_em is not null and deletado_em < limite;
  delete from contratantes where deletado_em is not null and deletado_em < limite;

  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'casa', id, workspace_id, to_jsonb(casas) from casas
   where deletado_em is not null and deletado_em < limite;
  delete from casas where deletado_em is not null and deletado_em < limite;

  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'cidade', id, workspace_id, to_jsonb(cidades) from cidades
   where deletado_em is not null and deletado_em < limite;
  delete from cidades where deletado_em is not null and deletado_em < limite;

  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'show', id, workspace_id, to_jsonb(shows) from shows
   where deletado_em is not null and deletado_em < limite;
  delete from shows where deletado_em is not null and deletado_em < limite;

  -- AGENDA_ITEMS e CONTRATOS: antes ficavam presos pra sempre (fora do purge).
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'agenda', id, workspace_id, to_jsonb(agenda_items) from agenda_items
   where deletado_em is not null and deletado_em < limite;
  delete from agenda_items where deletado_em is not null and deletado_em < limite;
  get diagnostics n_agenda = row_count;

  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'contrato', id, workspace_id, to_jsonb(contratos) from contratos
   where deletado_em is not null and deletado_em < limite;
  delete from contratos where deletado_em is not null and deletado_em < limite;
  get diagnostics n_contratos = row_count;

  raise log 'limpar_lixeira_expirada: % parcelas arquivadas, % vendas, % agenda, % contratos', n_parcelas, n_vendas, n_agenda, n_contratos;
end; $function$;
