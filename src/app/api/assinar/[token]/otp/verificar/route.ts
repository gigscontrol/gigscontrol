import { NextResponse } from "next/server";
import { ipDe, rateLimit } from "@/lib/api/rate-limit";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  buscarPorToken,
  atualizarPorToken,
} from "@/lib/repositories/contratoSignatarios.repo";
import { otpConfere, OTP_MAX_TENTATIVAS } from "@/lib/contratos/integridade";
import { otpVerificarSchema } from "@/lib/validators/contratoSignatarios.schema";
import { registrarEventoContrato } from "@/lib/services/contratoEventos.service";
import { respostaDeErro } from "@/lib/api/erros";

/**
 * POST /api/assinar/[token]/otp/verificar — confere o código OTP digitado.
 * Comparação em tempo constante contra o hash gravado; máx. 5 tentativas por
 * código (depois exige reenvio); expiração de 10 min. Sucesso grava
 * otp_verificado_em — o gate server-side que `registrarAssinatura` exige.
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
      return NextResponse.json(
        { erro: "Este link já foi assinado." },
        { status: 409 }
      );
    }
    if (!sigRow.otp_hash) {
      return NextResponse.json(
        { erro: "Nenhum código ativo. Toque em “Enviar código” primeiro." },
        { status: 400 }
      );
    }
    if (sigRow.otp_expira_em && new Date(sigRow.otp_expira_em) < new Date()) {
      return NextResponse.json(
        { erro: "Código expirado. Peça um novo." },
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

    if (!otpConfere(params.token, parsed.data.codigo, sigRow.otp_hash)) {
      await atualizarPorToken(admin, params.token, {
        otp_tentativas: tentativas + 1,
      });
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

    // Confere → marca verificado e descarta o hash (código de uso único).
    await atualizarPorToken(admin, params.token, {
      otp_verificado_em: new Date().toISOString(),
      metodo_autenticacao: "email_otp",
      otp_hash: null,
      otp_expira_em: null,
    });
    await registrarEventoContrato({
      contratoId: sigRow.contrato_id,
      workspaceId: sigRow.workspace_id,
      signatarioId: sigRow.id,
      tipo: "otp_verificado",
      detalhes: {},
      ip: ipDe(request),
      dispositivo: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e, "Não foi possível verificar o código.");
  }
}
