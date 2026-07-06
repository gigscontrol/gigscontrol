import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { pertenceAoWorkspace } from "@/lib/api/pertence";
import { listarEquipeDoArtista } from "@/lib/services/equipeArtista.service";
import { respostaDeErro } from "@/lib/api/erros";

type RouteCtx = { params: { id: string } };

/**
 * GET /api/artistas/[id]/equipe
 * Lista os membros vinculados a este artista (com perfis + permissões).
 * Só admin. O id é do ARTISTA.
 */
export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin gerencia a equipe do artista." },
      { status: 403 }
    );
  }

  const admin = criarClienteAdmin();
  if (!(await pertenceAoWorkspace(admin, "artists", params.id, r.sessao.workspaceId))) {
    return NextResponse.json({ erro: "Artista não encontrado." }, { status: 404 });
  }

  try {
    const membros = await listarEquipeDoArtista(r.sessao.supabase, params.id);
    return NextResponse.json({ membros });
  } catch (e) {
    return respostaDeErro(e, "Falha ao listar a equipe.");
  }
}
