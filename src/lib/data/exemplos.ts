/**
 * Exemplos por país pra placeholders: cidades principais (campo de cidade)
 * e formato de endereço (campo de endereço). O texto do endereço já vem no
 * idioma/termos do país (CEP no BR, ZIP nos EUA, Código Postal, CAP, PLZ…)
 * — não passa pelo i18n de propósito.
 */

const CIDADES: Record<string, string[]> = {
  BR: ["São Paulo", "Rio de Janeiro"],
  US: ["New York", "Los Angeles"],
  PT: ["Lisboa", "Porto"],
  ES: ["Madrid", "Barcelona"],
  AR: ["Buenos Aires", "Córdoba"],
  MX: ["Ciudad de México", "Guadalajara"],
  CL: ["Santiago", "Valparaíso"],
  CO: ["Bogotá", "Medellín"],
  UY: ["Montevideo", "Punta del Este"],
  PY: ["Asunción", "Ciudad del Este"],
  PE: ["Lima", "Arequipa"],
  EC: ["Quito", "Guayaquil"],
  BO: ["La Paz", "Santa Cruz"],
  VE: ["Caracas", "Maracaibo"],
  FR: ["Paris", "Lyon"],
  IT: ["Roma", "Milão"],
  DE: ["Berlim", "Munique"],
  GB: ["Londres", "Manchester"],
  IE: ["Dublin", "Cork"],
  CA: ["Toronto", "Vancouver"],
  AU: ["Sydney", "Melbourne"],
  NZ: ["Auckland", "Wellington"],
  JP: ["Tóquio", "Osaka"],
  CN: ["Xangai", "Pequim"],
  KR: ["Seul", "Busan"],
  NL: ["Amsterdã", "Roterdã"],
  BE: ["Bruxelas", "Antuérpia"],
  CH: ["Zurique", "Genebra"],
  AT: ["Viena", "Salzburgo"],
  SE: ["Estocolmo", "Gotemburgo"],
  NO: ["Oslo", "Bergen"],
  DK: ["Copenhague", "Aarhus"],
  FI: ["Helsinque", "Espoo"],
  PL: ["Varsóvia", "Cracóvia"],
  GR: ["Atenas", "Tessalônica"],
  TR: ["Istambul", "Ancara"],
  RU: ["Moscou", "São Petersburgo"],
  ZA: ["Joanesburgo", "Cidade do Cabo"],
  AE: ["Dubai", "Abu Dhabi"],
  IN: ["Mumbai", "Nova Délhi"],
  SG: ["Singapura", "Jurong"],
};

export function exemploCidades(code: string | undefined): string[] {
  return CIDADES[(code ?? "").toUpperCase()] ?? [];
}

const ENDERECO: Record<string, string> = {
  BR: "Rua, número, bairro — CEP",
  US: "Street address, City, State ZIP",
  CA: "Street address, City, Province — Postal Code",
  GB: "Street, Town/City — Postcode",
  IE: "Street, Town — Eircode",
  PT: "Rua, número — Código Postal",
  ES: "Calle, número, ciudad — Código Postal",
  FR: "Rue, ville — Code postal",
  IT: "Via, città — CAP",
  DE: "Straße, Stadt — PLZ",
  AT: "Straße, Stadt — PLZ",
  CH: "Strasse, Stadt — PLZ",
  NL: "Straat, plaats — Postcode",
  MX: "Calle, colonia, ciudad — C.P.",
  AR: "Calle, ciudad — Código Postal",
  CL: "Calle, comuna, ciudad — Código Postal",
  CO: "Calle, ciudad — Código Postal",
  UY: "Calle, ciudad — Código Postal",
  PY: "Calle, ciudad — Código Postal",
  PE: "Calle, distrito, ciudad — Código Postal",
  JP: "郵便番号, 都道府県, 市区町村, 番地",
  AU: "Street, Suburb, State — Postcode",
  NZ: "Street, Suburb, City — Postcode",
};

const ENDERECO_PADRAO = "Street, city — postal/ZIP code";

export function exemploEndereco(code: string | undefined): string {
  return ENDERECO[(code ?? "").toUpperCase()] ?? ENDERECO_PADRAO;
}
