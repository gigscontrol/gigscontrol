import type { SupabaseClient } from "@supabase/supabase-js";
import { PLANO_IDS, type PlanoId } from "@/lib/planos";

/**
 * Service de CUPONS de "1º mês grátis" (30 dias fixos) num plano específico.
 *
 * Modelo (decisões travadas do checkout custom):
 *  - Cupom concede DIAS FIXOS (`dias_concedidos`, normalmente 30) num
 *    `plano_alvo` específico. Vale nos dois ciclos (mensal/anual); o ciclo só é
 *    gravado no ledger/subscription, não muda os dias.
 *  - Valor 0 nunca passa por gateway (Stripe recusa PaymentIntent de amount 0):
 *    o resgate estende o acesso DIRETO via a RPC `resgatar_cupom`.
 *  - `resgatar_cupom` é ATÔMICA e idempotente-safe: numa transação valida +
 *    incrementa `usos_atuais` + insere `cupom_usos` + chama
 *    `registrar_pagamento_estender` (provider 'cupom'). Chame UMA vez; NÃO
 *    chame `registrarPagamentoEEstenderAcesso` de novo — a RPC já registra o
 *    pagamento internamente.
 *  - Reuso: 1 cupom por workspace na vida (UNIQUE(workspace_id) em cupom_usos).
 *
 * Só o `service_role` (cliente admin) pode chamar a RPC — nunca do browser.
 */

/** Códigos de erro possíveis do resgate/validação (espelham a RPC). */
export type ErroCupom =
  | "codigo_invalido"
  | "inativo"
  | "expirado"
  | "plano_nao_bate"
  | "esgotado"
  | "ja_usado";

/** Resultado de `validarCupom` (pré-validação de leitura, NÃO consome uso). */
export type ValidacaoCupom =
  | { valido: true; planoAlvo: string; dias: number }
  | { valido: false; motivo: ErroCupom };

/** Resultado de `resgatarCupom`. */
export type ResgateCupom =
  | { ok: true; diasConcedidos: number; acessoAte: string | null }
  | { ok: false; erro: ErroCupom };

type CupomRow = {
  codigo: string;
  plano_alvo: string;
  dias_concedidos: number;
  limite_uso: number;
  usos_atuais: number;
  ativo: boolean;
  validade: string | null;
};

/**
 * PRÉ-VALIDA um cupom para o front (leitura pura — NÃO consome uso, NÃO chama a
 * RPC). Consulta a tabela `cupons` e replica as checagens do resgate na MESMA
 * ordem que a RPC (`resgatar_cupom`), pra devolver o mesmo `motivo`:
 *   existe → ativo → validade → plano bate → não esgotado.
 *
 * NÃO checa "já usado" (D4): isso depende do workspace e só é decidido no
 * resgate atômico. A pré-validação serve pra dar feedback do CÓDIGO em si.
 *
 * @returns { valido:true, planoAlvo, dias } | { valido:false, motivo }
 */
export async function validarCupom(
  admin: SupabaseClient,
  params: { codigo: string; plano: string }
): Promise<ValidacaoCupom> {
  const { codigo, plano } = params;

  // Case-insensitive, igual ao resgate (a RPC compara upper(codigo)). `ilike`
  // sem wildcards = igualdade sem diferenciar maiúsc/minúsc; escapa os
  // metacaracteres LIKE (% _ \) pra tratar o código como literal exato.
  const codigoEscapado = codigo.replace(/[\\%_]/g, "\\$&");
  const { data, error } = await admin
    .from("cupons")
    .select("codigo, plano_alvo, dias_concedidos, limite_uso, usos_atuais, ativo, validade")
    .ilike("codigo", codigoEscapado)
    .maybeSingle<CupomRow>();
  if (error) throw error;

  if (!data) return { valido: false, motivo: "codigo_invalido" };
  if (!data.ativo) return { valido: false, motivo: "inativo" };
  if (data.validade && new Date(data.validade).getTime() <= Date.now()) {
    return { valido: false, motivo: "expirado" };
  }
  if (data.plano_alvo !== plano) return { valido: false, motivo: "plano_nao_bate" };
  if (data.usos_atuais >= data.limite_uso) {
    return { valido: false, motivo: "esgotado" };
  }

  return { valido: true, planoAlvo: data.plano_alvo, dias: data.dias_concedidos };
}

