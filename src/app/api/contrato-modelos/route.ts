import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarModelosDoWorkspace,
  criarModeloNoWorkspace,
} from "@/lib/services/contratoModelos.service";
import { contratoModeloCreateSchema } from "@/lib/validators/contratoModelos.schema";

export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const modelos = await listarModelosDoWorkspace(r.sessao.supabase);
    return NextResponse.json({ modelos });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar modelos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas administradores podem criar modelos." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = contratoModeloCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const modelo = await criarModeloNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      parsed.data
    );
    return NextResponse.json({ modelo }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao criar modelo." },
      { status: 500 }
    );
  }
}
