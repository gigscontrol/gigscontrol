import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarPastasDoWorkspace,
  criarPastaNoWorkspace,
} from "@/lib/services/anotacoes.service";
import { pastaCreateSchema } from "@/lib/validators/anotacoes.schema";
import { contarPastasDoWorkspace } from "@/lib/repositories/anotacoes.repo";
import { podeCriarPastaAnotacao } from "@/lib/api/permissoes";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { respostaDeErro } from "@/lib/api/erros";

const MAX_PASTAS = 8;

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
    // Teto GLOBAL de 8 pastas por workspace — conta via admin (a sessão não vê
    // pastas privadas de outros; a contagem precisa incluir todas).
    const usadas = await contarPastasDoWorkspace(criarClienteAdmin(), r.sessao.workspaceId);
    if (usadas >= MAX_PASTAS) {
      return NextResponse.json(
        { erro: `Limite de ${MAX_PASTAS} pastas atingido. Exclua uma pasta para criar outra.` },
        { status: 409 }
      );
    }
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
