import { NextResponse } from "next/server";
import { autenticarComWorkspace, type SessaoAutenticada } from "@/lib/api/session";
import { verificarAcessoContatos, aplicarFiltroShows } from "@/lib/api/permissoes";
import { artistasVisiveisNaSessao } from "@/lib/api/permissao";
import { respostaDeErro } from "@/lib/api/erros";
import { normalizar } from "@/lib/normalizar";
import { casaIdsVisiveis } from "@/lib/services/contatosAcesso";
import {
  nomesParecidos,
  enderecosParecidos,
  similaridadeTrigrama,
} from "@/lib/casaParecida";

/**
 * GET /api/contatos/casas/parecidas?nome=X&cidade_id=Y&endereco=Z (opcional)
 *
 * Irmão difuso do `/existe`. O dedupe EXATO (nome normalizado + cidade) reusa a
 * casa em silêncio; aqui entram os casos que ele não pega — "Downtown" vs
 * "Downtown Urban Club" na MESMA cidade nascem como duas casas. Devolve as
 * candidatas pro usuário DECIDIR (nunca mescla sozinho: falso-positivo gruda
 * dois locais reais num só, o que é pior que duplicar).
 *
 * Escopo é sempre UMA cidade (nome parecido em cidade diferente = casa
 * diferente — a Villa Mix de SP não é a de Goiânia), então a regra roda em JS
 * (ver `casaParecida.ts`) sobre poucas linhas, num lugar só.
 *
 * ANTI-BROWSE: exige nome E cidade_id, piso de 4 chars no nome, zero `ilike`
 * (filtro 100% em JS) e no máximo 3 candidatas. O sinal de `endereco` não
 * contorna o piso do nome: `enderecosParecidos` exige número dos dois lados
 * (D5 = número + rua), então endereço vago não casa nada.
 */

const MAX_CANDIDATAS = 3;
const MIN_NOME = 4;

type CandidataParecida =
  | {
      id: string;
      nome: string;
      endereco?: string;
      capacidade?: number;
      totalShows?: number;
      bloqueado?: boolean;
      oculta: false;
      motivo: "nome" | "endereco";
    }
  | { id: string; nome: string; oculta: true; motivo: "nome" | "endereco" };

type CasaRow = {
  id: string;
  nome: string | null;
  endereco: string | null;
  capacidade: number | null;
  bloqueado: boolean | null;
};

