import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParcelaMeta } from "@/types";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { podeInformarPagamentoParcela, podeVerFinanceiro } from "@/lib/api/permissoes";
import { buscarParcela } from "@/lib/repositories/parcelas.repo";
import { buscarVenda } from "@/lib/repositories/vendas.repo";
import { vendaVisivelParaSessao } from "@/lib/services/vendas.service";

const BUCKET = "comprovantes";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Resolve a parcela + a venda (pro gate por artista) ou devolve 404/venda-null. */
async function carregar(supabase: SupabaseClient, id: string) {
  const parcela = await buscarParcela(supabase, id);
  if (!parcela) return { erro: 404 as const };
  const venda = await buscarVenda(supabase, parcela.venda_id);
  if (!venda) return { erro: 404 as const };
  return { parcela, venda };
}

/**
 * POST /api/parcelas/:id/comprovante — sobe o comprovante de pagamento
 * (JPG/PNG/WEBP/PDF) no bucket privado e grava o path na meta da parcela.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  const c = await carregar(r.sessao.supabase, params.id);
  if ("erro" in c)
    return NextResponse.json({ erro: "Parcela não encontrada." }, { status: 404 });
  const bloqueio = podeInformarPagamentoParcela(r.sessao, c.venda.artist_id, "registrar");
  if (bloqueio) return bloqueio;

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
  const ext = TIPOS[file.type];
  if (!ext) {
    return NextResponse.json(
      { erro: "Formato inválido. Use JPG, PNG, WEBP ou PDF." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ erro: "Arquivo maior que 5 MB." }, { status: 400 });
  }

  const admin = criarClienteAdmin();
  const path = `${r.sessao.workspaceId}/${params.id}/comprovante-${Date.now()}.${ext}`;
  const buf = await file.arrayBuffer();
  const { error: errUp } = await admin.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: false });
  if (errUp) {
    return NextResponse.json({ erro: `Falha no upload: ${errUp.message}` }, { status: 500 });
  }

  // Apaga o comprovante anterior (best-effort).
  const anterior = c.parcela.meta?.pagamento?.comprovantePath;
  if (anterior && anterior !== path) {
    await admin.storage.from(BUCKET).remove([anterior]).catch(() => undefined);
  }

  // Grava o path via a MESMA RPC atômica do PATCH (merge_parcela_meta): o
  // `||` no banco troca só a chave top-level `pagamento`, preservando
  // `cobrancas`/`cancelamento` que um PATCH concorrente tenha adicionado. Antes
  // esta rota fazia read-modify-write do meta INTEIRO e clobberava a alteração
  // concorrente. (RLS security-invoker → escopo do tenant continua valendo.)
  const metaAtual: ParcelaMeta = c.parcela.meta ?? {};
  try {
    const { error } = await r.sessao.supabase.rpc("merge_parcela_meta", {
      p_id: params.id,
      p_patch: {
        pagamento: { ...(metaAtual.pagamento ?? {}), comprovantePath: path },
      },
      p_remove: null,
      p_cobranca: null,
    });
    if (error) throw error;
  } catch (e) {
    // Se gravar o path na parcela falhar, apaga o objeto recém-subido pra não
    // deixar comprovante (PII bancária) órfão no bucket privado.
    await admin.storage.from(BUCKET).remove([path]).catch(() => undefined);
    throw e;
  }

  return NextResponse.json({ ok: true, path });
}

/**
 * GET /api/parcelas/:id/comprovante — URL assinada (temporária) do comprovante,
 * pra exibir/baixar. Só quem enxerga a venda (escopo) recebe.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  const c = await carregar(r.sessao.supabase, params.id);
  if ("erro" in c)
    return NextResponse.json({ erro: "Parcela não encontrada." }, { status: 404 });
  if (!(await vendaVisivelParaSessao(r.sessao.supabase, r.sessao, c.venda.id)))
    return NextResponse.json({ erro: "Parcela não encontrada." }, { status: 404 });
  // Comprovante = documento bancário sensível: além de enxergar a venda, exige
  // autorização de VER o financeiro deste artista (privacidade/financeiro.ver).
  if (!podeVerFinanceiro(r.sessao, c.venda.artist_id))
    return NextResponse.json(
      { erro: "Sem permissão para ver o financeiro deste artista." },
      { status: 403 }
    );

  const path = c.parcela.meta?.pagamento?.comprovantePath;
  if (!path) return NextResponse.json({ url: null });
  // Defense-in-depth: só assina paths namespaceados por ESTE workspace + parcela.
  // O upload sempre grava `${workspaceId}/${id}/…`; recusar qualquer outro path
  // impede que uma meta injetada/corrompida vaze comprovante de outro tenant.
  const prefixo = `${r.sessao.workspaceId}/${params.id}/`;
  if (!path.startsWith(prefixo)) return NextResponse.json({ url: null });
  const admin = criarClienteAdmin();
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, 300);
  return NextResponse.json({ url: data?.signedUrl ?? null });
}
