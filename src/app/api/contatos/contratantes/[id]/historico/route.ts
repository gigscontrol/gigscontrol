import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { verificarAcessoContatos } from "@/lib/api/permissoes";
import { contratanteVisivelParaSessao } from "@/lib/services/contatosAcesso";
import { buscarContratantePorId } from "@/lib/services/contratantes.service";
import { respostaDeErro } from "@/lib/api/erros";

type RouteCtx = { params: { id: string } };

/**
 * GET /api/contatos/contratantes/[id]/historico
 *
 * Histórico de shows do contratante em versão SANITIZADA (I12): data, status,
 * cidade, casa e QUAL artista — sem NENHUM valor financeiro (cachê, parcelas,
 * camarim, hotel...). Existe porque os caches do cliente são escopados ao
 * próprio artista: um artista com contatos "todos" via o contratante de outro
 * artista com o histórico VAZIO — sem saber quem ele contratou, quando e onde,
 * que é exatamente a informação que o dono quer compartilhada. O sensível
 * continua fora por construção: esta resposta nunca carrega valor.
 *
 * Gate: mesmo padrão do GET do contratante — artista não é barrado no acesso
 * ao módulo (a visibilidade é por escopo), e contratante fora do escopo = 404.
 */
export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "artista") {
    const g = verificarAcessoContatos(r.sessao);
    if (g) return g;
  }

  try {
    // 404 (não 403) fora do escopo pra não vazar existência — mesmo padrão do
    // GET do contratante.
    const contratante = await buscarContratantePorId(r.sessao.supabase, params.id);
    if (
      !contratante ||
      !(await contratanteVisivelParaSessao(
        r.sessao.supabase,
        r.sessao,
        params.id,
        contratante.criadoPor ?? null
      ))
    ) {
      return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });
    }

    const { data, error } = await r.sessao.supabase
      .from("shows")
      .select(
        // SANITIZADO de propósito: nada de valor/cachê aqui. Ver doc acima.
        `id, data, status,
         cidade:cidades!shows_cidade_id_fkey ( nome, estado ),
         casa:casas!shows_casa_id_fkey ( nome ),
         artista:artists!shows_artist_id_fkey ( nome, cor )`
      )
      .eq("workspace_id", r.sessao.workspaceId)
      .eq("contratante_id", params.id)
      .order("data", { ascending: false })
      .limit(60);
    if (error) throw error;

    type Row = {
      id: string;
      data: string | null;
      status: string | null;
      cidade: { nome: string | null; estado: string | null } | null;
      casa: { nome: string | null } | null;
      artista: { nome: string | null; cor: string | null } | null;
    };
    const historico = ((data ?? []) as unknown as Row[]).map((s) => ({
      id: s.id,
      data: s.data,
      status: s.status ?? "confirmado",
      cidadeNome: s.cidade?.nome ?? "",
      cidadeUf: s.cidade?.estado ?? "",
      casaNome: s.casa?.nome ?? "",
      artistaNome: s.artista?.nome ?? "",
      artistaCor: s.artista?.cor ?? null,
    }));
    return NextResponse.json({ historico });
  } catch (e) {
    return respostaDeErro(e, "Falha ao buscar o histórico.");
  }
}
