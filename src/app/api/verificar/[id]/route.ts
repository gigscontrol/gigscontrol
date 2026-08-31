import { NextResponse } from "next/server";
import { ipDe, rateLimit } from "@/lib/api/rate-limit";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { buscarPorVerificacaoId } from "@/lib/repositories/contratos.repo";
import { verificacaoIdValido } from "@/lib/contratos/integridade";
import {
  verificarCadeiaContrato,
  listarEventosContrato,
} from "@/lib/services/contratoEventos.service";
import { assinantesPublicosDoContrato } from "@/lib/services/contratoSignatarios.service";
import { respostaDeErro } from "@/lib/api/erros";

/**
 * GET /api/verificar/[id] — verificação PÚBLICA de autenticidade (mig 98).
 * O `id` é o GC-XXXX-XXXX impresso no contrato/relatório. Devolve o essencial
 * pra qualquer parte conferir: status, hashes (conteúdo + PDF final), quem
 * assinou (documento MASCARADO, sem KYC/IP/geo) e a integridade da cadeia de
 * eventos — recomputada no banco a cada chamada.
 *
 * Rate-limited: ~41 bits de entropia no ID + 20/min tornam enumeração inviável.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const limitado = rateLimit("verificar", ipDe(request), 20, 60_000);
  if (limitado) return limitado;

  const id = params.id.trim().toUpperCase();
  if (!verificacaoIdValido(id)) {
    return NextResponse.json(
      { erro: "Código de verificação inválido. Formato: GC-XXXX-XXXX." },
      { status: 400 }
    );
  }

  try {
    const admin = criarClienteAdmin();
    const row = await buscarPorVerificacaoId(admin, id);
    if (!row) {
      return NextResponse.json(
        { erro: "Nenhum contrato encontrado com este código." },
        { status: 404 }
      );
    }

    const [cadeia, eventos, assinaturas] = await Promise.all([
      verificarCadeiaContrato(row.id),
      listarEventosContrato(row.id),
      assinantesPublicosDoContrato(admin, row.id),
    ]);

    return NextResponse.json({
      verificacaoId: id,
      numero: row.numero,
      status: row.status,
      finalizadoEm: row.finalizado_em ?? null,
      conteudoHash: row.conteudo_hash ?? null,
      conteudoVersao: row.conteudo_versao ?? 1,
      pdfFinalHash: row.pdf_final_hash ?? null,
      // Assinantes SEM a imagem da assinatura nem dispositivo — a página de
      // verificação é mais pública que o link de assinar (o código circula).
      assinaturas: assinaturas.map((a) => ({
        nome: a.nome,
        papel: a.papel,
        documento: a.documento,
        assinadoEm: a.assinadoEm,
      })),
      cadeia,
      // Linha do tempo SANITIZADA: tipo + quando + hash do elo. Sem IP,
      // dispositivo ou detalhes internos.
      eventos: eventos.map((e) => ({
        seq: e.seq,
        tipo: e.tipo,
        criadoEm: e.criadoEm,
        hash: e.hash,
      })),
    });
  } catch (e) {
    return respostaDeErro(e, "Falha ao verificar o contrato.");
  }
}
