/**
 * Base de cidades brasileiras (client-side), a partir do catálogo estático
 * `src/data/municipios-br.json` (gerado por `scripts/gerar-municipios-br.mjs`).
 *
 * Estratégia:
 *  - O catálogo (~5570 municípios) é carregado sob demanda via dynamic import
 *    (code-split num chunk próprio, só baixa quando entra em modo BR). Sem
 *    baixar os ~3.2 MB do IBGE no browser nem depender da API estar no ar.
 *  - Depois de carregado: tudo em memória, busca instantânea.
 *  - Se o chunk falhar (raríssimo): cai pro fallback offline (capitais +
 *    cidades grandes).
 */

import { normalizar } from "@/lib/normalizar";

// Reexporta pra manter a API deste módulo (CityAutocomplete importa daqui).
export { normalizar };

export type CidadeBR = {
  nome: string;
  uf: string;
  regiao: "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
};

// ---------- Mapas auxiliares: UF → Região ----------
export function ufParaRegiao(uf: string | null | undefined): CidadeBR["regiao"] {
  if (!uf) return "Sudeste";
  return UF_REGIAO[uf.toUpperCase()] ?? "Sudeste";
}

const UF_REGIAO: Record<string, CidadeBR["regiao"]> = {
  // Norte
  AC: "Norte", AM: "Norte", AP: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  // Nordeste
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  // Centro-Oeste
  DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
  // Sudeste
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  // Sul
  PR: "Sul", RS: "Sul", SC: "Sul",
};

// ---------- Fallback offline (caso o catálogo não carregue) ----------
// Inclui capitais e cidades grandes — não é exaustivo, mas evita app travado.
const FALLBACK: CidadeBR[] = [
  { nome: "São Paulo", uf: "SP", regiao: "Sudeste" },
  { nome: "Rio de Janeiro", uf: "RJ", regiao: "Sudeste" },
  { nome: "Belo Horizonte", uf: "MG", regiao: "Sudeste" },
  { nome: "Vitória", uf: "ES", regiao: "Sudeste" },
  { nome: "Curitiba", uf: "PR", regiao: "Sul" },
  { nome: "Florianópolis", uf: "SC", regiao: "Sul" },
  { nome: "Porto Alegre", uf: "RS", regiao: "Sul" },
  { nome: "Salvador", uf: "BA", regiao: "Nordeste" },
  { nome: "Recife", uf: "PE", regiao: "Nordeste" },
  { nome: "Fortaleza", uf: "CE", regiao: "Nordeste" },
  { nome: "Natal", uf: "RN", regiao: "Nordeste" },
  { nome: "João Pessoa", uf: "PB", regiao: "Nordeste" },
  { nome: "Maceió", uf: "AL", regiao: "Nordeste" },
  { nome: "Aracaju", uf: "SE", regiao: "Nordeste" },
  { nome: "Teresina", uf: "PI", regiao: "Nordeste" },
  { nome: "São Luís", uf: "MA", regiao: "Nordeste" },
  { nome: "Brasília", uf: "DF", regiao: "Centro-Oeste" },
  { nome: "Goiânia", uf: "GO", regiao: "Centro-Oeste" },
  { nome: "Cuiabá", uf: "MT", regiao: "Centro-Oeste" },
  { nome: "Campo Grande", uf: "MS", regiao: "Centro-Oeste" },
  { nome: "Belém", uf: "PA", regiao: "Norte" },
  { nome: "Manaus", uf: "AM", regiao: "Norte" },
  { nome: "Porto Velho", uf: "RO", regiao: "Norte" },
  { nome: "Palmas", uf: "TO", regiao: "Norte" },
  { nome: "Rio Branco", uf: "AC", regiao: "Norte" },
  { nome: "Macapá", uf: "AP", regiao: "Norte" },
  { nome: "Boa Vista", uf: "RR", regiao: "Norte" },
  { nome: "Guarulhos", uf: "SP", regiao: "Sudeste" },
  { nome: "Campinas", uf: "SP", regiao: "Sudeste" },
  { nome: "São José dos Pinhais", uf: "PR", regiao: "Sul" },
  { nome: "São José dos Campos", uf: "SP", regiao: "Sudeste" },
  { nome: "São José do Rio Preto", uf: "SP", regiao: "Sudeste" },
  { nome: "Niterói", uf: "RJ", regiao: "Sudeste" },
  { nome: "Santos", uf: "SP", regiao: "Sudeste" },
  { nome: "Sorocaba", uf: "SP", regiao: "Sudeste" },
  { nome: "Joinville", uf: "SC", regiao: "Sul" },
  { nome: "Blumenau", uf: "SC", regiao: "Sul" },
  { nome: "Londrina", uf: "PR", regiao: "Sul" },
  { nome: "Maringá", uf: "PR", regiao: "Sul" },
  { nome: "Caxias do Sul", uf: "RS", regiao: "Sul" },
  { nome: "Uberlândia", uf: "MG", regiao: "Sudeste" },
  { nome: "Ribeirão Preto", uf: "SP", regiao: "Sudeste" },
  { nome: "Balneário Camboriú", uf: "SC", regiao: "Sul" },
];

