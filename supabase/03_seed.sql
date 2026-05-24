-- ============================================================
-- flow.book — 03: SEED (dados iniciais)
-- ============================================================
-- Rode DEPOIS do 02_policies.sql.
--
-- Este seed popula apenas o CATÁLOGO DE PLANOS — que é global.
-- Os workspaces e usuários de demonstração serão criados no Passo 2
-- (autenticação), pois dependem de usuários reais no Supabase Auth.
-- ============================================================

insert into plans (id, nome, tagline, preco_mensal, preco_anual_por_mes,
                   max_artistas, max_usuarios_equipe, destaque, recursos)
values
  ('individual', 'Individual',
   'Para o artista que gere a própria carreira',
   149.90, 119.90, 1, 1, false,
   '["1 artista","1 usuário (você)","Agenda e escala de shows","Orçamentos e vendas","Controle financeiro de pagamentos","Envio de orçamento por WhatsApp"]'::jsonb),

  ('equipe', 'Equipe',
   'Para quem trabalha com um time enxuto',
   349.90, 299.90, 3, 5, true,
   '["Até 3 artistas","Até 5 usuários da equipe","Tudo do plano Individual","Papéis: vendedor, produtor e financeiro","Controle de permissões por usuário","Métricas por artista"]'::jsonb),

  ('agencia', 'Agência',
   'Para agências em crescimento',
   549.90, 499.90, 10, 15, false,
   '["Até 10 artistas","Até 15 usuários da equipe","Tudo do plano Equipe","Permissões avançadas por escopo","Relatórios consolidados da agência","Suporte prioritário"]'::jsonb),

  ('agencia-plus', 'Agência Plus',
   'Operações de grande porte',
   1199.90, 999.90, 25, 40, false,
   '["Até 25 artistas","Até 40 usuários da equipe","Tudo do plano Agência","Multi-equipes de vendas","Exportação de dados","Gerente de conta dedicado"]'::jsonb),

  ('agencia-max', 'Agência Max',
   'O dobro da capacidade da Agência Plus',
   2399.90, 1799.90, 50, 80, false,
   '["Até 50 artistas","Até 80 usuários da equipe","Tudo do plano Agência Plus","Capacidade dobrada de operação","Onboarding assistido","Suporte dedicado com SLA"]'::jsonb)

on conflict (id) do update set
  nome                = excluded.nome,
  tagline             = excluded.tagline,
  preco_mensal        = excluded.preco_mensal,
  preco_anual_por_mes = excluded.preco_anual_por_mes,
  max_artistas        = excluded.max_artistas,
  max_usuarios_equipe = excluded.max_usuarios_equipe,
  destaque            = excluded.destaque,
  recursos            = excluded.recursos;

-- Confere o resultado
select id, nome, preco_mensal, preco_anual_por_mes from plans order by preco_mensal;
