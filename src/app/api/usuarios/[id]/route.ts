import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { pertenceAoWorkspace } from "@/lib/api/pertence";
import { verificarAdminDoWorkspace } from "@/lib/api/permissoes";
import {
  atualizarUsuarioDaEquipe,
  removerUsuarioDaEquipe,
} from "@/lib/services/usuarios.service";
import { usuarioUpdateSchema } from "@/lib/validators/usuarios.schema";
import { auditAndNotify } from "@/lib/services/historico.service";
import { respostaDeErro } from "@/lib/api/erros";

type RouteCtx = { params: { id: string } };

export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  const g = verificarAdminDoWorkspace(r.sessao);
  if (g) return g;

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
    // Isolamento multi-tenant: o admin client ignora RLS, então valida à mão.
    if (!(await pertenceAoWorkspace(admin, "profiles", params.id, r.sessao.workspaceId))) {
      return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });
    }
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
    return respostaDeErro(e, "Falha ao atualizar usuário.");
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  const g = verificarAdminDoWorkspace(r.sessao);
  if (g) return g;
  // Snapshot do nome ANTES de remover, pra auditoria legível
  const adminPre = criarClienteAdmin();
  // Isolamento multi-tenant: o admin client ignora RLS, então valida à mão.
  if (!(await pertenceAoWorkspace(adminPre, "profiles", params.id, r.sessao.workspaceId))) {
    return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });
  }
  const { data: snap } = await adminPre
    .from("profiles")
    .select("id, nome")
    .eq("id", params.id)
    .maybeSingle();
  try {
    const admin = criarClienteAdmin();
    await removerUsuarioDaEquipe(admin, params.id, r.sessao.userId);
    await auditAndNotify(r.sessao, {
      modulo: "equipe",
      tipo: "remover",
      entidadeId: params.id,
      entidadeNome: snap?.nome ?? null,
      descricao: `Removeu ${snap?.nome ?? "usuário"} da equipe`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e, "Falha ao remover usuário.");
  }
}
