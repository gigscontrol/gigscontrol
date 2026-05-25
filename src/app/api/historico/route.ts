import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { listarHistoricoDoWorkspace } from "@/lib/services/historico.service";
import type { ModuloHistorico } from "@/lib/mappers/historico";

const MODULOS_VALIDOS: ModuloHistorico[] = [
  "venda",
  "orcamento",
  "parcela",
  "show",
  "artista",
  "equipe",
  "contato",
  "aparencia",
  "lixeira",
];

/**
 * GET /api/historico?modulo=&actor=&periodo=&limit=&offset=
 * Lista a trilha de auditoria do workspace. Restrito a admin.
 */
export async function GET(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  // Acesso restrito a admin (v1). Outros papéis recebem 403.
  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Acesso restrito ao admin." },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const moduloParam = url.searchParams.get("modulo");
  const actor = url.searchParams.get("actor") ?? undefined;
  const periodo = url.searchParams.get("periodo"); // "24h" | "7d" | "30d" | "tudo"
  const limit = clampInt(url.searchParams.get("limit"), 1, 200, 50);
  const offset = clampInt(url.searchParams.get("offset"), 0, 100000, 0);

  let modulo: ModuloHistorico | undefined;
  if (moduloParam && MODULOS_VALIDOS.includes(moduloParam as ModuloHistorico)) {
    modulo = moduloParam as ModuloHistorico;
  }

  let desde: string | undefined;
  if (periodo === "24h") {
    desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  } else if (periodo === "7d") {
    desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (periodo === "30d") {
    desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  try {
    const historico = await listarHistoricoDoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      { modulo, actorId: actor, desde, limit, offset }
    );
    return NextResponse.json({ historico, limit, offset });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar histórico." },
      { status: 500 }
    );
  }
}

function clampInt(
  raw: string | null,
  min: number,
  max: number,
  fallback: number
): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
