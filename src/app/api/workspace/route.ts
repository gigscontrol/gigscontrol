import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { verificarAdminDoWorkspace } from "@/lib/api/permissoes";
import { rowParaWorkspace, type WorkspaceRow } from "@/lib/mappers/workspace";
import { workspaceUpdateSchema } from "@/lib/validators/workspace.schema";
import { auditAndNotify } from "@/lib/services/historico.service";

const COLS =
  "id, nome, plano, ciclo, status, logo_url, slug, whatsapp, cor_acento, " +
  "cidade_ibge_id, cidade_nome, cidade_uf, idioma_padrao, pais_padrao, formato_data, fuso_padrao, criado_em";

/** GET /api/workspace — dados do workspace ativo. */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const { data, error } = await r.sessao.supabase
      .from("workspaces")
      .select(COLS)
      .eq("id", r.sessao.workspaceId)
      .single<WorkspaceRow>();
    if (error || !data) {
      return NextResponse.json(
        { erro: "Workspace não encontrado." },
        { status: 404 }
      );
    }
    return NextResponse.json({ workspace: rowParaWorkspace(data) });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao buscar workspace." },
      { status: 500 }
    );
  }
}

/** PATCH /api/workspace — atualiza nome, identidade (whatsapp, cor, cidade). */
export async function PATCH(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  // Só admin pode editar dados da agência
  const g = verificarAdminDoWorkspace(r.sessao);
  if (g) return g;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = workspaceUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Constrói o patch só com os campos que vieram (não sobrescreve com null
  // se o caller não enviou a chave)
  const patch: Record<string, unknown> = {};
  if (parsed.data.nome !== undefined) patch.nome = parsed.data.nome;
  if (parsed.data.whatsapp !== undefined) patch.whatsapp = parsed.data.whatsapp;
  if (parsed.data.cor_acento !== undefined) patch.cor_acento = parsed.data.cor_acento;
  if (parsed.data.cidade_ibge_id !== undefined) patch.cidade_ibge_id = parsed.data.cidade_ibge_id;
  if (parsed.data.cidade_nome !== undefined) patch.cidade_nome = parsed.data.cidade_nome;
  if (parsed.data.cidade_uf !== undefined) patch.cidade_uf = parsed.data.cidade_uf;
  if (parsed.data.idioma_padrao !== undefined) patch.idioma_padrao = parsed.data.idioma_padrao;
  if (parsed.data.pais_padrao !== undefined) patch.pais_padrao = parsed.data.pais_padrao;
  if (parsed.data.formato_data !== undefined) patch.formato_data = parsed.data.formato_data;
  if (parsed.data.fuso_padrao !== undefined) patch.fuso_padrao = parsed.data.fuso_padrao;

  if (Object.keys(patch).length === 0) {
    // Nada pra atualizar — devolve o estado atual
    const { data } = await r.sessao.supabase
      .from("workspaces")
      .select(COLS)
      .eq("id", r.sessao.workspaceId)
      .single<WorkspaceRow>();
    return NextResponse.json({ workspace: data ? rowParaWorkspace(data) : null });
  }

  // Cliente admin porque RLS de workspaces só permite escrita pra super-admin
  const admin = criarClienteAdmin();

  try {
    const { data, error } = await admin
      .from("workspaces")
      .update(patch)
      .eq("id", r.sessao.workspaceId)
      .select(COLS)
      .single<WorkspaceRow>();
    if (error || !data) {
      return NextResponse.json(
        { erro: error?.message ?? "Falha ao atualizar." },
        { status: 500 }
      );
    }
    const ws = rowParaWorkspace(data);
    await auditAndNotify(r.sessao, {
      modulo: "aparencia",
      tipo: "editar",
      entidadeId: ws.id,
      entidadeNome: ws.nomeAgencia,
      descricao: `Atualizou dados da agência (${Object.keys(patch).join(", ")})`,
    });
    return NextResponse.json({ workspace: ws });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar workspace." },
      { status: 500 }
    );
  }
}
