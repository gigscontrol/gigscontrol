import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { verificarAcessoContatos } from "@/lib/api/permissoes";
import { contratanteVisivelParaSessao } from "@/lib/services/contatosAcesso";
import {
  buscarContratantePorId,
  atualizarContratantePorId,
  removerContratantePorId,
} from "@/lib/services/contratantes.service";
import { contratanteUpdateSchema } from "@/lib/validators/contatos.schema";

type RouteCtx = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const g = verificarAcessoContatos(r.sessao);
  if (g) return g;
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
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao buscar contratante." },
      { status: 500 }
    );
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

  const parsed = contratanteUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    // Confirma escopo (dono) antes de mutar — mesma regra da lista.
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
    const contratante = await atualizarContratantePorId(
      r.sessao.supabase,
      params.id,
      parsed.data
    );
    return NextResponse.json({ contratante });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar contratante." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  const g = verificarAcessoContatos(r.sessao);
  if (g) return g;
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
    await removerContratantePorId(r.sessao.supabase, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao remover contratante." },
      { status: 500 }
    );
  }
}
