import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { pertenceAoWorkspace } from "@/lib/api/pertence";
import { resetarSenhaArtista } from "@/lib/services/artistas.service";
import { auditAndNotify } from "@/lib/services/historico.service";
import { respostaDeErro } from "@/lib/api/erros";

/**
 * POST /api/artistas/[id]/resetar-senha
 *
 * Reseta a senha do usuário-artista vinculado a este artista. Devolve
 * a nova senha em texto plano (mostrada UMA vez ao admin).
 *
 * Equivalente ao endpoint /api/usuarios/[id]/resetar-senha, mas aqui
 * o id é do artista (não do profile) — o service descobre o profile
 * via artista_id.
 */
type RouteCtx = { params: { id: string } };

export async function POST(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode resetar senha de artista." },
      { status: 403 }
    );
  }

  const admin = criarClienteAdmin();
  // Isolamento multi-tenant: o admin client ignora RLS, então valida à mão.
  if (!(await pertenceAoWorkspace(admin, "artists", params.id, r.sessao.workspaceId))) {
    return NextResponse.json({ erro: "Artista não encontrado." }, { status: 404 });
  }
  try {
    const { senhaTemporaria } = await resetarSenhaArtista(admin, params.id);
    // Snapshot do nome do artista pra log
    const { data: snap } = await r.sessao.supabase
      .from("artists")
      .select("nome")
      .eq("id", params.id)
      .maybeSingle();
    await auditAndNotify(r.sessao, {
      modulo: "artista",
      tipo: "editar",
      entidadeId: params.id,
      entidadeNome: snap?.nome ?? null,
      descricao: `Resetou a senha do artista ${snap?.nome ?? params.id}`,
    });
    return NextResponse.json({ senhaTemporaria });
  } catch (e) {
    return respostaDeErro(e, "Falha ao resetar senha.");
  }
}
