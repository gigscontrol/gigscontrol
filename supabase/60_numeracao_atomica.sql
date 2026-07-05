-- 60: Numeração ATÔMICA de venda/orçamento/contrato.
--
-- PROBLEMA (auditoria): proximoNumeroVenda/Orcamento/Contrato faziam full-scan
-- da tabela + max()+1 em JS, DEPOIS inseriam. Dois creates simultâneos liam o
-- mesmo max → geravam o MESMO número → violação do índice único (falha o 2º).
--
-- CORREÇÃO: contador por (workspace, tipo) + RPC que incrementa e retorna o
-- próximo número numa única operação atômica (o INSERT ... ON CONFLICT DO UPDATE
-- ... RETURNING pega lock da linha, serializando concorrentes). Gaps em rollback
-- são aceitáveis (nunca reaproveita número, igual ao comportamento atual).

create table if not exists public.contadores_numero (
  workspace_id uuid not null,
  tipo text not null,            -- 'venda' | 'orcamento' | 'contrato'
  valor integer not null default 0,
  primary key (workspace_id, tipo)
);
alter table public.contadores_numero enable row level security;
-- Sem policy pra authenticated → default-deny direto; só a RPC (security
-- definer) e o service_role escrevem.

-- Seed a partir do MAIOR sufixo numérico existente (inclui deletados: não
-- reaproveita número). Idempotente (ON CONFLICT DO NOTHING).
insert into public.contadores_numero (workspace_id, tipo, valor)
select workspace_id, 'venda',
  coalesce(max(nullif(regexp_replace(numero, '[^0-9]', '', 'g'), '')::int), 0)
from public.vendas where workspace_id is not null group by workspace_id
on conflict (workspace_id, tipo) do nothing;

insert into public.contadores_numero (workspace_id, tipo, valor)
select workspace_id, 'orcamento',
  coalesce(max(nullif(regexp_replace(numero, '[^0-9]', '', 'g'), '')::int), 0)
from public.orcamentos where workspace_id is not null group by workspace_id
on conflict (workspace_id, tipo) do nothing;

insert into public.contadores_numero (workspace_id, tipo, valor)
select workspace_id, 'contrato',
  coalesce(max(nullif(regexp_replace(numero, '[^0-9]', '', 'g'), '')::int), 0)
from public.contratos where workspace_id is not null group by workspace_id
on conflict (workspace_id, tipo) do nothing;

-- Incrementa atomicamente e devolve o próximo número formatado (ex.: VND-0007).
create or replace function public.proximo_numero(
  p_workspace uuid,
  p_tipo text,
  p_prefixo text
) returns text
  language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  -- Só numera pro próprio workspace (service_role/super liberados) — evita
  -- bumpar o contador de outro tenant.
  if not (
    auth.uid() is null
    or sou_super_admin()
    or p_workspace = (select workspace_id from public.profiles where id = auth.uid())
  ) then
    raise exception 'workspace inválido para numeração';
  end if;

  insert into public.contadores_numero (workspace_id, tipo, valor)
  values (p_workspace, p_tipo, 1)
  on conflict (workspace_id, tipo)
  do update set valor = public.contadores_numero.valor + 1
  returning valor into v;

  return p_prefixo || lpad(v::text, 4, '0');
end $$;
