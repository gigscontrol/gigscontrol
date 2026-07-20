import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { PLANO_IDS } from "@/lib/planos";
import { respostaDeErro } from "@/lib/api/erros";
import {
  validarCupom,
  resgatarCupom,
  type ErroCupom,
} from "@/lib/services/cupons.service";

/**
 * POST /api/checkout/cupom
 *
 * Caminho SEM gateway pro cupom de "1º mês grátis" (valor 0 — Stripe recusa
 * PaymentIntent de amount 0). Duas ações num só endpoint:
 *
 *  - `acao: 'validar'` → pré-valida o CÓDIGO (leitura, NÃO consome uso). Devolve
 *    { valido, motivo?, planoAlvo?, dias? }. Usado pelo front pra dar feedback
 *    antes de confirmar.
 *  - `acao: 'resgatar'` → chama a RPC atômica `resgatar_cupom` UMA vez: valida,
 *    consome o uso e ESTENDE o acesso (provider 'cupom' no ledger) na mesma
 *    transação. Devolve { ok:true, diasConcedidos, acessoAte } ou 4xx com erro.
 *
 * Auth = MESMO gate do /api/checkout/stripe: só admin, e SEM exigir acesso já
 * válido (o objetivo é CONCEDER acesso a quem ainda não tem).
 *
 * Body: { acao, codigo, plano, ciclo? }
 */

export const runtime = "nodejs";

const schema = z.object({
  acao: z.enum(["validar", "resgatar"]),
  codigo: z.string().trim().min(1).max(64),
  plano: z.enum(PLANO_IDS),
  ciclo: z.enum(["mensal", "anual"]).default("mensal"),
});

/** Erro tipado da RPC → { status, mensagem } claro pro cliente. */
const ERRO_HTTP: Record<ErroCupom, { status: number; mensagem: string }> = {
  codigo_invalido: { status: 404, mensagem: "Cupom não encontrado." },
  inativo: { status: 400, mensagem: "Este cupom não está mais ativo." },
  expirado: { status: 400, mensagem: "Este cupom expirou." },
  plano_nao_bate: {
    status: 400,
    mensagem: "Este cupom não vale para o plano escolhido.",
  },
  esgotado: { status: 400, mensagem: "Este cupom já atingiu o limite de uso." },
  ja_usado: {
    status: 409,
    mensagem: "Você já resgatou um cupom nesta conta.",
  },
};

function respostaErroCupom(erro: ErroCupom): NextResponse {
  const { status, mensagem } = ERRO_HTTP[erro];
  return NextResponse.json({ erro: mensagem, codigo: erro }, { status });
}

export async function POST(request: Request) {
  // Mesmo gate do /api/checkout/stripe: NÃO exige acesso já válido (concede acesso).
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode resgatar cupom." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Plano, ciclo ou código inválido." },
      { status: 400 }
    );
  }
  const { acao, codigo, plano, ciclo } = parsed.data;
  const workspaceId = r.sessao.workspaceId;
  const admin = criarClienteAdmin();

  try {
    if (acao === "validar") {
      const res = await validarCupom(admin, { codigo, plano });
      if (!res.valido) {
        return NextResponse.json(
          { valido: false, codigo: res.motivo, erro: ERRO_HTTP[res.motivo].mensagem },
          { status: 200 }
        );
      }
      return NextResponse.json({
        valido: true,
        planoAlvo: res.planoAlvo,
        dias: res.dias,
      });
    }

    // acao === 'resgatar' → RPC atômica UMA vez (valida + consome + estende).
    const res = await resgatarCupom(admin, { codigo, workspaceId, plano, ciclo });
    if (!res.ok) return respostaErroCupom(res.erro);

    // RECONCILIA workspaces.plano com o plano concedido — como o Stripe/MP.
    // Sem isto, os limites (que leem workspaces.plano) ficavam no tier semeado
    // no signup, não no que o cupom liberou. O cupom já validou plano_alvo.
    await admin
      .from("workspaces")
      .update({ plano, ciclo, status: "ativa" })
      .eq("id", workspaceId);

    return NextResponse.json({
      ok: true,
      diasConcedidos: res.diasConcedidos,
      acessoAte: res.acessoAte,
    });
  } catch (e) {
    return respostaDeErro(e, "Falha ao resgatar o cupom.");
  }
}
