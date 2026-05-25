import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  restaurarArtistaDaLixeira,
  restaurarUsuarioDaLixeira,
} from "@/lib/services/lixeira.service";
import type { PlanoId } from "@/lib/planos";
import { audit } from "@/lib/services/historico.service";

type RouteCtx = { params: { tipo: string; id: string } };

/**
 * POST /api/lixeira/:tipo/:id/restaurar — tira da lixeira.
 * `tipo` ∈ { 'artista', 'usuario' }.
 *
 * Antes de restaurar, valida o limite do plano:
 * - artista: respeita `plano.maxArtistas`
 * - usuario: respeita `plano.maxUsuariosAdicionais`
 *
 * Se o workspace já está no limite, devolve 409 com a mensagem do erro
 * (`LimitePlanoAtingidoError` ou `LimitePlanoEquipeError`).
 */
export async function POST(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  const admin = criarClienteAdmin();

  // Lê o plano do workspace pra validar o limite na restauração.
  const { data: ws, error: errWs } = await admin
    .from("workspaces")
    .select("plano")
    .eq("id", r.sessao.workspaceId)
    .maybeSingle();
  if (errWs || !ws) {
    return NextResponse.json(
      { erro: "Workspace não encontrado." },
      { status: 500 }
    );
  }
  const planoId = ws.plano as PlanoId;

  try {
    let entidadeNome: string | null = null;
    if (params.tipo === "artista") {
      const { data: snap } = await admin
        .from("artists")
        .select("name")
        .eq("id", params.id)
        .maybeSingle();
      entidadeNome = snap?.name ?? null;
      await restaurarArtistaDaLixeira(admin, params.id, planoId);
    } else if (params.tipo === "usuario") {
      const { data: snap } = await admin
        .from("profiles")
        .select("nome")
        .eq("id", params.id)
        .maybeSingle();
      entidadeNome = snap?.nome ?? null;
      await restaurarUsuarioDaLixeira(
        admin,
        params.id,
        r.sessao.workspaceId,
        planoId
      );
    } else {
      return NextResponse.json(
        { erro: `Tipo inválido: ${params.tipo}` },
        { status: 400 }
      );
    }
    await audit(r.sessao, {
      modulo: "lixeira",
      tipo: "restaurar",
      entidadeId: params.id,
      entidadeNome,
      descricao: `Restaurou ${params.tipo} ${entidadeNome ?? params.id} da lixeira`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as Error & { status?: number };
    const status = typeof err.status === "number" ? err.status : 500;
    return NextResponse.json(
      { erro: err.message ?? "Falha ao restaurar." },
      { status }
    );
  }
}
