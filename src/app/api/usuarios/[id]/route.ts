import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  atualizarUsuarioDaEquipe,
  removerUsuarioDaEquipe,
} from "@/lib/services/usuarios.service";
import { usuarioUpdateSchema } from "@/lib/validators/usuarios.schema";
import { auditAndNotify } from "@/lib/services/historico.service";

type RouteCtx = { params: { id: string } };

export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = usuarioUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const admin = criarClienteAdmin();
    const usuario = await atualizarUsuarioDaEquipe(admin, params.id, parsed.data);
    await auditAndNotify(r.sessao, {
      modulo: "equipe",
      tipo: "editar",
      entidadeId: usuario.id,
      entidadeNome: usuario.nome,
      descricao: `Editou o usuário ${usuario.nome}`,
    });
    return NextResponse.json({ usuario });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar usuário." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  // Snapshot do nome ANTES de remover, pra auditoria legível
  const adminPre = criarClienteAdmin();
  const { data: snap } = await adminPre
    .from("profiles")
    .select("id, nome")
    .eq("id", params.id)
    .maybeSingle();
  try {
    const admin = criarClienteAdmin();
    await removerUsuarioDaEquipe(admin, params.id);
    await auditAndNotify(r.sessao, {
      modulo: "equipe",
      tipo: "remover",
      entidadeId: params.id,
      entidadeNome: snap?.nome ?? null,
      descricao: `Removeu ${snap?.nome ?? "usuário"} da equipe`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao remover usuário." },
      { status: 500 }
    );
  }
}
