import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { rowParaWorkspace, type WorkspaceRow } from "@/lib/mappers/workspace";
import { workspaceUpdateSchema } from "@/lib/validators/workspace.schema";
import { audit } from "@/lib/services/historico.service";

/** GET /api/workspace — dados do workspace ativo. */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const { data, error } = await r.sessao.supabase
      .from("workspaces")
      .select("id, nome, plano, ciclo, status, logo_url, criado_em")
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

/** PATCH /api/workspace — atualiza nome. */
export async function PATCH(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

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

  const patch: Record<string, unknown> = {};
  if (parsed.data.nome !== undefined) patch.nome = parsed.data.nome;

  // Usa o cliente admin (service_role) porque a policy `workspaces_escrita`
  // só permite UPDATE para super-admin. A autorização do cliente
  // (que é dono do workspace) já foi validada por `autenticarComWorkspace`.
  const admin = criarClienteAdmin();

  try {
    const { data, error } = await admin
      .from("workspaces")
      .update(patch)
      .eq("id", r.sessao.workspaceId)
      .select("id, nome, plano, ciclo, status, logo_url, criado_em")
      .single<WorkspaceRow>();
    if (error || !data) {
      return NextResponse.json(
        { erro: error?.message ?? "Falha ao atualizar." },
        { status: 500 }
      );
    }
    const ws = rowParaWorkspace(data);
    if (parsed.data.nome !== undefined) {
      await audit(r.sessao, {
        modulo: "aparencia",
        tipo: "editar",
        entidadeId: ws.id,
        entidadeNome: ws.nomeAgencia,
        descricao: `Alterou o nome da agência para "${ws.nomeAgencia}"`,
      });
    }
    return NextResponse.json({ workspace: ws });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar workspace." },
      { status: 500 }
    );
  }
}
