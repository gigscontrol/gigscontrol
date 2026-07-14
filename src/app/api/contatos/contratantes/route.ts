import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarContratantesDoWorkspace,
  criarContratanteNoWorkspace,
} from "@/lib/services/contratantes.service";
import { contratanteCreateSchema } from "@/lib/validators/contatos.schema";
import {
  verificarAcessoContatos,
  verificarMutacaoContato,
} from "@/lib/api/permissoes";
import { respostaDeErro } from "@/lib/api/erros";

export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  // Artista NÃO é barrado aqui: a lista é filtrada por privacidade.contatos no
  // serviço (nenhum → vazia; proprios → só dos eventos dele; todos → tudo).
  // Demais papéis: gate atual (só artista era bloqueado; para eles é no-op).
  if (r.sessao.papel !== "artista") {
    const bloqueio = verificarAcessoContatos(r.sessao);
    if (bloqueio) return bloqueio;
  }
  try {
    const contratantes = await listarContratantesDoWorkspace(
      r.sessao.supabase,
      r.sessao
    );
    return NextResponse.json({ contratantes });
  } catch (e) {
    return respostaDeErro(e, "Falha ao listar contratantes.");
  }
}

export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  // D2: criar contato exige `contatos.criar` em algum vínculo.
  const bloqueio = verificarMutacaoContato(r.sessao, "criar");
  if (bloqueio) return bloqueio;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = contratanteCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const contratante = await criarContratanteNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      r.sessao.userId,
      parsed.data
    );
    return NextResponse.json({ contratante }, { status: 201 });
  } catch (e) {
    return respostaDeErro(e, "Falha ao criar contratante.");
  }
}
