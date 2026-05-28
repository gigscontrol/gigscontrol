import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  trocasSlug30d,
  SLUG_LIMITE_30D,
} from "@/lib/services/workspace-slug.service";

/**
 * GET /api/workspace/slug
 *
 * Devolve dados sobre o slug atual e a cota de trocas:
 *   {
 *     slug: string,
 *     trocasUltimos30d: number,
 *     trocasRestantes: number,
 *     limite: number,
 *   }
 */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode ver dados do username da agência." },
      { status: 403 }
    );
  }

  const admin = criarClienteAdmin();
  try {
    const { data, error } = await admin
      .from("workspaces")
      .select("slug")
      .eq("id", r.sessao.workspaceId)
      .single();
    if (error || !data) {
      return NextResponse.json(
        { erro: "Workspace não encontrado." },
        { status: 404 }
      );
    }
    const trocas = await trocasSlug30d(admin, r.sessao.workspaceId);
    return NextResponse.json({
      slug: data.slug ?? "",
      trocasUltimos30d: trocas,
      trocasRestantes: Math.max(0, SLUG_LIMITE_30D - trocas),
      limite: SLUG_LIMITE_30D,
    });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao buscar slug." },
      { status: 500 }
    );
  }
}
