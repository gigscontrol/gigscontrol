import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { uploadPdfContrato } from "@/lib/db/storage-pdf";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/contratos/pdf — sobe o PDF-fonte de um contrato por UPLOAD.
 * Recebe FormData { file }. Lê nº de páginas + dimensões (pt) com pdf-lib,
 * guarda em `assinaturas/pdf-fonte/<workspaceId>/<uuid>/original.pdf` e devolve
 * { path, nome, paginas, dims } — o cliente monta o layout e cria o contrato
 * com esse path dentro de corpo_preenchido.pdf. O gate real é na criação do
 * contrato; aqui basta acesso ativo (upload no namespace do próprio workspace).
 */
export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ erro: "Envio inválido (não é FormData)." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ erro: "Campo 'file' não encontrado." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { erro: "Só PDF. Converta o Word/Google Docs em PDF antes de enviar." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ erro: "PDF maior que 10 MB." }, { status: 400 });
  }

  const buf = await file.arrayBuffer();

  // Lê páginas + dimensões. ignoreEncryption pra abrir PDFs com senha-de-dono
  // (leitura livre); se nem assim abrir, é inválido/corrompido.
  let paginas: number;
  let dims: { w: number; h: number }[];
  try {
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    paginas = doc.getPageCount();
    dims = doc.getPages().map((p) => {
      const { width, height } = p.getSize();
      return { w: width, h: height };
    });
    if (paginas < 1) throw new Error("PDF sem páginas.");
  } catch {
    return NextResponse.json(
      { erro: "Não consegui ler este PDF (protegido ou corrompido)." },
      { status: 400 }
    );
  }

  const admin = criarClienteAdmin();
  const path = `pdf-fonte/${r.sessao.workspaceId}/${randomUUID()}/original.pdf`;
  try {
    await uploadPdfContrato(admin, path, buf);
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao guardar o PDF." },
      { status: 500 }
    );
  }

  const nome = file.name || "documento.pdf";
  return NextResponse.json({ path, nome, paginas, dims });
}
