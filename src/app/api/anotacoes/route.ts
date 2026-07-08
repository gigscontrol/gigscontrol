import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarNotasDoWorkspace,
  criarNotaNoWorkspace,
} from "@/lib/services/anotacoes.service";
import { notaCreateSchema } from "@/lib/validators/anotacoes.schema";
import { buscarPasta } from "@/lib/repositories/anotacoes.repo";
import { respostaDeErro } from "@/lib/api/erros";

/** GET /api/anotacoes — notas das pastas que o usuário PODE ver (RLS filtra). */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const notas = await listarNotasDoWorkspace(r.sessao.supabase);
    return NextResponse.json({ notas });
  } catch (e) {
    return respostaDeErro(e, "Falha ao listar anotações.");
  }
}

/** POST /api/anotacoes — adiciona uma nota (mensagem) numa pasta que ele enxerga. */
export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = notaCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Só adiciona nota em pasta que enxerga (a RLS de leitura da pasta é o gate).
  const pasta = await buscarPasta(r.sessao.supabase, parsed.data.pasta_id);
  if (!pasta)
    return NextResponse.json({ erro: "Pasta não encontrada." }, { status: 404 });

  try {
    const nota = await criarNotaNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      parsed.data,
      r.sessao.userId
    );
    return NextResponse.json({ nota }, { status: 201 });
  } catch (e) {
    return respostaDeErro(e, "Falha ao salvar anotação.");
  }
}
