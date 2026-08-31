import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buscarContrato,
  atualizarContrato,
} from "@/lib/repositories/contratos.repo";
import { rowParaContrato } from "@/lib/mappers/contrato";
import { listarPorContrato } from "@/lib/repositories/contratoSignatarios.repo";
import { rowParaSignatario } from "@/lib/mappers/contratoSignatario";
import { baixarPdfContrato, uploadPdfContrato } from "@/lib/db/storage-pdf";
import { carimbarPdf } from "@/lib/contratos/carimbarPdf";
import { sha256Hex } from "@/lib/contratos/integridade";
import { registrarEventoContrato } from "@/lib/services/contratoEventos.service";

/**
 * PDF FINAL IMUTÁVEL (mig 98 — pilar de integridade).
 *
 * Quando TODOS assinam um contrato POR UPLOAD, o PDF carimbado (assinaturas +
 * relatório) é gerado UMA vez, o SHA-256 dos bytes vai pra
 * contratos.pdf_final_hash e o arquivo congela no Storage
 * (`pdf-final/<workspace>/<contrato>.pdf`). Depois disso, todo download serve
 * ESSES bytes — nunca recarimba — então o hash publicado na página /verificar
 * bate byte a byte com o arquivo que as partes guardaram.
 *
 * Contratos DE MODELO não têm PDF-fonte: a âncora de integridade deles é o
 * conteudo_hash (hash do corpo canônico), também publicado na verificação.
 *
 * Idempotente: se já selado, devolve o selo existente sem regravar.
 */
export async function selarPdfFinal(
  admin: SupabaseClient,
  contratoId: string
): Promise<{ hash: string; path: string } | null> {
  const row = await buscarContrato(admin, contratoId);
  if (!row) return null;
  if (row.pdf_final_hash && row.pdf_final_path) {
    return { hash: row.pdf_final_hash, path: row.pdf_final_path };
  }
  const contrato = rowParaContrato(row);
  const layout = contrato.conteudo.pdf;
  if (!layout?.path) return null; // contrato de modelo — sem PDF-fonte
  if (contrato.status !== "assinado") return null; // só sela quando todos assinaram

  const original = await baixarPdfContrato(admin, layout.path);
  const signatarios = (await listarPorContrato(admin, contratoId)).map(
    rowParaSignatario
  );
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
    { numero: contrato.numero, verificacaoId: contrato.verificacaoId ?? undefined }
  );

  const hash = sha256Hex(bytes);
  const path = `pdf-final/${row.workspace_id}/${row.id}.pdf`;
  await uploadPdfContrato(admin, path, Buffer.from(bytes));
  await atualizarContrato(admin, contratoId, {
    pdf_final_hash: hash,
    pdf_final_path: path,
  });
  await registrarEventoContrato({
    contratoId,
    workspaceId: row.workspace_id,
    tipo: "pdf_final_gerado",
    detalhes: { hash, path, bytes: bytes.length },
  });
  return { hash, path };
}

/**
 * Bytes do PDF final SELADO (pra rota de download servir sempre o mesmo
 * arquivo do hash publicado). Sela na primeira chamada se ainda não selado.
 * null = contrato de modelo ou ainda não finalizado (caller recarimba efêmero).
 */
export async function baixarPdfFinal(
  admin: SupabaseClient,
  contratoId: string
): Promise<{ bytes: ArrayBuffer; hash: string } | null> {
  const selo = await selarPdfFinal(admin, contratoId);
  if (!selo) return null;
  const bytes = await baixarPdfContrato(admin, selo.path);
  return { bytes, hash: selo.hash };
}
