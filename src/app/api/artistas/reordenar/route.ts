import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { reordenarArtistasNoWorkspace } from "@/lib/services/artistas.service";
import { auditAndNotify } from "@/lib/services/historico.service";

/**
 * POST /api/artistas/reordenar
 *
 * Recebe a nova ordem dos artistas (lista de IDs) e regrava `posicao`
 * em cada um. Apenas admin pode reordenar.
 *
 * Body: { ids: string[] }
 */

// Aceita qualquer string não vazia. A semântica (IDs do workspace
// correto) é validada no service, então não precisa apertar com
// .uuid() aqui (que rejeita formatos não-v4 mesmo sendo UUIDs válidos).
const schema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode reordenar artistas." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await reordenarArtistasNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      parsed.data.ids
    );
    await auditAndNotify(r.sessao, {
      modulo: "artista",
      tipo: "editar",
      descricao: `Reordenou a lista de artistas (${parsed.data.ids.length} itens)`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao reordenar artistas." },
      { status: 500 }
    );
  }
}
