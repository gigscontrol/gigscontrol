import { NextResponse } from "next/server";
import { ipDe, rateLimit } from "@/lib/api/rate-limit";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  reenviarConfirmacao,
  MailerIndisponivelError,
  ExigenciaNaoAtendidaError,
} from "@/lib/services/contratoSignatarios.service";
import { respostaDeErro } from "@/lib/api/erros";

/**
 * POST /api/assinar/[token]/otp — REENVIA o e-mail de confirmação (código de
 * 6 dígitos + botão mágico) de uma assinatura PENDENTE. Código/token novos,
 * prazo renovado (30 min), mesmo pacote de assinatura. Rota PÚBLICA por token.
 */
export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  // 3/min por IP — reenvio legítimo cabe; spam de e-mail (custo + abuso) não.
  const limitado = rateLimit("assinar-otp", ipDe(request), 3, 60_000);
  if (limitado) return limitado;

  try {
    const admin = criarClienteAdmin();
    const r = await reenviarConfirmacao(admin, params.token);
    if (!r) {
      return NextResponse.json(
        {
          erro: "Não há assinatura aguardando confirmação neste link. Assine o contrato para receber o código.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, expiraEm: r.expiraEm });
  } catch (e) {
    if (e instanceof MailerIndisponivelError || e instanceof ExigenciaNaoAtendidaError) {
      return NextResponse.json({ erro: e.message }, { status: e.status });
    }
    return respostaDeErro(e, "Não foi possível reenviar o código.");
  }
}
