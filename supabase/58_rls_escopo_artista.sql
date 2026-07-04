-- 58: RLS por-artista para o papel ARTISTA.
--
-- PROBLEMA (auditoria): as 9 tabelas de domínio tinham só a policy de TENANT
-- (workspace_id = meu_workspace_id()) e o role authenticated tem GRANT direto.
-- Como o bundle expõe a anon key + o JWT do login, um usuário papel='artista'
-- podia chamar o PostgREST direto e LER/ESCREVER a agência INTEIRA (cachês de
-- outros artistas, contratos, PII de contratantes/signatários) — furando o
-- system-lock "artista só vê o próprio" que só existia nos route handlers.
--
-- CORREÇÃO: policies RESTRICTIVE (ANDam com a permissiva de tenant) que só
-- afetam papel='artista'. Admin/operacional/legado ficam IDÊNTICOS (o
-- `meu_papel() <> 'artista'` curto-circuita pra true). Verificado no banco vivo:
-- artista passa a ver só o próprio artist_id (vendas/shows/orçamentos/parcelas/
-- contratos/artists), é bloqueado em contratantes/signatários e só lê o próprio
-- profile; admin continua vendo tudo; escrita fora do escopo é barrada.

create or replace function public.meu_papel() returns text
  language sql stable security definer set search_path = public as $$
  select papel from public.profiles where id = auth.uid()
$$;

create or replace function public.meu_artista_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select artista_id from public.profiles where id = auth.uid()
$$;

-- Tabelas com artist_id direto
create policy artista_scope on public.vendas as restrictive for all
  using (public.meu_papel() <> 'artista' or artist_id = public.meu_artista_id())
  with check (public.meu_papel() <> 'artista' or artist_id = public.meu_artista_id());
create policy artista_scope on public.shows as restrictive for all
  using (public.meu_papel() <> 'artista' or artist_id = public.meu_artista_id())
  with check (public.meu_papel() <> 'artista' or artist_id = public.meu_artista_id());
create policy artista_scope on public.orcamentos as restrictive for all
  using (public.meu_papel() <> 'artista' or artist_id = public.meu_artista_id())
  with check (public.meu_papel() <> 'artista' or artist_id = public.meu_artista_id());
create policy artista_scope on public.agenda_items as restrictive for all
  using (public.meu_papel() <> 'artista' or artist_id = public.meu_artista_id())
  with check (public.meu_papel() <> 'artista' or artist_id = public.meu_artista_id());

-- artists: o próprio row é o artista
create policy artista_scope on public.artists as restrictive for all
  using (public.meu_papel() <> 'artista' or id = public.meu_artista_id())
  with check (public.meu_papel() <> 'artista' or id = public.meu_artista_id());

-- parcelas e contratos: escopo via venda_id
create policy artista_scope on public.parcelas as restrictive for all
  using (public.meu_papel() <> 'artista' or venda_id in (select v.id from public.vendas v where v.artist_id = public.meu_artista_id()))
  with check (public.meu_papel() <> 'artista' or venda_id in (select v.id from public.vendas v where v.artist_id = public.meu_artista_id()));
create policy artista_scope on public.contratos as restrictive for all
  using (public.meu_papel() <> 'artista' or venda_id in (select v.id from public.vendas v where v.artist_id = public.meu_artista_id()))
  with check (public.meu_papel() <> 'artista' or venda_id in (select v.id from public.vendas v where v.artist_id = public.meu_artista_id()));

-- contratantes e signatarios: artista bloqueado (a API já dá 403; a RLS não dava)
create policy artista_scope on public.contratantes as restrictive for all
  using (public.meu_papel() <> 'artista') with check (public.meu_papel() <> 'artista');
create policy artista_scope on public.contrato_signatarios as restrictive for all
  using (public.meu_papel() <> 'artista') with check (public.meu_papel() <> 'artista');

-- profiles: artista só lê o próprio (fecha leitura da PII da equipe via PostgREST)
create policy artista_scope on public.profiles as restrictive for select
  using (public.meu_papel() <> 'artista' or id = auth.uid());