/**
 * RESGATA um cupom: chama a RPC atômica `resgatar_cupom` UMA vez. A RPC valida,
 * consome o uso e estende o acesso (via `registrar_pagamento_estender`, provider
 * 'cupom') na mesma transação — nunca consome sem conceder. NÃO chamar
 * `registrarPagamentoEEstenderAcesso` depois: a RPC já registrou o pagamento.
 *
 * @returns { ok:true, diasConcedidos, acessoAte } | { ok:false, erro }
 */
export async function resgatarCupom(
  admin: SupabaseClient,
  params: { codigo: string; workspaceId: string; plano: string; ciclo: string }
): Promise<ResgateCupom> {
  const { codigo, workspaceId, plano, ciclo } = params;

  const { data, error } = await admin.rpc("resgatar_cupom", {
    p_codigo: codigo,
    p_workspace_id: workspaceId,
    p_plano: plano,
    p_ciclo: ciclo,
  });
  if (error) throw error;

  const res = data as {
    ok: boolean;
    erro?: string;
    dias?: number;
    acesso_ate?: string | null;
  };

  if (!res.ok) {
    return { ok: false, erro: (res.erro ?? "codigo_invalido") as ErroCupom };
  }
  return {
    ok: true,
    diasConcedidos: res.dias ?? 0,
    acessoAte: res.acesso_ate ?? null,
  };
}

// ============================================================
// CRUD super-admin (painel) — catálogo de cupons
// ============================================================

/** Erro de negócio do CRUD (código duplicado / plano inválido / limite abaixo do usado). */
export class ErroCupomCrud extends Error {}

export type CupomAdmin = {
  id: string;
  codigo: string;
  planoAlvo: PlanoId;
  diasConcedidos: number;
  limiteUso: number;
  usosAtuais: number;
  ativo: boolean;
  validade: string | null;
  criadoPor: string | null;
  criadoEm: string;
};

type CupomAdminRow = {
  id: string;
  codigo: string;
  plano_alvo: string;
  dias_concedidos: number;
  limite_uso: number;
  usos_atuais: number;
  ativo: boolean;
  validade: string | null;
  criado_por: string | null;
  criado_em: string;
};

function mapCupomAdmin(row: CupomAdminRow): CupomAdmin {
  return {
    id: row.id,
    codigo: row.codigo,
    planoAlvo: row.plano_alvo as PlanoId,
    diasConcedidos: row.dias_concedidos,
    limiteUso: row.limite_uso,
    usosAtuais: row.usos_atuais,
    ativo: row.ativo,
    validade: row.validade,
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
  };
}

/** Lista todos os cupons (catálogo completo) pro painel super-admin, mais recentes primeiro. */
export async function listarCupons(admin: SupabaseClient): Promise<CupomAdmin[]> {
  const { data, error } = await admin
    .from("cupons")
    .select(
      "id, codigo, plano_alvo, dias_concedidos, limite_uso, usos_atuais, ativo, validade, criado_por, criado_em"
    )
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapCupomAdmin(r as CupomAdminRow));
}

/**
 * Cria um cupom novo. Normaliza `codigo` pra UPPER (mesma normalização do
 * resgate/validação, que comparam case-insensitive) e valida:
 *  - `codigo` único (checagem case-insensitive explícita, com mensagem clara —
 *    além da UNIQUE do banco, que também protege contra corrida).
 *  - `planoAlvo` é um dos 6 IDs válidos (`PLANO_IDS`).
 *
 * `dias_concedidos` default 30 (modelo "1º mês grátis"). `criado_por` = id do
 * super-admin autenticado (auditoria).
 */
