-- 67: LGPD — enfileira o voucher de HOTEL (booking) na limpeza pós-purge.
--
-- PROBLEMA: a feature de booking/hospedagem (Fases 4-5) guarda o PDF do hotel em
--   vouchers/{ws}/booking/{showId}/voucher.pdf
-- e o path vive em shows.meta.booking.voucherPath. A migration 64 enfileira os
-- vouchers de VOO (agenda_items.dados.voucherPath), comprovantes e assinaturas —
-- mas NÃO o voucher de hotel. Quando o show é hard-deletado no purge, o PDF (com
-- PII de hospedagem) ficava órfão no bucket para sempre.
--
-- SOLUÇÃO: CREATE OR REPLACE da função, idêntica à 64, adicionando o enqueue do
-- voucher de hotel ANTES do delete de shows. Não toca dados; só a definição da
-- função (que roda no cron /api/cron/limpar-storage).

create or replace function public.limpar_lixeira_expirada()
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  limite timestamptz := now() - interval '30 days';
  n_parcelas int; n_vendas int; n_agenda int; n_contratos int;
  n_orfaos int;
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

  -- ENQUEUE comprovantes: path exato guardado na meta da parcela (bancario/PII).
  insert into storage_orfaos (bucket, path)
  select 'comprovantes', p.meta->'pagamento'->>'comprovantePath'
    from parcelas p join vendas v on v.id = p.venda_id
   where v.deletado_em is not null and v.deletado_em < limite
     and p.meta->'pagamento'->>'comprovantePath' is not null;

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

  -- ENQUEUE voucher de HOTEL (booking) — path em shows.meta.booking.voucherPath.
  -- (NOVO na migration 67: feature de hospedagem introduzida depois da 64.)
  insert into storage_orfaos (bucket, path)
  select 'vouchers', s.meta->'booking'->>'voucherPath'
    from shows s
   where s.deletado_em is not null and s.deletado_em < limite
     and s.meta->'booking'->>'voucherPath' is not null;

  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'show', id, workspace_id, to_jsonb(shows) from shows
   where deletado_em is not null and deletado_em < limite;
  delete from shows where deletado_em is not null and deletado_em < limite;

  -- ENQUEUE vouchers de VOO: path exato guardado em dados.voucherPath do agenda_item.
  insert into storage_orfaos (bucket, path)
  select 'vouchers', a.dados->>'voucherPath'
    from agenda_items a
   where a.deletado_em is not null and a.deletado_em < limite
     and a.dados->>'voucherPath' is not null;

  -- AGENDA_ITEMS e CONTRATOS: antes ficavam presos pra sempre (fora do purge).
  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'agenda', id, workspace_id, to_jsonb(agenda_items) from agenda_items
   where deletado_em is not null and deletado_em < limite;
  delete from agenda_items where deletado_em is not null and deletado_em < limite;
  get diagnostics n_agenda = row_count;

  -- ENQUEUE assinaturas: paths exatos das 4 fotos de cada signatario do contrato
  -- (fotoCpf/fotoDocumento/fotoDocumentoVerso/selfie). As demais chaves de
  -- `arquivos` (facialSimilaridade/facialMatch) NAO sao paths — ficam de fora.
  insert into storage_orfaos (bucket, path)
  select 'assinaturas', x.pth
    from contratos c
    join contrato_signatarios s on s.contrato_id = c.id
    cross join lateral (values
      (s.arquivos->>'fotoCpf'),
      (s.arquivos->>'fotoDocumento'),
      (s.arquivos->>'fotoDocumentoVerso'),
      (s.arquivos->>'selfie')
    ) as x(pth)
   where c.deletado_em is not null and c.deletado_em < limite
     and x.pth is not null;

  insert into lixeira_arquivo (tipo, origem_id, workspace_id, dados)
  select 'contrato', id, workspace_id, to_jsonb(contratos) from contratos
   where deletado_em is not null and deletado_em < limite;
  delete from contratos where deletado_em is not null and deletado_em < limite;
  get diagnostics n_contratos = row_count;

  select count(*) into n_orfaos from storage_orfaos where processado_em is null;
  raise log 'limpar_lixeira_expirada: % parcelas, % vendas, % agenda, % contratos; % objetos na fila de storage', n_parcelas, n_vendas, n_agenda, n_contratos, n_orfaos;
end; $function$;
