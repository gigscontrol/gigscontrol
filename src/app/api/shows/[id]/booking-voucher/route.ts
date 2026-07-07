import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { buscarShow as repoBuscarShow } from "@/lib/repositories/shows.repo";
import { podeEditarAgenda, podeVerAgendaDetalhado } from "@/lib/api/permissoes";
import { uploadVoucher, urlVoucher } from "@/lib/db/storage-vouchers";
import { respostaDeErro } from "@/lib/api/erros";

type RouteCtx = { params: { id: string } };
const MAX_BYTES = 2 * 1024 * 1024; // 2MB (bate com o file_size_limit do bucket vouchers)

/**
 * POST { pdf: base64 } — guarda o voucher do HOTEL no Storage (bucket vouchers)
 * e devolve { path }. O path vai pra shows.meta.booking.voucherPath.
 * Path: "<workspaceId>/booking/<showId>/<uuid>.pdf".
 */
export async function POST(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  const row = await repoBuscarShow(r.sessao.supabase, params.id);
  if (!row) return NextResponse.json({ erro: "Show não encontrado." }, { status: 404 });
  if (!podeEditarAgenda(r.sessao, row.artist_id, row.criado_por)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para editar este show." },
      { status: 403 }
    );
  }

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
    const caminho = `${r.sessao.workspaceId}/booking/${params.id}/${randomUUID()}.pdf`;
    await uploadVoucher(admin, caminho, pdf);
    return NextResponse.json({ path: caminho });
  } catch (e) {
    return respostaDeErro(e, "Falha ao guardar o voucher.");
  }
}

/** GET ?path=... — URL assinada pra baixar (só voucher deste show + gate por artista). */
export async function GET(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  const path = new URL(request.url).searchParams.get("path") ?? "";
  // O path amarra workspace + show: ninguém baixa voucher de outro tenant/show.
  const prefixo = `${r.sessao.workspaceId}/booking/${params.id}/`;
  if (!path || !path.startsWith(prefixo)) {
    return NextResponse.json({ erro: "Voucher não encontrado." }, { status: 404 });
  }
  // Gate: exige agenda.ver_detalhado no artista do show (mesma régua do voucher de voo).
  const row = await repoBuscarShow(r.sessao.supabase, params.id);
  if (!row || !podeVerAgendaDetalhado(r.sessao, row.artist_id)) {
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
    return respostaDeErro(e, "Falha ao baixar o voucher.");
  }
}
