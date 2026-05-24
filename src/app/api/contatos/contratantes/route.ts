import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarContratantesDoWorkspace,
  criarContratanteNoWorkspace,
} from "@/lib/services/contratantes.service";
import { contratanteCreateSchema } from "@/lib/validators/contatos.schema";
import { verificarAcessoContatos } from "@/lib/api/permissoes";

export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoContatos(r.sessao);
  if (bloqueio) return bloqueio;
  try {
    const contratantes = await listarContratantesDoWorkspace(
      r.sessao.supabase,
      r.sessao
    );
    return NextResponse.json({ contratantes });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar contratantes." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoContatos(r.sessao);
  if (bloqueio) return bloqueio;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = contratanteCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const contratante = await criarContratanteNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      r.sessao.userId,
      parsed.data
    );
    return NextResponse.json({ contratante }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao criar contratante." },
      { status: 500 }
    );
  }
}
