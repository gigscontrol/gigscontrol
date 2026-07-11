import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarCidadesDoWorkspace,
  criarCidadeNoWorkspace,
} from "@/lib/services/cidades.service";
import { cidadeCreateSchema } from "@/lib/validators/contatos.schema";
import { verificarAcessoContatos } from "@/lib/api/permissoes";
import { escopoContatosDoArtista } from "@/lib/permissoes/resolver";
import { respostaDeErro } from "@/lib/api/erros";

export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  // Cidades é catálogo (rótulos/coords, sem PII de contato). O ARTISTA lê o
  // catálogo para nomear os próprios shows/contatos — salvo quando a
  // privacidade é "nenhum" (não vê contato algum → lista vazia). Demais papéis:
  // gate atual (para eles é no-op; só artista era barrado).
  if (r.sessao.papel === "artista") {
    if (escopoContatosDoArtista(r.sessao.privacidade) === "nenhum") {
      return NextResponse.json({ cidades: [] });
    }
  } else {
    const bloqueio = verificarAcessoContatos(r.sessao);
    if (bloqueio) return bloqueio;
  }
  try {
    const cidades = await listarCidadesDoWorkspace(r.sessao.supabase);
    return NextResponse.json({ cidades });
  } catch (e) {
    return respostaDeErro(e, "Falha ao listar cidades.");
  }
}

export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoContatos(r.sessao);
  if (bloqueio) return bloqueio;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = cidadeCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const cidade = await criarCidadeNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      parsed.data
    );
    return NextResponse.json({ cidade }, { status: 201 });
  } catch (e) {
    return respostaDeErro(e, "Falha ao criar cidade.");
  }
}
