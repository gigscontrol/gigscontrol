import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarCasasDoWorkspace,
  criarCasaNoWorkspace,
} from "@/lib/services/casas.service";
import { casaCreateSchema } from "@/lib/validators/contatos.schema";
import { verificarAcessoContatos } from "@/lib/api/permissoes";

export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoContatos(r.sessao);
  if (bloqueio) return bloqueio;
  try {
    const casas = await listarCasasDoWorkspace(r.sessao.supabase);
    return NextResponse.json({ casas });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar casas." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoContatos(r.sessao);
  if (bloqueio) return bloqueio;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = casaCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const casa = await criarCasaNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      parsed.data
    );
    return NextResponse.json({ casa }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao criar casa." },
      { status: 500 }
    );
  }
}
