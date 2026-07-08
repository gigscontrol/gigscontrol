import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarPastasDoWorkspace,
  criarPastaNoWorkspace,
} from "@/lib/services/anotacoes.service";
import { pastaCreateSchema } from "@/lib/validators/anotacoes.schema";
import { podeCriarPastaAnotacao } from "@/lib/api/permissoes";
import { respostaDeErro } from "@/lib/api/erros";

/** GET /api/anotacoes/pastas — pastas que o usuário PODE ver (RLS filtra). */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const pastas = await listarPastasDoWorkspace(r.sessao.supabase);
    // `podeCriar` viaja junto pra UI decidir mostrar o botão "Nova pasta".
    return NextResponse.json({ pastas, podeCriar: podeCriarPastaAnotacao(r.sessao) });
  } catch (e) {
    return respostaDeErro(e, "Falha ao listar pastas.");
  }
}

/** POST /api/anotacoes/pastas — cria pasta (só quem tem permissão dedicada). */
export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  if (!podeCriarPastaAnotacao(r.sessao)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para criar pastas de anotações." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = pastaCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const pasta = await criarPastaNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      parsed.data,
      r.sessao.userId
    );
    return NextResponse.json({ pasta }, { status: 201 });
  } catch (e) {
    return respostaDeErro(e, "Falha ao criar pasta.");
  }
}