// ---------- Estado em memória + Promise compartilhada ----------
let cache: CidadeBR[] | null = null;
let indice: Array<CidadeBR & { busca: string }> | null = null;
let promessaCarga: Promise<CidadeBR[]> | null = null;

function construirIndice(arr: CidadeBR[]) {
  return arr.map((c) => ({ ...c, busca: normalizar(c.nome) }));
}

/**
 * Carrega o catálogo de cidades (uma única vez por sessão).
 * Retorna a Promise; chamadas simultâneas compartilham a mesma carga.
 */
export function carregarCidadesBR(): Promise<CidadeBR[]> {
  if (cache) return Promise.resolve(cache);
  if (promessaCarga) return promessaCarga;

  promessaCarga = import("@/data/municipios-br.json")
    .then((mod) => {
      const dados: CidadeBR[] = (
        mod.default as Array<{ nome: string; uf: string }>
      ).map((m) => ({
        nome: m.nome,
        uf: m.uf,
        regiao: UF_REGIAO[m.uf] ?? "Sudeste",
      }));
      cache = dados;
      indice = construirIndice(dados);
      return dados;
    })
    .catch((err) => {
      console.warn(
        "[cidades-br] falha ao carregar catálogo, usando fallback offline:",
        err
      );
      cache = FALLBACK;
      indice = construirIndice(FALLBACK);
      return FALLBACK;
    });

  return promessaCarga;
}

/**
 * Busca cidades pela string digitada.
 * Se a base ainda não carregou, devolve apenas resultados do fallback enquanto
 * o catálogo carrega — e o componente refaz a busca quando a Promise resolver.
 */
export function buscarCidades(query: string, limit = 12): CidadeBR[] {
  const q = normalizar(query.trim());
  if (q.length < 2) return [];

  // Inicia a carga em background (não bloqueia)
  if (!cache && !promessaCarga) carregarCidadesBR();

  // Usa o índice carregado OU o fallback enquanto não carrega
  const fonte = indice ?? construirIndice(FALLBACK);

  const prefix: typeof fonte = [];
  const includes: typeof fonte = [];
  for (const c of fonte) {
    if (c.busca.startsWith(q)) prefix.push(c);
    else if (c.busca.includes(q)) includes.push(c);
    if (prefix.length >= limit) break;
  }

  return [...prefix, ...includes]
    .slice(0, limit)
    .map(({ busca: _, ...rest }) => rest);
}

/** Saber se ainda estamos no fallback (catálogo não carregado). */
export function estaCarregando(): boolean {
  return cache === null;
}

/** Lista exposta — só pra debug. */
export function getCidadesCarregadas(): CidadeBR[] {
  return cache ?? FALLBACK;
}
