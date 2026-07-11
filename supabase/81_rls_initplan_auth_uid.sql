-- Perf de RLS: envolve auth.uid() em (select auth.uid()) nas 11 policies
-- flagadas pelo advisor (auth_rls_initplan). Semantica IDENTICA — auth.uid() e
-- (select auth.uid()) retornam o mesmo valor; o wrapper faz o Postgres avaliar
-- UMA vez por statement (InitPlan) em vez de por linha. Recomendado pela doc do
-- Supabase. NAO muda quem ve o que; so acelera listagens grandes. ALTER POLICY
-- preserva cmd/permissive/roles — troca so a expressao.

alter policy anotacao_pastas_escrita on anotacao_pastas
  using (workspace_id in (select profiles.workspace_id from profiles where profiles.id = (select auth.uid())))
  with check (workspace_id in (select profiles.workspace_id from profiles where profiles.id = (select auth.uid())));

alter policy anotacao_pastas_leitura on anotacao_pastas
  using ((workspace_id in (select profiles.workspace_id from profiles where profiles.id = (select auth.uid()))) and ((visibilidade = 'todos'::text) or (criado_por = (select auth.uid())) or sou_membro_pasta(id)));

alter policy anotacoes_escrita on anotacoes
  using (workspace_id in (select profiles.workspace_id from profiles where profiles.id = (select auth.uid())))
  with check (workspace_id in (select profiles.workspace_id from profiles where profiles.id = (select auth.uid())));

alter policy anotacoes_leitura on anotacoes
  using ((workspace_id in (select profiles.workspace_id from profiles where profiles.id = (select auth.uid()))) and (((pasta_id is not null) and (exists (select 1 from anotacao_pastas p where p.id = anotacoes.pasta_id))) or ((show_id is not null) and (exists (select 1 from shows s where s.id = anotacoes.show_id)))));

alter policy anotacao_membros_rw on anotacao_pasta_membros
  using (exists (select 1 from anotacao_pastas p where ((p.id = anotacao_pasta_membros.pasta_id) and (p.workspace_id in (select profiles.workspace_id from profiles where profiles.id = (select auth.uid()))))))
  with check (exists (select 1 from anotacao_pastas p where ((p.id = anotacao_pasta_membros.pasta_id) and (p.workspace_id in (select profiles.workspace_id from profiles where profiles.id = (select auth.uid()))))));

alter policy historico_leitura on historico_acoes
  using (workspace_id = (select profiles.workspace_id from profiles where profiles.id = (select auth.uid())));

alter policy notificacoes_leitura_propria on notificacoes
  using (destinatario_id = (select auth.uid()));

alter policy notificacoes_marcar_propria on notificacoes
  using (destinatario_id = (select auth.uid()))
  with check (destinatario_id = (select auth.uid()));

alter policy profiles_leitura on profiles
  using ((id = (select auth.uid())) or (workspace_id = meu_workspace_id()) or sou_super_admin());

alter policy artista_scope on profiles
  using ((meu_papel() <> 'artista'::text) or (id = (select auth.uid())));

alter policy workspace_slug_history_select_admin on workspace_slug_history
  using (workspace_id in (select profiles.workspace_id from profiles where ((profiles.id = (select auth.uid())) and (profiles.papel = 'admin'::text))));
