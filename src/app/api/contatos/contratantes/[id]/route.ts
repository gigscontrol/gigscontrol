import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  verificarAcessoContatos,
  verificarMutacaoContato,
} from "@/lib/api/permissoes";
import { contratanteVisivelParaSessao } from "@/lib/services/contatosAcesso";
import {
  buscarContratantePorId,
  atualizarContratantePorId,
  removerContratantePorId,
} from "@/lib/services/contratantes.service";
import { contratanteUpdateSchema } from "@/lib/validators/contatos.schema";
import { respostaDeErro } from "@/lib/api/erros";

type RouteCtx = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  // Artista lê por id respeitando privacidade.contatos (checada em
  // contratanteVisivelParaSessao → 404 fora do escopo). Demais papéis: gate
  // atual. PATCH/DELETE seguem bloqueando artista (não muta contatos).
  if (r.sessao.papel !== "artista") {
    const g = verificarAcessoContatos(r.sessao);
    if (g) return g;
  }
  try {
    const contratante = await buscarContratantePorId(r.sessao.supabase, params.id);
    // 404 (não 403) fora do escopo pra não vazar existência.
    if (
      !contratante ||
      !(await contratanteVisivelParaSessao(
        r.sessao.supabase,
        r.sessao,
        params.id,
        contratante.criadoPor ?? null
      ))
    )
      return NextResponse.json({ erro: "Contratante não encontrado." }, { status: 404 });
    return NextResponse.json({ contratante });
  } catch (e) {
    return respostaDeErro(e, "Falha ao buscar contratante.");
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

  const parsed = contratanteUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    // Confirma escopo (visibilidade) antes de mutar — mesma regra da lista.
    const atual = await buscarContratantePorId(r.sessao.supabase, params.id);
    if (
      !atual ||
      !(await contratanteVisivelParaSessao(
        r.sessao.supabase,
        r.sessao,
        params.id,
        atual.criadoPor ?? null
      ))
    )
      return NextResponse.json({ erro: "Contratante não encontrado." }, { status: 404 });
    // v2: editar contato distingue "criado por ele" (contatos.editar_proprios) ×
    // "por outros" (contatos.editar_outros), pela autoria da LINHA. `criado_por`
    // nulo = de outros. Gate DEPOIS de resolver a linha (a autoria vem dela).
    const g = verificarMutacaoContato(r.sessao, "editar", atual.criadoPor ?? null);
    if (g) return g;
    const contratante = await atualizarContratantePorId(
      r.sessao.supabase,
      params.id,
      parsed.data,
      r.sessao.userId
    );
    return NextResponse.json({ contratante });
  } catch (e) {
    return respostaDeErro(e, "Falha ao atualizar contratante.");
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  try {
    const atual = await buscarContratantePorId(r.sessao.supabase, params.id);
    if (
      !atual ||
      !(await contratanteVisivelParaSessao(
        r.sessao.supabase,
        r.sessao,
        params.id,
        atual.criadoPor ?? null
      ))
    )
      return NextResponse.json({ erro: "Contratante não encontrado." }, { status: 404 });
    // v2: excluir contato distingue "criado por ele" × "por outros" pela autoria
    // da LINHA (contatos.excluir_proprios × contatos.excluir_outros); nulo = de outros.
    const g = verificarMutacaoContato(r.sessao, "excluir", atual.criadoPor ?? null);
    if (g) return g;
    await removerContratantePorId(r.sessao.supabase, params.id, r.sessao.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e, "Falha ao remover contratante.");
  }
}
