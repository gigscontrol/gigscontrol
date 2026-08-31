import { NextResponse } from "next/server";
import { ipDe, rateLimit } from "@/lib/api/rate-limit";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  buscarPorToken,
  atualizarPorToken,
} from "@/lib/repositories/contratoSignatarios.repo";
import { buscarContrato } from "@/lib/repositories/contratos.repo";
import { exigeValido } from "@/lib/mappers/contratoSignatario";
import {
  gerarCodigoOtp,
  hashOtp,
  OTP_VALIDADE_MIN,
} from "@/lib/contratos/integridade";
import { mailerConfigurado, enviarEmail } from "@/lib/mailer";
import { registrarEventoContrato } from "@/lib/services/contratoEventos.service";
import { respostaDeErro } from "@/lib/api/erros";

/**
 * POST /api/assinar/[token]/otp — envia o código OTP de 6 dígitos pro e-mail
 * do signatário (exigência `otpEmail` da mig 98). Rota PÚBLICA por token.
 * O código nunca persiste em claro: só o hash (salgado com o token) vai pro
 * banco, com validade de 10 minutos e contador de tentativas zerado.
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
    const exige = exigeValido(sigRow.exige);
    if (!exige.otpEmail) {
      return NextResponse.json(
        { erro: "Este signatário não usa verificação por e-mail." },
        { status: 400 }
      );
    }
    if (!sigRow.email) {
      return NextResponse.json(
        { erro: "Signatário sem e-mail cadastrado. Fale com a agência." },
        { status: 400 }
      );
    }
    const contrato = await buscarContrato(admin, sigRow.contrato_id);
    if (contrato?.status === "cancelado") {
      return NextResponse.json(
        { erro: "Este contrato foi cancelado pela agência.", cancelado: true },
        { status: 409 }
      );
    }
    if (!mailerConfigurado()) {
      return NextResponse.json(
        {
          erro: "O envio de e-mail ainda não está configurado. Avise a agência para concluir a assinatura de outra forma.",
        },
        { status: 503 }
      );
    }

    const codigo = gerarCodigoOtp();
    const expiraEm = new Date(
      Date.now() + OTP_VALIDADE_MIN * 60_000
    ).toISOString();
    await atualizarPorToken(admin, params.token, {
      otp_hash: hashOtp(params.token, codigo),
      otp_expira_em: expiraEm,
      otp_tentativas: 0,
      otp_verificado_em: null,
    });

    const numero = contrato?.numero ?? "";
    await enviarEmail({
      para: sigRow.email,
      assunto: `Seu código de verificação${numero ? ` — contrato ${numero}` : ""}`,
      texto: [
        `Olá, ${sigRow.nome}!`,
        "",
        `Seu código para assinar o contrato${numero ? ` ${numero}` : ""} é:`,
        "",
        `    ${codigo}`,
        "",
        `Ele vale por ${OTP_VALIDADE_MIN} minutos. Se você não pediu este código, ignore este e-mail.`,
        "",
        "GIGS CONTROL",
      ].join("\n"),
    });

    await registrarEventoContrato({
      contratoId: sigRow.contrato_id,
      workspaceId: sigRow.workspace_id,
      signatarioId: sigRow.id,
      tipo: "otp_enviado",
      detalhes: { email: sigRow.email.replace(/^(..).*(@.*)$/, "$1***$2") },
      ip: ipDe(request),
      dispositivo: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, expiraEm });
  } catch (e) {
    return respostaDeErro(e, "Não foi possível enviar o código.");
  }
}