export async function GET(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  // Artista NÃO é barrado — mesmo motivo do `/existe`: o `casas` do contexto
  // dele é filtrado por visibilidade derivada, então este endpoint é o único
  // caminho que enxerga a casa que já existe. Barrar aqui mataria o dedupe pra
  // quem mais duplica. O que ele vê da casa oculta é redigido lá embaixo.
  if (r.sessao.papel !== "artista") {
    const g = verificarAcessoContatos(r.sessao);
    if (g) return g;
  }

  const url = new URL(request.url);
  const nome = url.searchParams.get("nome")?.trim() || "";
  const cidadeId = url.searchParams.get("cidade_id")?.trim() || "";
  const endereco = url.searchParams.get("endereco")?.trim() || "";
  if (!nome || !cidadeId) return NextResponse.json({ candidatas: [] });
  // Piso: "The"/"Bar"/"a" viraria enumeração do catálogo.
  const alvo = normalizar(nome);
  if (alvo.length < MIN_NOME) return NextResponse.json({ candidatas: [] });

  try {
    const { data, error } = await r.sessao.supabase
      .from("casas")
      .select("id, nome, endereco, capacidade, bloqueado")
      .eq("cidade_id", cidadeId)
      .is("deletado_em", null);
    if (error) throw error;

    const parecidas = ((data ?? []) as CasaRow[])
      // O match exato já foi reusado em silêncio pelo `/existe` — não perguntar.
      .filter((c) => normalizar(c.nome ?? "") !== alvo)
      .map((c) => {
        const motivo: "nome" | "endereco" | null = nomesParecidos(nome, c.nome ?? "")
          ? "nome"
          : enderecosParecidos(endereco, c.endereco ?? "")
            ? "endereco"
            : null;
        return { casa: c, motivo };
      })
      .filter(
        (x): x is { casa: CasaRow; motivo: "nome" | "endereco" } => x.motivo !== null
      )
      .sort((a, b) => {
        // Match por nome vem antes do endereço-only; dentro de cada grupo, o mais
        // parecido primeiro (o front pré-seleciona a primeira).
        if (a.motivo !== b.motivo) return a.motivo === "nome" ? -1 : 1;
        return (
          similaridadeTrigrama(alvo, normalizar(b.casa.nome ?? "")) -
          similaridadeTrigrama(alvo, normalizar(a.casa.nome ?? ""))
        );
      })
      .slice(0, MAX_CANDIDATAS);

    if (parecidas.length === 0) return NextResponse.json({ candidatas: [] });

    // Redação NO SERVIDOR: a candidata fora da visibilidade revela só o NOME (sem
    // ele o usuário não tem como decidir, e não decidir = duplicar), nunca
    // endereço/capacidade/shows. Nada de redigir no cliente — o valor viajaria.
    const visiveis = await casaIdsVisiveis(r.sessao.supabase, r.sessao);
    const podeVer = (id: string) => visiveis === "todos" || visiveis.has(id);
    const idsVisiveis = parecidas.map((p) => p.casa.id).filter(podeVer);
    const shows = await contarShows(r.sessao, idsVisiveis);

    const candidatas: CandidataParecida[] = parecidas.map(({ casa, motivo }) => {
      if (!podeVer(casa.id)) {
        return { id: casa.id, nome: casa.nome ?? "", oculta: true, motivo };
      }
      return {
        id: casa.id,
        nome: casa.nome ?? "",
        oculta: false,
        motivo,
        ...(casa.endereco ? { endereco: casa.endereco } : {}),
        ...(casa.capacidade != null ? { capacidade: casa.capacidade } : {}),
        ...(casa.bloqueado ? { bloqueado: true } : {}),
        // Visível + contagem confiável => manda o número (inclusive 0). `shows
        // === null` (query falhou, ou a sessão não enxerga a agenda inteira)
        // omite o campo: ausente significa "não sei", e mandar 0 nesse caso
        // seria mentira — a casa pode ter histórico.
        ...(shows ? { totalShows: shows.get(casa.id) ?? 0 } : {}),
      };
    });

    return NextResponse.json({ candidatas });
  } catch (e) {
    return respostaDeErro(e, "Falha ao buscar locais parecidos.");
  }
}

/**
 * Quantos shows já rolaram em cada casa — UMA query agregada em JS. O modal
 * rotula isso como "Shows realizados", um FATO SOBRE A CASA: só conta pra quem
 * enxerga a agenda inteira. Pra quem só alcança um artista o número seria a
 * contagem DELE ("Downtown — 0 shows" com 50 shows de outros artistas na
 * mesma casa), e o campo existe justamente pra decidir "é o mesmo local?" — um
 * 0 mentiroso empurra pra "é outro local", que é a duplicata que a feature veio
 * matar. Sem alcance total devolve `null` = "não sei" e o modal omite a linha.
 *
 * Best-effort: a busca de parecidas nunca falha por causa da contagem. `null`
 * também cobre a query com erro — que é diferente de "0 shows".
 */
async function contarShows(
  sessao: SessaoAutenticada,
  casaIds: string[]
): Promise<Map<string, number> | null> {
  const alcancaTudo =
    artistasVisiveisNaSessao(sessao, "agenda.ver") === "todos" ||
    artistasVisiveisNaSessao(sessao, "agenda.ver_detalhado") === "todos";
  if (!alcancaTudo) return null;
  const mapa = new Map<string, number>();
  if (casaIds.length === 0) return mapa;
  try {
    const q = sessao.supabase
      .from("shows")
      .select("casa_id")
      .in("casa_id", casaIds)
      .is("deletado_em", null);
    // `as never` + cast de volta: mesma receita do `listarShowsDoWorkspace`
    // (shows.service.ts) — sem isso o TS estoura em "type instantiation is
    // excessively deep" nos genéricos do query builder.
    const { data, error } = await (aplicarFiltroShows(q as never, sessao) as typeof q);
    if (error) throw error;
    for (const row of (data ?? []) as { casa_id: string | null }[]) {
      if (!row.casa_id) continue;
      mapa.set(row.casa_id, (mapa.get(row.casa_id) ?? 0) + 1);
    }
  } catch {
    return null;
  }
  return mapa;
}
