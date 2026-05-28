import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  trocarSlugDoWorkspace,
  SlugInvalidoError,
  SlugEmUsoError,
} from "@/lib/services/workspace-slug.service";

/**
 * POST /api/workspace/slug/definir-inicial
 *
 * Define o slug da agência na Etapa 3 do onboarding wizard. Diferente
 * de `/slug/trocar`, este endpoint:
 *  - Só funciona enquanto `onboarding_completo = false` (proteção
 *    contra abuso — depois do setup, troca é via /slug/trocar com
 *    cota de 3/30d)
 *  - NÃO consome cota
 *  - NÃO registra em workspace_slug_history (não é uma "troca")
 *
 * Faz a cascata em profiles.username + email fake interno, mesma
 * lógica de trocar-slug.
 *
 * Body: { slug: string }
 */
const schema = z.object({
  slug: z.string().min(1).max(40),
});

export async function POST(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode definir o username." },
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

  const admin = criarClienteAdmin();

  // Garante que o onboarding ainda não foi concluído — depois disso,
  // troca de slug exige a rota /slug/trocar (com cota).
  const { data: ws } = await admin
    .from("workspaces")
    .select("onboarding_completo")
    .eq("id", r.sessao.workspaceId)
    .single();
  if (ws?.onboarding_completo) {
    return NextResponse.json(
      {
        erro:
          "Onboarding já concluído. Use a aba Geral pra trocar o username (limite: 3 trocas/30 dias).",
      },
      { status: 409 }
    );
  }

  try {
    const resultado = await trocarSlugDoWorkspace(
      admin,
      {
        workspaceId: r.sessao.workspaceId,
        novoSlug: parsed.data.slug,
        alteradoPor: r.sessao.userId,
      },
      { pularCota: true, pularHistorico: true }
    );
    return NextResponse.json(resultado);
  } catch (e) {
    if (e instanceof SlugInvalidoError) {
      return NextResponse.json({ erro: e.detalhe }, { status: 400 });
    }
    if (e instanceof SlugEmUsoError) {
      return NextResponse.json({ erro: e.message }, { status: 409 });
    }
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao definir username." },
      { status: 500 }
    );
  }
}
