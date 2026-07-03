import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { listarVinculosDoUsuario } from "@/lib/repositories/membrosArtista.repo";

/**
 * GET /api/usuarios/[id]/vinculos
 *
 * Vínculos (usuário × artista) do membro — perfis + permissões por artista.
 * É a fonte da verdade do modelo NOVO. Usado pelo detalhe da aba Equipe pra
 * montar "Funções e DJs atendidos" (o `profiles.funcoes` legado fica sempre
 * vazio no modelo novo, então não serve mais pra exibição).
 *
 * Apenas admin, isolado por workspace (mesmo padrão do /conta).
 *
 * Resposta: { vinculos: [{ artistId, perfis, permissoes }] }
 */
type RouteCtx = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode ver os vínculos de membros da equipe." },
      { status: 403 }
    );
  }

  const admin = criarClienteAdmin();

  // Isolamento por workspace — admin de uma agência não vê vínculos de outra.
  const { data: profile, error: errProf } = await admin
    .from("profiles")
    .select("id, workspace_id")
    .eq("id", params.id)
    .maybeSingle();

  if (errProf || !profile) {
    return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });
  }
  if ((profile as { workspace_id: string | null }).workspace_id !== r.sessao.workspaceId) {
    return NextResponse.json(
      { erro: "Usuário pertence a outro workspace." },
      { status: 403 }
    );
  }

  try {
    const rows = await listarVinculosDoUsuario(admin, params.id);
    const vinculos = rows.map((v) => ({
      artistId: v.artist_id,
      perfis: v.perfis,
      permissoes: v.permissoes,
    }));
    return NextResponse.json({ vinculos });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar os vínculos." },
      { status: 500 }
    );
  }
}