export async function criarCupom(
  admin: SupabaseClient,
  adminId: string,
  params: {
    codigo: string;
    planoAlvo: string;
    limiteUso: number;
    validade?: string | null;
    diasConcedidos?: number;
  }
): Promise<CupomAdmin> {
  const codigo = params.codigo.trim().toUpperCase();
  if (!codigo) throw new ErroCupomCrud("Código não pode ser vazio.");
  if (!(PLANO_IDS as readonly string[]).includes(params.planoAlvo)) {
    throw new ErroCupomCrud("Plano-alvo inválido.");
  }
  if (!Number.isInteger(params.limiteUso) || params.limiteUso <= 0) {
    throw new ErroCupomCrud("Limite de uso precisa ser um inteiro maior que zero.");
  }

  // Checagem explícita (case-insensitive) pra devolver mensagem clara antes de
  // bater na UNIQUE do banco (que também protege contra corrida concorrente).
  const codigoEscapado = codigo.replace(/[\\%_]/g, "\\$&");
  const { data: existente, error: errBusca } = await admin
    .from("cupons")
    .select("id")
    .ilike("codigo", codigoEscapado)
    .maybeSingle();
  if (errBusca) throw errBusca;
  if (existente) throw new ErroCupomCrud("Já existe um cupom com esse código.");

  const { data, error } = await admin
    .from("cupons")
    .insert({
      codigo,
      plano_alvo: params.planoAlvo,
      dias_concedidos: params.diasConcedidos ?? 30,
      limite_uso: params.limiteUso,
      validade: params.validade ?? null,
      criado_por: adminId,
    })
    .select(
      "id, codigo, plano_alvo, dias_concedidos, limite_uso, usos_atuais, ativo, validade, criado_por, criado_em"
    )
    .single();
  if (error) {
    // Corrida: outro POST criou o mesmo código entre a checagem e o insert.
    if ((error as { code?: string }).code === "23505") {
      throw new ErroCupomCrud("Já existe um cupom com esse código.");
    }
    throw error;
  }
  return mapCupomAdmin(data as CupomAdminRow);
}

/**
 * Altera um cupom existente. SEM hard-delete (desativar via `ativo:false`
 * preserva o histórico/ledger — `cupom_usos` referencia `cupom_id`).
 *
 * `limiteUso` não pode ficar abaixo de `usos_atuais` (perderia rastreio de
 * quantos usos já foram concedidos além do novo limite).
 */
export async function alterarCupom(
  admin: SupabaseClient,
  id: string,
  params: { ativo?: boolean; limiteUso?: number; validade?: string | null }
): Promise<CupomAdmin> {
  const patch: Record<string, unknown> = {};

  if (params.ativo !== undefined) patch.ativo = params.ativo;

  if (params.limiteUso !== undefined) {
    if (!Number.isInteger(params.limiteUso) || params.limiteUso <= 0) {
      throw new ErroCupomCrud("Limite de uso precisa ser um inteiro maior que zero.");
    }
    const { data: atual, error: errAtual } = await admin
      .from("cupons")
      .select("usos_atuais")
      .eq("id", id)
      .maybeSingle<{ usos_atuais: number }>();
    if (errAtual) throw errAtual;
    if (!atual) throw new ErroCupomCrud("Cupom não encontrado.");
    if (params.limiteUso < atual.usos_atuais) {
      throw new ErroCupomCrud(
        `Limite de uso não pode ficar abaixo dos ${atual.usos_atuais} usos já concedidos.`
      );
    }
    patch.limite_uso = params.limiteUso;
  }

  if (params.validade !== undefined) patch.validade = params.validade;

  if (Object.keys(patch).length === 0) {
    throw new ErroCupomCrud("Nada para atualizar.");
  }

  const { data, error } = await admin
    .from("cupons")
    .update(patch)
    .eq("id", id)
    .select(
      "id, codigo, plano_alvo, dias_concedidos, limite_uso, usos_atuais, ativo, validade, criado_por, criado_em"
    )
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ErroCupomCrud("Cupom não encontrado.");
  return mapCupomAdmin(data as CupomAdminRow);
}
