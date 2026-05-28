import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  slugDisponivel,
  validarFormatoSlug,
  SlugInvalidoError,
} from "@/lib/services/workspace-slug.service";

/**
 * GET /api/workspace/slug/disponivel?slug=twodash2026
 *
 * Checa em tempo real (chamado pela UI com debounce) se um slug está
 * disponível pra o workspace atual usar. Devolve:
 *   {
 *     disponivel: boolean,
 *     erro?: string  (quando inválido por formato)
 *   }
 *
 * "Disponível" = não está em uso por NENHUM outro workspace, e tem
 * formato válido.
 */
export async function GET(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode checar disponibilidade." },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const raw = (url.searchParams.get("slug") ?? "").trim().toLowerCase();

  if (!raw) {
    return NextResponse.json({ disponivel: false, erro: "Vazio." });
  }

  try {
    validarFormatoSlug(raw);
  } catch (e) {
    if (e instanceof SlugInvalidoError) {
      return NextResponse.json({ disponivel: false, erro: e.detalhe });
    }
    throw e;
  }

  try {
    const admin = criarClienteAdmin();
    const livre = await slugDisponivel(admin, raw, r.sessao.workspaceId);
    return NextResponse.json({ disponivel: livre });
  } catch (e) {
    return NextResponse.json(
      { disponivel: false, erro: (e as Error).message ?? "Falha na checagem." },
      { status: 500 }
    );
  }
}
