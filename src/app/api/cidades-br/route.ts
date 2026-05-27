import { NextResponse } from "next/server";

/**
 * GET /api/cidades-br?q=texto
 *
 * Proxy do catálogo de municípios do IBGE. Usado pelo autocomplete de
 * cidade no cadastro de artista. Por que proxy?
 *
 *  1. O endpoint do IBGE devolve TODOS os ~5570 municípios de uma vez
 *     (~5 MB). Não dá pra baixar isso no browser a cada digitação.
 *  2. CORS — chamar a API direto do client funciona, mas dá ruído de
 *     latência (Brasil → DF servidores IBGE). Aqui cacheamos em memória
 *     do servidor Next 24h e respondemos em <10ms.
 *
 * Resposta: `{ cidades: [{ ibgeId, nome, uf }, ...] }` — top 20 que
 * batem com `q` (case-insensitive, ignora acentos).
 */

type Municipio = {
  ibgeId: string;
  nome: string;
  nomeNormalizado: string;
  uf: string;
};

// Cache in-memory. Vive enquanto o Lambda/container do Next estiver vivo.
// Em produção (Vercel), cada cold start refaz; em dev, fica até `next dev`
// reiniciar.
let cache: { dados: Municipio[]; carregadoEm: number } | null = null;
const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const IBGE_URL =
  "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome";

/** Normaliza pra busca: minúsculo, sem acento, sem espaços extras. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (combining marks)
    .toLowerCase()
    .trim();
}

type IbgeMunicipio = {
  id: number;
  nome: string;
  microrregiao?: {
    mesorregiao?: {
      UF?: {
        sigla?: string;
      };
    };
  };
  // Em algumas versões da resposta vem direto em "regiao-imediata"
  "regiao-imediata"?: {
    "regiao-intermediaria"?: {
      UF?: {
        sigla?: string;
      };
    };
  };
};

function extrairUf(m: IbgeMunicipio): string {
  return (
    m.microrregiao?.mesorregiao?.UF?.sigla ??
    m["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla ??
    ""
  );
}

async function carregarMunicipios(): Promise<Municipio[]> {
  const res = await fetch(IBGE_URL, {
    // Cache de Next: usa o cache interno também por 24h
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) {
    throw new Error(`IBGE devolveu HTTP ${res.status}`);
  }
  const raw = (await res.json()) as IbgeMunicipio[];
  return raw.map((m) => ({
    ibgeId: String(m.id),
    nome: m.nome,
    nomeNormalizado: normalizar(m.nome),
    uf: extrairUf(m),
  }));
}

async function pegarMunicipios(): Promise<Municipio[]> {
  const agora = Date.now();
  if (cache && agora - cache.carregadoEm < TTL_MS) {
    return cache.dados;
  }
  const dados = await carregarMunicipios();
  cache = { dados, carregadoEm: agora };
  return dados;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    // Evita devolver milhares de itens em busca vazia
    return NextResponse.json({ cidades: [] });
  }

  try {
    const todos = await pegarMunicipios();
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
  } catch (e) {
    console.error("[cidades-br] falha:", (e as Error).message);
    return NextResponse.json(
      { cidades: [], erro: "Falha ao consultar o catálogo do IBGE." },
      { status: 502 }
    );
  }
}
