import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { verificarAcessoContatos } from "@/lib/api/permissoes";
import { casaVisivelParaSessao } from "@/lib/services/contatosAcesso";
import {
  buscarCasaPorId,
  atualizarCasaPorId,
  removerCasaPorId,
} from "@/lib/services/casas.service";
import { casaUpdateSchema } from "@/lib/validators/contatos.schema";
import { respostaDeErro } from "@/lib/api/erros";

type RouteCtx = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  // Artista lê por id respeitando privacidade.contatos (checada em
  // casaVisivelParaSessao → 404 fora do escopo). Demais papéis: gate atual.
  if (r.sessao.papel !== "artista") {
    const g = verificarAcessoContatos(r.sessao);
    if (g) return g;
  }
  try {
    const casa = await buscarCasaPorId(r.sessao.supabase, params.id);
    // 404 (não 403) fora do escopo pra não vazar existência.
    if (!casa || !(await casaVisivelParaSessao(r.sessao.supabase, r.sessao, params.id)))
      return NextResponse.json({ erro: "Casa não encontrada." }, { status: 404 });
    return NextResponse.json({ casa });
  } catch (e) {
    return respostaDeErro(e, "Falha ao buscar casa.");
  }
}

export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  const g = verificarAcessoContatos(r.sessao);
  if (g) return g;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = casaUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const casa = await atualizarCasaPorId(r.sessao.supabase, params.id, parsed.data);
    return NextResponse.json({ casa });
  } catch (e) {
    return respostaDeErro(e, "Falha ao atualizar casa.");
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  const g = verificarAcessoContatos(r.sessao);
  if (g) return g;
  try {
    await removerCasaPorId(r.sessao.supabase, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e, "Falha ao remover casa.");
  }
}
