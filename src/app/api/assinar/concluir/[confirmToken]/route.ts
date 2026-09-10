import { NextResponse } from "next/server";
import { ipDe, rateLimit } from "@/lib/api/rate-limit";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { buscarPorConfirmTokenHash } from "@/lib/repositories/contratoSignatarios.repo";
import { hashTokenConfirmacao } from "@/lib/contratos/integridade";
import {
  confirmarAssinaturaPendente,
  ConfirmacaoExpiradaError,
  ContratoCanceladoError,
} from "@/lib/services/contratoSignatarios.service";
import { respostaDeErro } from "@/lib/api/erros";

/**
 * POST /api/assinar/concluir/[confirmToken] — BOTÃO MÁGICO do e-mail: conclui
 * a assinatura pendente sem digitar o código (a posse do link do e-mail é a
 * prova de posse da caixa). Mesmo prazo de 30 min do código; vencido, limpa o
 * staging e orienta a assinar de novo pelo link original.
 */
export async function POST(
  request: Request,
  { params }: { params: { confirmToken: string } }
) {
  const limitado = rateLimit("assinar-concluir", ipDe(request), 10, 60_000);
  if (limitado) return limitado;

  try {
    const admin = criarClienteAdmin();
    const sigRow = await buscarPorConfirmTokenHash(
      admin,
      hashTokenConfirmacao(params.confirmToken)
    );
    if (!sigRow || !sigRow.pendente_payload) {
      return NextResponse.json(
        {
          erro: "Este link de confirmação não é mais válido. Abra o link do contrato e assine novamente.",
          expirado: true,
        },
        { status: 410 }
      );
    }
    if (sigRow.status === "assinado") {
      return NextResponse.json({ ok: true, assinado: true, token: sigRow.token });
    }

    const signatario = await confirmarAssinaturaPendente(admin, sigRow, "botao");
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
      // Token do LINK DE ASSINATURA — a página de sucesso oferece "ver o
      // contrato" (quem clicou o botão já é o dono do e-mail do signatário).
      token: sigRow.token,
    });
  } catch (e) {
    if (e instanceof ConfirmacaoExpiradaError) {
      return NextResponse.json({ erro: e.message, expirado: true }, { status: e.status });
    }
    if (e instanceof ContratoCanceladoError) {
      return NextResponse.json({ erro: e.message, cancelado: true }, { status: e.status });
    }
    return respostaDeErro(e, "Não foi possível concluir a assinatura.");
  }
}
