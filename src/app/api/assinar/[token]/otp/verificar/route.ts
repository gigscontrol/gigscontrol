import { NextResponse } from "next/server";
import { ipDe, rateLimit } from "@/lib/api/rate-limit";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  buscarPorToken,
  consumirTentativaOtp,
} from "@/lib/repositories/contratoSignatarios.repo";
import { otpConfere, OTP_MAX_TENTATIVAS } from "@/lib/contratos/integridade";
import { otpVerificarSchema } from "@/lib/validators/contratoSignatarios.schema";
import {
  confirmarAssinaturaPendente,
  ConfirmacaoExpiradaError,
  ContratoCanceladoError,
} from "@/lib/services/contratoSignatarios.service";
import { respostaDeErro } from "@/lib/api/erros";

/**
 * POST /api/assinar/[token]/otp/verificar — confere o código de 6 dígitos e,
 * batendo, CONFIRMA a assinatura pendente (ela só conta como assinada aqui).
 * Comparação em tempo constante; máx. 5 tentativas por código; prazo de
 * 30 min — vencido, o staging é limpo e a pessoa assina de novo no mesmo link.
 */
export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  const limitado = rateLimit("assinar-otp-verificar", ipDe(request), 10, 60_000);
  if (limitado) return limitado;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = otpVerificarSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Informe o código de 6 dígitos." },
      { status: 400 }
    );
  }

  try {
    const admin = criarClienteAdmin();
    const sigRow = await buscarPorToken(admin, params.token);
    if (!sigRow) {
      return NextResponse.json({ erro: "Link inválido." }, { status: 404 });
    }
    if (sigRow.status === "assinado") {
      return NextResponse.json({ ok: true, assinado: true });
    }
    if (!sigRow.pendente_payload || !sigRow.otp_hash) {
      return NextResponse.json(
        { erro: "Não há assinatura aguardando confirmação. Assine o contrato primeiro." },
        { status: 400 }
      );
    }
    const tentativas = sigRow.otp_tentativas ?? 0;
    if (tentativas >= OTP_MAX_TENTATIVAS) {
      return NextResponse.json(
        { erro: "Muitas tentativas. Peça um novo código." },
        { status: 429 }
      );
    }

    // Consome a tentativa ANTES de comparar, com compare-and-swap: sob
    // requisições paralelas só uma vence a escrita — o teto de 5 deixa de ser
    // contornável por concorrência (o rate limit em memória é por instância e
    // não segura flood em serverless).
    const consumiu = await consumirTentativaOtp(admin, params.token, tentativas);
    if (!consumiu) {
      return NextResponse.json(
        { erro: "Não foi possível validar agora. Tente novamente." },
        { status: 429 }
      );
    }

    if (!otpConfere(params.token, parsed.data.codigo, sigRow.otp_hash)) {
      const restantes = OTP_MAX_TENTATIVAS - tentativas - 1;
      return NextResponse.json(
        {
          erro:
            restantes > 0
              ? `Código incorreto. ${restantes} tentativa${restantes === 1 ? "" : "s"} restante${restantes === 1 ? "" : "s"}.`
              : "Código incorreto. Peça um novo código.",
        },
        { status: 400 }
      );
    }

    const signatario = await confirmarAssinaturaPendente(admin, sigRow, "codigo");
    if (!signatario) {
      return NextResponse.json(
        { erro: "Este link já foi assinado ou é inválido." },
        { status: 409 }
      );
    }
    return NextResponse.json({
      ok: true,
      assinado: true,
      assinadoEm: signatario.assinadoEm,
    });
  } catch (e) {
    if (e instanceof ConfirmacaoExpiradaError) {
      return NextResponse.json({ erro: e.message, expirado: true }, { status: e.status });
    }
    if (e instanceof ContratoCanceladoError) {
      return NextResponse.json({ erro: e.message, cancelado: true }, { status: e.status });
    }
    return respostaDeErro(e, "Não foi possível verificar o código.");
  }
}
