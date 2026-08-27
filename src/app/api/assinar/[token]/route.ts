import { NextResponse } from "next/server";
import { ipDe, rateLimit } from "@/lib/api/rate-limit";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  buscarParaAssinar,
  registrarAssinatura,
  registrarAbertura,
  assinantesPublicosDoContrato,
  ExigenciaNaoAtendidaError,
} from "@/lib/services/contratoSignatarios.service";
import { assinarSchema } from "@/lib/validators/contratoSignatarios.schema";
import { respostaDeErro } from "@/lib/api/erros";

/**
 * Rota PÚBLICA (sem login) da página de assinatura. O `token` é a
 * credencial — usa o client admin (service-role) só pra ler/escrever o
 * signatário daquele token. Só expõe o necessário pra esta pessoa.
 */

function ipDaRequest(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const admin = criarClienteAdmin();
    const r = await buscarParaAssinar(admin, params.token);
    if (!r) {
      return NextResponse.json({ erro: "Link inválido." }, { status: 404 });
    }
    const { signatario, contrato } = r;
    // Contrato CANCELADO pela agência (D4): quem ainda NÃO assinou é barrado —
    // nem exibe o documento. Quem já assinou continua podendo visualizar o que
    // assinou (a assinatura dele permanece válida).
    if (contrato.status === "cancelado" && signatario.status !== "assinado") {
      return NextResponse.json(
        { erro: "Este contrato foi cancelado pela agência.", cancelado: true },
        { status: 409 }
      );
    }
    // Conta a abertura do link (visualização) — só se ainda não assinou.
    // Fire-and-forget pra não atrasar a resposta.
    void registrarAbertura(admin, signatario).catch(() => {});
    // Quem já assinou (do MESMO contrato) → relatório de assinaturas visível
    // no link, padrão ZapSign. Sem KYC (foto/selfie/facial) — só o relatório.
    const assinaturas = await assinantesPublicosDoContrato(admin, contrato.id);
    return NextResponse.json({
      signatario: {
        nome: signatario.nome,
        email: signatario.email,
        papel: signatario.papel,
        exige: signatario.exige,
        status: signatario.status,
        assinatura: signatario.assinatura,
        documento: signatario.documento,
        assinadoEm: signatario.assinadoEm,
      },
      contrato: { numero: contrato.numero, conteudo: contrato.conteudo },
      assinaturas,
      jaAssinou: signatario.status === "assinado",
    });
  } catch (e) {
    return respostaDeErro(e, "Erro ao abrir o documento.");
  }
}

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  // Rota PÚBLICA por token (auditoria 27/08/2026): sem freio, um link vazado
  // permitia gravar blobs de foto indefinidamente. 10/min por IP.
  const limitado = rateLimit("assinar", ipDe(request), 10, 60_000);
  if (limitado) return limitado;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = assinarSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const admin = criarClienteAdmin();
    // Contrato CANCELADO não pode ser assinado (D4) — barra antes de qualquer
    // escrita/upload. (Race entre abrir e assinar: a agência pode ter cancelado
    // nesse meio-tempo.) Quem já assinou cai no null de registrarAssinatura.
    const alvo = await buscarParaAssinar(admin, params.token);
    if (!alvo) {
      return NextResponse.json({ erro: "Link inválido." }, { status: 404 });
    }
    if (
      alvo.contrato.status === "cancelado" &&
      alvo.signatario.status !== "assinado"
    ) {
      return NextResponse.json(
        { erro: "Este contrato foi cancelado pela agência.", cancelado: true },
        { status: 409 }
      );
    }
    const sig = await registrarAssinatura(admin, params.token, {
      assinatura: parsed.data.assinatura,
      documento: parsed.data.documento || null,
      ip: ipDaRequest(request),
      dispositivo: request.headers.get("user-agent"),
      geolocalizacao: parsed.data.geolocalizacao || null,
      fotoCpf: parsed.data.fotoCpf || null,
      fotoDocumento: parsed.data.fotoDocumento || null,
      fotoDocumentoVerso: parsed.data.fotoDocumentoVerso || null,
      selfie: parsed.data.selfie || null,
    });
    if (!sig) {
      return NextResponse.json(
        { erro: "Este link já foi assinado ou é inválido." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, assinadoEm: sig.assinadoEm });
  } catch (e) {
    if (e instanceof ExigenciaNaoAtendidaError) {
      return NextResponse.json({ erro: e.message }, { status: e.status });
    }
    return respostaDeErro(e, "Erro ao registrar a assinatura.");
  }
}
