import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { verificarAdminDoWorkspace } from "@/lib/api/permissoes";
import {
  trocarSlugDoWorkspace,
  SlugInvalidoError,
  SlugEmUsoError,
  LimiteTrocaSlugError,
} from "@/lib/services/workspace-slug.service";
import { auditAndNotify } from "@/lib/services/historico.service";

/**
 * POST /api/workspace/slug/trocar
 *
 * Troca o username da agência. Cascata em todos os profiles do
 * workspace (username + email fake interno).
 *
 * Body: { slug: string }
 */
const schema = z.object({
  slug: z.string().min(1).max(40),
});

export async function POST(request: Request) {
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
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const admin = criarClienteAdmin();
  try {
    const resultado = await trocarSlugDoWorkspace(admin, {
      workspaceId: r.sessao.workspaceId,
      novoSlug: parsed.data.slug,
      alteradoPor: r.sessao.userId,
    });
    await auditAndNotify(r.sessao, {
      modulo: "aparencia",
      tipo: "editar",
      descricao: `Trocou o username da agência de "${resultado.slugAntigo}" para "${resultado.slugNovo}" (${resultado.usuariosAtualizados} login(s) atualizados)`,
    });
    return NextResponse.json(resultado);
  } catch (e) {
    if (e instanceof SlugInvalidoError) {
      return NextResponse.json({ erro: e.detalhe }, { status: 400 });
    }
    if (e instanceof SlugEmUsoError) {
      return NextResponse.json({ erro: e.message }, { status: 409 });
    }
    if (e instanceof LimiteTrocaSlugError) {
      return NextResponse.json({ erro: e.message }, { status: 429 });
    }
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao trocar username." },
      { status: 500 }
    );
  }
}
