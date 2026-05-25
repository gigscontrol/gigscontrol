-- =============================================================
-- 19_notificacoes_parcelas.sql
-- =============================================================
-- Cron diário que notifica os admins sobre parcelas pendentes:
--   - Vence hoje                  → aviso ⚠️
--   - Vence em 1-3 dias            → aviso 🔔
--   - Atrasada (vencimento passou) → alerta 🚨
--
-- Dedup intra-dia: não insere notificação se já existe uma do mesmo
-- destinatário pra essa parcela criada no mesmo dia. Assim você é
-- avisado uma vez por dia até pagar — e não 47 vezes.
-- =============================================================

create or replace function notificar_parcelas_vencendo()
returns void
language plpgsql
security definer
as $$
declare
  hoje date := current_date;
begin
  -- Inserção em massa: pra cada parcela "interessante" × cada admin do
  -- workspace dela, cria uma notificação se ainda não existe hoje.
  insert into notificacoes
    (workspace_id, destinatario_id, titulo, mensagem, tipo, modulo, entidade_id)
  select
    v.workspace_id,
    p.destinatario_id,
    p.titulo,
    p.mensagem,
    p.tipo_notif,
    'parcela',
    p.id
  from (
    -- Subquery: parcelas + texto/tipo pra cada caso
    select
      par.id,
      par.venda_id,
      par.data_vencimento,
      par.percentual,
      par.valor,
      case
        when par.data_vencimento < hoje then 'alerta'
        when par.data_vencimento = hoje then 'aviso'
        else 'info'
      end as tipo_notif,
      case
        when par.data_vencimento < hoje then
          'Parcela atrasada'
        when par.data_vencimento = hoje then
          'Parcela vence hoje'
        else
          'Parcela vence em ' || (par.data_vencimento - hoje) || ' dia' ||
          case when (par.data_vencimento - hoje) = 1 then '' else 's' end
      end as titulo,
      case
        when par.data_vencimento < hoje then
          'Parcela de R$ ' || to_char(par.valor, 'FM999G999G999D00') ||
          ' venceu há ' || (hoje - par.data_vencimento) || ' dia' ||
          case when (hoje - par.data_vencimento) = 1 then '' else 's' end || '.'
        when par.data_vencimento = hoje then
          'Parcela de R$ ' || to_char(par.valor, 'FM999G999G999D00') ||
          ' (' || par.percentual || '%) vence hoje.'
        else
          'Parcela de R$ ' || to_char(par.valor, 'FM999G999G999D00') ||
          ' (' || par.percentual || '%) vence em ' || (par.data_vencimento - hoje) || ' dia' ||
          case when (par.data_vencimento - hoje) = 1 then '' else 's' end || '.'
      end as mensagem,
      destinatario.id as destinatario_id,
      par.venda_id as _venda_id
    from parcelas par
    -- Só parcelas pendentes COM data definida
    where par.status_base = 'pendente'
      and par.data_vencimento is not null
      -- Janela de interesse: até 3 dias antes do vencimento e qualquer
      -- dia depois (atrasada).
      and par.data_vencimento <= hoje + interval '3 days'
    -- Cruza com a venda pra pegar workspace_id, e com os admins
    -- ATIVOS desse workspace
    cross join lateral (
      select adm.id
      from vendas v_inner
      join profiles adm on adm.workspace_id = v_inner.workspace_id
      where v_inner.id = par.venda_id
        and v_inner.deletado_em is null
        and adm.papel = 'admin'
        and adm.status = 'ativo'
        and adm.deletado_em is null
    ) as destinatario
    -- Dedup intra-dia: pula se já existe notificação dessa parcela
    -- pro mesmo destinatário hoje
    where not exists (
      select 1 from notificacoes n
      where n.entidade_id = par.id
        and n.modulo = 'parcela'
        and n.destinatario_id = destinatario.id
        and n.criado_em >= date_trunc('day', now())
    )
  ) p
  join vendas v on v.id = p._venda_id
  where v.deletado_em is null;
end;
$$;

-- ------------------------------------------------------------
-- Cron — 1x/dia às 09:00 UTC (06:00 BRT, antes do expediente)
-- ------------------------------------------------------------

-- Remove agendamento anterior se existir (idempotente)
select cron.unschedule('gigscontrol-notificar-parcelas')
 where exists (
   select 1 from cron.job where jobname = 'gigscontrol-notificar-parcelas'
 );

select cron.schedule(
  'gigscontrol-notificar-parcelas',
  '0 9 * * *',
  $$ select notificar_parcelas_vencendo(); $$
);

-- Confere
select jobname, schedule, active
  from cron.job
 where jobname = 'gigscontrol-notificar-parcelas';
