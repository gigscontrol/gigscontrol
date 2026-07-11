-- CRÍTICO: o webhook do Stripe (aplicarStatus, espelharNoWorkspace) grava os
-- valores EM INGLÊS ('suspended'/'cancelled') em workspaces.status, mas o CHECK
-- antigo só aceitava PT ('ativa'/'trial'/'suspensa'/'cancelada'). Resultado: ao
-- suspender/cancelar um workspace, o UPDATE violava o CHECK e falhava em
-- silêncio (o codigo nao checa o error do .update()), deixando workspaces.status
-- MENTINDO (preso em 'ativa'). O acesso real usa subscriptions.status, entao o
-- bloqueio de inadimplencia funciona — mas a coluna de status do workspace fica
-- inconsistente (afeta relatorios/admin que confiem nela).
--
-- Fix minimo e backward-compatible: expande o CHECK pra aceitar o MESMO
-- vocabulario que subscriptions.status ja usa ('ativa'/'suspended'/'cancelled'/
-- 'graca'), mantendo os valores PT legados. So ADICIONA valores permitidos —
-- nao altera nenhuma linha existente (distinct atual = 'trial','ativa').
alter table workspaces drop constraint if exists workspaces_status_check;
alter table workspaces add constraint workspaces_status_check
  check (status = any (array[
    'ativa'::text, 'trial'::text,
    'suspensa'::text, 'cancelada'::text,   -- legados PT (mantidos)
    'suspended'::text, 'cancelled'::text,  -- o que o webhook realmente grava
    'graca'::text                          -- alinhado ao vocabulario de subscriptions
  ]));
