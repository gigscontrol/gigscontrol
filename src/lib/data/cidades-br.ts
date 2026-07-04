/**
 * UF → Região do Brasil (usado nos mappers de contato).
 *
 * O catálogo completo de municípios vive em `src/data/municipios-br.json` e é
 * servido pela rota `/api/cidades-br`; o autocomplete de cidade usa o
 * `CidadeGlobalAutocomplete` (via `/api/cidades-mundo` + `/api/cidades-br`).
 */

export type CidadeBR = {
  nome: string;
  uf: string;
  regiao: "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
};

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
