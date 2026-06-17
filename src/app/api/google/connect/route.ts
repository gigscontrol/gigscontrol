import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { assinarState, urlAutorizacao } from "@/lib/google/oauth";

/**
 * POST /api/google/connect  { artistaId }
 *
 * Admin inicia a conexão da conta Google de um artista. Devolve a URL de
 * consentimento do Google (o front redireciona o navegador pra ela). O
 * artista vai no `state` assinado e volta no callback.
 */
export async function POST(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas o admin pode conectar o Google Agenda dos artistas." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const artistaId =
    body && typeof body === "object" && "artistaId" in body
      ? String((body as { artistaId: unknown }).artistaId)
      : "";
  if (!artistaId) {
    return NextResponse.json({ erro: "artistaId obrigatório." }, { status: 400 });
  }

  // Confere que o artista pertence ao workspace (RLS já filtra, mas
  // devolvemos 404 limpo se não existir).
  const { data: artista } = await r.sessao.supabase
    .from("artists")
    .select("id")
    .eq("id", artistaId)
    .maybeSingle();
  if (!artista) {
    return NextResponse.json({ erro: "Artista não encontrado." }, { status: 404 });
  }

  try {
    const state = assinarState({ artistaId, workspaceId: r.sessao.workspaceId });
    return NextResponse.json({ url: urlAutorizacao(state) });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao montar a conexão." },
      { status: 500 }
    );
  }
}
