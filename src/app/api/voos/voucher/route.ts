import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { uploadVoucher, urlVoucher } from "@/lib/db/storage-vouchers";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB

/**
 * POST { pdf: base64 } — guarda o PDF do voucher no Storage e devolve { path }.
 * O path (ex: "<workspaceId>/<uuid>.pdf") vai pra dados.voucherPath do item.
 */
export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  let body: { pdf?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const pdf = (body.pdf ?? "").replace(/^data:application\/pdf;base64,/, "");
  if (!pdf) return NextResponse.json({ erro: "Envie o PDF." }, { status: 400 });
  if (Buffer.byteLength(pdf, "base64") > MAX_BYTES) {
    return NextResponse.json({ erro: "Voucher acima de 2MB." }, { status: 413 });
  }

  try {
    const admin = criarClienteAdmin();
    const caminho = `${r.sessao.workspaceId}/${randomUUID()}.pdf`;
    await uploadVoucher(admin, caminho, pdf);
    return NextResponse.json({ path: caminho });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao guardar o voucher." },
      { status: 500 }
    );
  }
}

/** GET ?path=... — URL assinada pra baixar (só vouchers do próprio workspace). */
export async function GET(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  const path = new URL(request.url).searchParams.get("path") ?? "";
  // Segurança: o path começa com o id do workspace — só baixa o que é seu.
  if (!path || !path.startsWith(`${r.sessao.workspaceId}/`)) {
    return NextResponse.json({ erro: "Voucher não encontrado." }, { status: 404 });
  }
  try {
    const admin = criarClienteAdmin();
    const url = await urlVoucher(admin, path);
    if (!url) {
      return NextResponse.json({ erro: "Falha ao gerar o link." }, { status: 500 });
    }
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao baixar." },
      { status: 500 }
    );
  }
}
