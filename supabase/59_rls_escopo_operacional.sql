-- 59: RLS por-vínculo para usuários OPERACIONAIS (produtor/vendedor/etc).
--
-- Fecha o único MEDIUM da 3ª auditoria: a RLS só escopava o papel artista
-- (migration 58); para operacionais a RLS liberava TODAS as linhas do workspace
-- e o gate por-vínculo (membros_artista) vivia só na aplicação (aplicarFiltro*).
-- Qualquer rota nova que usasse o client da sessão sem o filtro vazaria
-- cross-artista. Esta migration adiciona a defesa em profundidade no banco.
--
-- Policies RESTRICTIVE (ANDam com tenant + artista_scope). Espelham
-- filtrarEscopoArtista: operacional COM vínculo só alcança os artistas
-- vinculados; legado (SEM vínculo) e admin/super ficam livres; artista é
-- tratado pela artista_scope. VERIFICADO no banco vivo: admin vê tudo (5),
-- artista só o próprio (4), operacional vinculado só o vinculado (4),
-- operacional sem vínculo/legado livre (5).

create or replace function public.alcanca_operacional(aid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select
    sou_super_admin()
    or public.meu_papel() in ('admin','artista')
    or not exists (select 1 from public.membros_artista m where m.user_id = auth.uid() and m.deletado_em is null)
    or aid in (select m.artist_id from public.membros_artista m where m.user_id = auth.uid() and m.deletado_em is null)
$$;

create policy operacional_scope on public.vendas as restrictive for all
  using (public.alcanca_operacional(artist_id))
  with check (public.alcanca_operacional(artist_id));
create policy operacional_scope on public.shows as restrictive for all
  using (public.alcanca_operacional(artist_id))
  with check (public.alcanca_operacional(artist_id));
create policy operacional_scope on public.orcamentos as restrictive for all
  using (public.alcanca_operacional(artist_id))
  with check (public.alcanca_operacional(artist_id));
create policy operacional_scope on public.agenda_items as restrictive for all
  using (public.alcanca_operacional(artist_id))
  with check (public.alcanca_operacional(artist_id));
create policy operacional_scope on public.parcelas as restrictive for all
  using (public.alcanca_operacional((select v.artist_id from public.vendas v where v.id = parcelas.venda_id)))
  with check (public.alcanca_operacional((select v.artist_id from public.vendas v where v.id = parcelas.venda_id)));
create policy operacional_scope on public.contratos as restrictive for all
  using (public.alcanca_operacional((select v.artist_id from public.vendas v where v.id = contratos.venda_id)))
  with check (public.alcanca_operacional((select v.artist_id from public.vendas v where v.id = contratos.venda_id)));
