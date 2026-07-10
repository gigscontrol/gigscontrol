-- 70: corrige recursão infinita no RLS das anotações (42P17).
--
-- A policy de leitura de anotacao_pastas consultava anotacao_pasta_membros, cuja
-- policy consultava anotacao_pastas de volta → recursão. Solução padrão: uma
-- função SECURITY DEFINER que checa a associação lendo `membros` SEM re-disparar
-- o RLS, quebrando o ciclo. A leitura de notas passa a confiar no RLS da pasta
-- (o subselect em anotacao_pastas já filtra visibilidade).

create or replace function public.sou_membro_pasta(p_pasta uuid)
returns boolean
language sql
security definer
stable
set search_path to 'public'
as $$
  select exists (
    select 1 from public.anotacao_pasta_membros m
    where m.pasta_id = p_pasta and m.usuario_id = auth.uid()
  );
$$;

grant execute on function public.sou_membro_pasta(uuid) to authenticated;

-- Pastas: usa a função definer no lugar do EXISTS direto em membros.
drop policy if exists anotacao_pastas_leitura on public.anotacao_pastas;
create policy anotacao_pastas_leitura on public.anotacao_pastas for select using (
  workspace_id in (select workspace_id from public.profiles where id = auth.uid())
  and (
    visibilidade = 'todos'
    or criado_por = auth.uid()
    or public.sou_membro_pasta(id)
  )
);

-- Notas: visível se a PASTA é visível — o subselect já aplica o RLS da pasta
-- (sem recursão, pois a pasta agora usa a função definer).
drop policy if exists anotacoes_leitura on public.anotacoes;
create policy anotacoes_leitura on public.anotacoes for select using (
  workspace_id in (select workspace_id from public.profiles where id = auth.uid())
  and exists (select 1 from public.anotacao_pastas p where p.id = anotacoes.pasta_id)
);
