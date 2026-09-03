import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  buscarContratoPorId,
  resolverEscopoContrato,
} from "@/lib/services/contratos.service";
import { listarSignatariosDoContrato } from "@/lib/services/contratoSignatarios.service";
import { podeVerContrato } from "@/lib/api/permissoes";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { baixarPdfContrato } from "@/lib/db/storage-pdf";
import { carimbarPdf } from "@/lib/contratos/carimbarPdf";
import { baixarPdfFinal } from "@/lib/services/contratoPdfFinal.service";
import { respostaDeErro } from "@/lib/api/erros";

export const runtime = "nodejs";
export const maxDuration = 30;

type RouteCtx = { params: { id: string } };

/**
 * GET /api/contratos/:id/pdf-assinado — devolve o PDF-fonte CARIMBADO com as
 * assinaturas dos signatários que já assinaram (efêmero: recarimba a cada
 * chamada, determinístico). Só pra contratos por UPLOAD (têm conteudo.pdf).
 */
export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const contrato = await buscarContratoPorId(r.sessao.supabase, params.id);
    if (!contrato)
      return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

    // Gate por artista (via venda). 404 fora do escopo — não vaza existência.
    const { artistId } = await resolverEscopoContrato(r.sessao.supabase, contrato.vendaId);
    if (!podeVerContrato(r.sessao, artistId, contrato.criadoPor))
      return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

    const layout = contrato.conteudo.pdf;
    if (!layout || !layout.path)
      return NextResponse.json({ erro: "Este contrato não é por PDF." }, { status: 400 });

    // Defense-in-depth: só carimba PDF do namespace DESTE workspace.
    if (!layout.path.startsWith(`pdf-fonte/${r.sessao.workspaceId}/`))
      return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

    const admin = criarClienteAdmin();

    // Contrato FINALIZADO (todos assinaram) → serve o PDF SELADO (mig 98):
    // bytes congelados no Storage cujo SHA-256 é o pdf_final_hash publicado na
    // página /verificar. Sela na primeira chamada se ainda não selado.
    if (contrato.status === "assinado") {
      // SEM fallback silencioso: se o selo falhar, o recarimbo efêmero sairia
      // com "Emitido em <hoje>" — bytes que NÃO batem com o pdf_final_hash
      // publicado em /verificar. Melhor falhar visível do que divergir.
      const selado = await baixarPdfFinal(admin, params.id);
      if (selado) {
        return new NextResponse(selado.bytes, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="contrato-${contrato.numero}.pdf"`,
            "Cache-Control": "no-store",
            "X-Documento-Sha256": selado.hash,
          },
        });
      }
      if (contrato.pdfFinalHash) {
        return NextResponse.json(
          { erro: "PDF selado indisponível no momento. Tente novamente em instantes." },
          { status: 503 }
        );
      }
    }

    const original = await baixarPdfContrato(admin, layout.path);
    const signatarios = await listarSignatariosDoContrato(admin, params.id);
    const bytes = await carimbarPdf(
      original,
      layout,
      signatarios.map((s) => ({
        ordem: s.ordem,
        status: s.status,
        assinatura: s.assinatura,
        nome: s.nome,
        papel: s.papel,
        documento: s.documento,
        email: s.email,
        ip: s.ip,
        dispositivo: s.dispositivo,
        geolocalizacao: s.geolocalizacao,
        assinadoEm: s.assinadoEm,
      })),
      {
        numero: contrato.numero,
        verificacaoId: contrato.verificacaoId ?? undefined,
      }
    );
    // Cópia num ArrayBuffer "puro" (o Uint8Array do pdf-lib é ArrayBufferLike,
    // que o tipo de BodyInit recusa).
    const corpo = new Uint8Array(bytes).buffer;

    return new NextResponse(corpo, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="contrato-${contrato.numero}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return respostaDeErro(e, "Falha ao gerar o PDF assinado.");
  }
}
