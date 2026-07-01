-- 46_downgrade_agendado.sql
-- Downgrade de plano AGENDADO pro fim do período (não devolve dinheiro; só
-- vira na próxima renovação). O Stripe Subscription Schedule é a fonte da
-- verdade da cobrança; estas colunas espelham o downgrade pendente pra:
--   1) travar o cadastro de recursos além do limite do plano-destino
--      enquanto o downgrade está pendente (anti-abuso), e
--   2) mostrar o aviso "downgrade agendado" na tela de Plano.
-- Aditivo/seguro — assinaturas existentes ficam com NULL (sem downgrade).

alter table subscriptions add column if not exists downgrade_para text;         -- PlanoId destino, ex 'individual'
alter table subscriptions add column if not exists downgrade_efetivo_em date;   -- quando vira (fim do período pago)
