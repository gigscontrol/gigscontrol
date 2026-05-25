import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  listarEquipeDoWorkspace,
  criarUsuarioDaEquipe,
  LimitePlanoEquipeError,
  EmailEmUsoError,
} from "@/lib/services/usuarios.service";
import { usuarioCreateSchema } from "@/lib/validators/usuarios.schema";
import type { PlanoId } from "@/lib/planos";
import { auditAndNotify } from "@/lib/services/historico.service";

export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const usuarios = await listarEquipeDoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId
    );
    return NextResponse.json({ usuarios });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar usuários." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/usuarios — cria auth user + profile, devolve a senha temporária
 * UMA vez (cliente exibe pro admin repassar).
 */
export async function POST(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = usuarioCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Plano do workspace
  const admin = criarClienteAdmin();
  const { data: ws, error: wsErr } = await admin
    .from("workspaces")
    .select("plano")
    .eq("id", r.sessao.workspaceId)
    .single();
  if (wsErr || !ws) {
    return NextResponse.json({ erro: "Workspace não encontrado." }, { status: 404 });
  }

  try {
    const resultado = await criarUsuarioDaEquipe(
      admin,
      r.sessao.workspaceId,
      ws.plano as PlanoId,
      parsed.data
    );
    await auditAndNotify(r.sessao, {
      modulo: "equipe",
      tipo: "criar",
      entidadeId: resultado.usuario.id,
      entidadeNome: resultado.usuario.nome,
      descricao: `Adicionou ${resultado.usuario.nome} à equipe`,
    });
    return NextResponse.json(resultado, { status: 201 });
  } catch (e) {
    if (e instanceof LimitePlanoEquipeError || e instanceof EmailEmUsoError) {
      return NextResponse.json({ erro: e.message }, { status: 409 });
    }
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao criar usuário." },
      { status: 500 }
    );
  }
}
