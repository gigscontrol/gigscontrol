import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarSignatariosDoContrato,
  definirSignatarios,
} from "@/lib/services/contratoSignatarios.service";
import { definirSignatariosSchema } from "@/lib/validators/contratoSignatarios.schema";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const signatarios = await listarSignatariosDoContrato(
      r.sessao.supabase,
      params.id
    );
    return NextResponse.json({ signatarios });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar signatários." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas administradores podem definir signatários." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = definirSignatariosSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const signatarios = await definirSignatarios(
      r.sessao.supabase,
      r.sessao.workspaceId,
      params.id,
      parsed.data.signatarios.map((s) => ({
        nome: s.nome,
        email: s.email || null,
        papel: s.papel ?? null,
        exige: s.exige,
      }))
    );
    return NextResponse.json({ signatarios }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao definir signatários." },
      { status: 500 }
    );
  }
}
