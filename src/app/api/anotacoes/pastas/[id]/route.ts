import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  atualizarPastaPorId,
  removerPastaPorId,
} from "@/lib/services/anotacoes.service";
import { pastaUpdateSchema } from "@/lib/validators/anotacoes.schema";
import { buscarPasta } from "@/lib/repositories/anotacoes.repo";
import { podeGerirPasta } from "@/lib/api/permissoes";
import { respostaDeErro } from "@/lib/api/erros";

type RouteCtx = { params: { id: string } };

/** PATCH /api/anotacoes/pastas/:id — renomear / cor / visibilidade (só o dono ou admin). */
export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  // buscarPasta usa o cliente da sessão → a RLS só devolve pasta que ele enxerga.
  const row = await buscarPasta(r.sessao.supabase, params.id);
  if (!row)
    return NextResponse.json({ erro: "Pasta não encontrada." }, { status: 404 });
  if (!podeGerirPasta(r.sessao, row.criado_por)) {
    return NextResponse.json(
      { erro: "Você não pode editar esta pasta." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = pastaUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const pasta = await atualizarPastaPorId(r.sessao.supabase, params.id, parsed.data);
    return NextResponse.json({ pasta });
  } catch (e) {
    return respostaDeErro(e, "Falha ao atualizar pasta.");
  }
}

/** DELETE /api/anotacoes/pastas/:id — só o dono ou admin. */
export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  const row = await buscarPasta(r.sessao.supabase, params.id);
  if (!row)
    return NextResponse.json({ erro: "Pasta não encontrada." }, { status: 404 });
  if (!podeGerirPasta(r.sessao, row.criado_por)) {
    return NextResponse.json(
      { erro: "Você não pode excluir esta pasta." },
      { status: 403 }
    );
  }

  try {
    await removerPastaPorId(r.sessao.supabase, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e, "Falha ao excluir pasta.");
  }
}
