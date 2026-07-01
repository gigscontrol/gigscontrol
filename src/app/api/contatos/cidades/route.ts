import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarCidadesDoWorkspace,
  criarCidadeNoWorkspace,
} from "@/lib/services/cidades.service";
import { cidadeCreateSchema } from "@/lib/validators/contatos.schema";
import { verificarAcessoContatos } from "@/lib/api/permissoes";

export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoContatos(r.sessao);
  if (bloqueio) return bloqueio;
  try {
    const cidades = await listarCidadesDoWorkspace(r.sessao.supabase);
    return NextResponse.json({ cidades });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar cidades." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = cidadeCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const cidade = await criarCidadeNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      parsed.data
    );
    return NextResponse.json({ cidade }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao criar cidade." },
      { status: 500 }
    );
  }
}
