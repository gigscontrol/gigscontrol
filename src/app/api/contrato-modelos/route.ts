import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarModelosDoWorkspace,
  criarModeloNoWorkspace,
  LimiteModelosError,
} from "@/lib/services/contratoModelos.service";
import { contratoModeloCreateSchema } from "@/lib/validators/contratoModelos.schema";
import type { PlanoId } from "@/lib/planos";

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
  const r = await autenticarComWorkspace({ exigirAcesso: true });
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

  // Plano do workspace — necessário pra validar o limite de modelos.
  const { data: ws, error: wsErr } = await r.sessao.supabase
    .from("workspaces")
    .select("plano")
    .eq("id", r.sessao.workspaceId)
    .single();
  if (wsErr || !ws) {
    return NextResponse.json(
      { erro: "Workspace não encontrado." },
      { status: 404 }
    );
  }

  try {
    const modelo = await criarModeloNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      ws.plano as PlanoId,
      parsed.data
    );
    return NextResponse.json({ modelo }, { status: 201 });
  } catch (e) {
    if (e instanceof LimiteModelosError) {
      return NextResponse.json({ erro: e.message }, { status: 409 });
    }
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao criar modelo." },
      { status: 500 }
    );
  }
}
