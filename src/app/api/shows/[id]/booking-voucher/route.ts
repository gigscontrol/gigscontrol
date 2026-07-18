import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  buscarShow as repoBuscarShow,
  contarBookingVouchersDesde,
} from "@/lib/repositories/shows.repo";
import { podeEditarShow, podeVerAgendaDetalhado } from "@/lib/api/permissoes";
import { uploadVoucher, urlVoucher } from "@/lib/db/storage-vouchers";
import { janelaDoCicloISO } from "@/lib/services/cicloLimite";
import { getPlano, type PlanoId } from "@/lib/planos";
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
  // L5b: gravar o booking ALTERA O SHOW → chave de VENDAS (par de
  // VendaDetalhe.tsx `podeEditarBooking`). Não é mais `agenda.editar*`.
  if (!podeEditarShow(r.sessao, row.artist_id, row.criado_por)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para editar este show." },
      { status: 403 }
    );
  }
  // Booking tem PII de hospedagem → gerenciar o voucher exige ver_detalhado
  // (mesma régua do download), ALÉM da chave de edição de venda.
  if (!podeVerAgendaDetalhado(r.sessao, row.artist_id)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para gerenciar a hospedagem deste show." },
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

  // Cota PRÓPRIA de vouchers de hospedagem no ciclo (separada da aérea; bloqueia,
  // sem excedente pago). Falha na contagem → não bloqueia o upload.
  try {
    const { data: ws } = await r.sessao.supabase
      .from("workspaces")
      .select("plano")
      .eq("id", r.sessao.workspaceId)
      .single();
    const plano = getPlano((ws?.plano ?? "individual") as PlanoId);
    const usados = await contarBookingVouchersDesde(
      r.sessao.supabase,
      r.sessao.workspaceId,
      await janelaDoCicloISO(r.sessao.workspaceId)
    );
    if (usados >= plano.maxVouchersMes) {
      return NextResponse.json(
        {
          erro: `Limite de ${plano.maxVouchersMes} vouchers de hospedagem no ciclo atingido no plano ${plano.nome}. Faça upgrade ou aguarde a virada do plano.`,
        },
        { status: 409 }
      );
    }
  } catch {
    /* se a contagem falhar, não bloqueia o upload */
  }

  try {
    const admin = criarClienteAdmin();
    // Path determinístico por show: "Trocar voucher" sobrescreve o mesmo objeto
    // (upsert) em vez de deixar o PDF antigo órfão no bucket.
    const caminho = `${r.sessao.workspaceId}/booking/${params.id}/voucher.pdf`;
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
