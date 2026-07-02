import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { pertenceAoWorkspace } from "@/lib/api/pertence";
import {
  atualizarArtistaPorId,
  removerArtistaPorId,
} from "@/lib/services/artistas.service";
import { artistaUpdateSchema } from "@/lib/validators/artistas.schema";
import { auditAndNotify } from "@/lib/services/historico.service";

type RouteCtx = { params: { id: string } };

export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = artistaUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Update usa admin pra também conseguir ler o profile.username via join
  // sem precisar de policy extra.
  const admin = criarClienteAdmin();
  // Isolamento multi-tenant: o admin client ignora RLS, então valida à mão.
  if (!(await pertenceAoWorkspace(admin, "artists", params.id, r.sessao.workspaceId))) {
    return NextResponse.json({ erro: "Artista não encontrado." }, { status: 404 });
  }
  try {
    const artista = await atualizarArtistaPorId(admin, params.id, parsed.data);
    await auditAndNotify(r.sessao, {
      modulo: "artista",
      tipo: "editar",
      entidadeId: artista.id,
      entidadeNome: artista.name,
      descricao: `Editou o artista ${artista.name}`,
    });
    return NextResponse.json({ artista });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar artista." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  // Snapshot do nome ANTES de remover, pra auditoria legível
  const { data: snap } = await r.sessao.supabase
    .from("artists")
    .select("id, nome")
    .eq("id", params.id)
    .maybeSingle();
  try {
    await removerArtistaPorId(r.sessao.supabase, params.id);
    await auditAndNotify(r.sessao, {
      modulo: "artista",
      tipo: "remover",
      entidadeId: params.id,
      entidadeNome: snap?.nome ?? null,
      descricao: `Removeu o artista ${snap?.nome ?? params.id}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao remover artista." },
      { status: 500 }
    );
  }
}
