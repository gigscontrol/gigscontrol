import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  verificarAcessoContatos,
  verificarMutacaoContato,
} from "@/lib/api/permissoes";
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
    // Confirma escopo antes de mutar — 404 (não 403) fora do escopo.
    const atual = await buscarCasaPorId(r.sessao.supabase, params.id);
    if (!atual || !(await casaVisivelParaSessao(r.sessao.supabase, r.sessao, params.id)))
      return NextResponse.json({ erro: "Casa não encontrada." }, { status: 404 });
    // v2: editar casa distingue "criada por ele" (contatos.editar_proprios) ×
    // "por outros" (contatos.editar_outros), pela autoria da LINHA. `criado_por`
    // nulo (catálogo antigo sem dono) = de outros. Casa é catálogo compartilhado:
    // a visibilidade acima é ampla, mas a EDIÇÃO respeita a autoria.
    const g = verificarMutacaoContato(r.sessao, "editar", atual.criadoPor ?? null);
    if (g) return g;
    const casa = await atualizarCasaPorId(
      r.sessao.supabase,
      params.id,
      parsed.data,
      r.sessao.userId
    );
    return NextResponse.json({ casa });
  } catch (e) {
    return respostaDeErro(e, "Falha ao atualizar casa.");
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  try {
    // Confirma escopo antes de mutar — 404 (não 403) fora do escopo.
    const atual = await buscarCasaPorId(r.sessao.supabase, params.id);
    if (!atual || !(await casaVisivelParaSessao(r.sessao.supabase, r.sessao, params.id)))
      return NextResponse.json({ erro: "Casa não encontrada." }, { status: 404 });
    // v2: excluir casa distingue "criada por ele" × "por outros" pela autoria da
    // LINHA (contatos.excluir_proprios × contatos.excluir_outros); nulo = de outros.
    const g = verificarMutacaoContato(r.sessao, "excluir", atual.criadoPor ?? null);
    if (g) return g;
    await removerCasaPorId(r.sessao.supabase, params.id, r.sessao.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e, "Falha ao remover casa.");
  }
}
