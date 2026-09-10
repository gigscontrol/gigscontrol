-- 100 — Artista concretiza venda direta: abre CRIAR contratante pro papel
-- artista (pedido do dono, 10/09/2026).
--
-- Contexto: a venda direta cria o CONTRATANTE antes de postar a venda, e a
-- policy restritiva `artista_scope` de contratantes barrava o papel artista em
-- TUDO (até SELECT) — com vendasCriar autorizado, o artista batia em "Artista
-- não tem acesso a contatos" e nenhuma venda direta dele concluía.
--
-- Regra nova, espelhando o motor (podeArtista, resolver.ts):
--   - SELECT: privacidade.contatos <> 'nenhum' (o serviço segue filtrando a
--     lista por escopoContatosDoArtista); linha criada pelo próprio usuário é
--     sempre visível (cobre o RETURNING do INSERT).
--   - INSERT: privacidade.vendasCriar OU orcamentosCriar.
--   - UPDATE/DELETE: continuam fechados pro artista (base da agência).
-- As policies permissivas de tenant seguem valendo por cima (workspace).

drop policy if exists artista_scope on public.contratantes;

create policy artista_scope_select on public.contratantes
  as restrictive for select
  using (
    public.meu_papel() <> 'artista'
    or criado_por = auth.uid()
    or exists (
      select 1 from public.artists a
      where a.id = public.meu_artista_id()
        and coalesce(a.privacidade->>'contatos', 'nenhum') <> 'nenhum'
    )
  );

create policy artista_scope_insert on public.contratantes
  as restrictive for insert
  with check (
    public.meu_papel() <> 'artista'
    or exists (
      select 1 from public.artists a
      where a.id = public.meu_artista_id()
        and (
          coalesce((a.privacidade->>'vendasCriar')::boolean, false)
          or coalesce((a.privacidade->>'orcamentosCriar')::boolean, false)
        )
    )
  );

create policy artista_scope_update on public.contratantes
  as restrictive for update
  using (public.meu_papel() <> 'artista')
  with check (public.meu_papel() <> 'artista');

create policy artista_scope_delete on public.contratantes
  as restrictive for delete
  using (public.meu_papel() <> 'artista');
