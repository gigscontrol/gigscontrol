import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarModelosDoWorkspace,
  criarModeloNoWorkspace,
  LimiteModelosError,
} from "@/lib/services/contratoModelos.service";
import { contratoModeloCreateSchema } from "@/lib/validators/contratoModelos.schema";
import { podeLerModelos, verificarCriarModelo } from "@/lib/api/permissoes";
import type { PlanoId } from "@/lib/planos";
import { respostaDeErro } from "@/lib/api/erros";

export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  // LER modelos (D3): fecha pra quem tem acesso a contratos (admin, ou equipe
  // com alguma chave contratos.* em algum vínculo, ou artista com contratosVer).
  if (!podeLerModelos(r.sessao))
    return NextResponse.json(
      { erro: "Você não tem acesso aos modelos de contrato." },
      { status: 403 }
    );
  try {
    const modelos = await listarModelosDoWorkspace(r.sessao.supabase);
    return NextResponse.json({ modelos });
  } catch (e) {
    return respostaDeErro(e, "Falha ao listar modelos.");
  }
}

export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  // CRIAR modelo (v2) = admin/super OU `contratos.criar_modelo` em algum vínculo
  // (workspace-level — o modelo não tem artist_id). Editar segue admin-only.
  const gate = verificarCriarModelo(r.sessao);
  if (gate) return gate;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = contratoModeloCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Plano do workspace — necessário pra validar o limite de modelos.
  const { data: ws, error: wsErr } = await r.sessao.supabase
    .from("workspaces")
    .select("plano")
    .eq("id", r.sessao.workspaceId)
    .single();
  if (wsErr || !ws) {
    return NextResponse.json(
      { erro: "Workspace não encontrado." },
      { status: 404 }
    );
  }

  try {
    const modelo = await criarModeloNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      ws.plano as PlanoId,
      parsed.data
    );
    return NextResponse.json({ modelo }, { status: 201 });
  } catch (e) {
    if (e instanceof LimiteModelosError) {
      return NextResponse.json({ erro: e.message }, { status: 409 });
    }
    return respostaDeErro(e, "Falha ao criar modelo.");
  }
}
