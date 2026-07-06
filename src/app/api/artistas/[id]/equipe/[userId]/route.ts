import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { pertenceAoWorkspace } from "@/lib/api/pertence";
import {
  salvarVinculoDoArtista,
  removerVinculoDoArtista,
} from "@/lib/services/equipeArtista.service";
import { vinculoSchema } from "@/lib/validators/vinculo.schema";
import { auditAndNotify } from "@/lib/services/historico.service";
import { respostaDeErro } from "@/lib/api/erros";

type RouteCtx = { params: { id: string; userId: string } };

/** Valida que artista e usuário pertencem ao workspace do admin (anti-IDOR). */
async function validarWorkspace(
  admin: ReturnType<typeof criarClienteAdmin>,
  artistId: string,
  userId: string,
  workspaceId: string
): Promise<NextResponse | null> {
  if (!(await pertenceAoWorkspace(admin, "artists", artistId, workspaceId))) {
    return NextResponse.json({ erro: "Artista não encontrado." }, { status: 404 });
  }
  if (!(await pertenceAoWorkspace(admin, "profiles", userId, workspaceId))) {
    return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });
  }
  return null;
}

/**
 * PUT /api/artistas/[id]/equipe/[userId]
 * Cria/atualiza o vínculo (perfis + permissões) do usuário nesse artista.
 */
export async function PUT(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin altera permissões." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = vinculoSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const admin = criarClienteAdmin();
  const bloqueio = await validarWorkspace(admin, params.id, params.userId, r.sessao.workspaceId);
  if (bloqueio) return bloqueio;

  try {
    const vinculo = await salvarVinculoDoArtista(
      admin,
      r.sessao.workspaceId,
      params.userId,
      params.id,
      parsed.data.perfis,
      parsed.data.permissoes
    );
    await auditAndNotify(r.sessao, {
      modulo: "equipe",
      tipo: "editar",
      entidadeId: params.userId,
      entidadeNome: null,
      descricao: `Ajustou permissões de um membro no artista`,
    });
    return NextResponse.json({ vinculo });
  } catch (e) {
    return respostaDeErro(e, "Falha ao salvar o vínculo.");
  }
}

/**
 * DELETE /api/artistas/[id]/equipe/[userId]
 * Remove o vínculo do usuário com esse artista (soft delete).
 */
export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin altera permissões." },
      { status: 403 }
    );
  }

  const admin = criarClienteAdmin();
  const bloqueio = await validarWorkspace(admin, params.id, params.userId, r.sessao.workspaceId);
  if (bloqueio) return bloqueio;

  try {
    await removerVinculoDoArtista(admin, params.userId, params.id);
    await auditAndNotify(r.sessao, {
      modulo: "equipe",
      tipo: "remover",
      entidadeId: params.userId,
      entidadeNome: null,
      descricao: `Removeu um membro da equipe do artista`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e, "Falha ao remover o vínculo.");
  }
}
