import { NextResponse } from "next/server";
import municipiosBr from "@/data/municipios-br.json";
import { normalizar } from "@/lib/normalizar";

/**
 * GET /api/cidades-br?q=texto
 *
 * Autocomplete de município (BR) usado no cadastro de artista.
 *
 * O catálogo do IBGE (~5570 municípios) é embarcado no bundle como asset
 * estático — veja `src/data/municipios-br.json`, gerado por
 * `scripts/gerar-municipios-br.mjs` (`npm run municipios:gerar`). Ou seja,
 * NÃO há fetch em runtime:
 *
 *  1. Sem latência de cold start no Vercel. (Antes, cada cold start baixava
 *     ~3.2 MB do IBGE e ainda estourava o data cache do Next — limite de
 *     2 MB — enchendo os logs de erro a cada request.)
 *  2. Imune a instabilidade/queda da API do IBGE.
 *  3. Resposta em <10ms a partir de um índice em memória.
 *
 * Municípios mudam raríssimo; pra atualizar o catálogo, rode o script.
 *
 * Resposta: `{ cidades: [{ ibgeId, nome, uf }, ...] }` — top 20 que batem
 * com `q` (case-insensitive, ignora acentos).
 */

type MunicipioBase = { ibgeId: string; nome: string; uf: string };

type Municipio = MunicipioBase & { nomeNormalizado: string };

// Índice construído uma única vez (memoizado no módulo) a partir do catálogo
// estático. Sem estado de rede, sem TTL, sem cache pra invalidar.
let indice: Municipio[] | null = null;
function pegarMunicipios(): Municipio[] {
  if (!indice) {
    indice = (municipiosBr as MunicipioBase[]).map((m) => ({
      ...m,
      nomeNormalizado: normalizar(m.nome),
    }));
  }
  return indice;
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    // Evita devolver milhares de itens em busca vazia
    return NextResponse.json({ cidades: [] });
  }

  const todos = pegarMunicipios();
  const qn = normalizar(q);

  // Match por prefixo primeiro (relevância), depois substring
  const prefixo: Municipio[] = [];
  const contem: Municipio[] = [];
  for (const m of todos) {
    if (m.nomeNormalizado.startsWith(qn)) {
      prefixo.push(m);
    } else if (m.nomeNormalizado.includes(qn)) {
      contem.push(m);
    }
    if (prefixo.length >= 20) break;
  }

  const top = [...prefixo, ...contem].slice(0, 20).map((m) => ({
    ibgeId: m.ibgeId,
    nome: m.nome,
    uf: m.uf,
  }));

  return NextResponse.json({ cidades: top });
}
