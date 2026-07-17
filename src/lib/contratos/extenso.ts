/**
 * Por extenso (data + cachê) para o contrato gerado — helper PRÓPRIO, sem
 * dependência nova. Determinístico (sem `Intl`, sem `new Date()` — o fuso já
 * mordeu este projeto). Segue o idioma do MODELO (os 6 do app); a moeda fica
 * "reais" em todos por praxe jurídica ("reales" em es, "Reais" em de — nome
 * próprio da moeda, com a flexão mínima que cada língua realmente usa).
 */
import type { IdiomaModelo } from "@/lib/mappers/contratoModelo";

// ---------------- Números por extenso (PT) ----------------

const UNI_PT = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
];
const DEZ10_PT = [
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis",
  "dezessete", "dezoito", "dezenove",
];
const DEZ_PT = [
  "", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta",
  "oitenta", "noventa",
];
const CEM_PT = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
];

/** Grupo de 1..999 por extenso (PT). */
function grupoPt(n: number): string {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CEM_PT[c]);
  if (resto > 0) {
    if (resto < 10) partes.push(UNI_PT[resto]);
    else if (resto < 20) partes.push(DEZ10_PT[resto - 10]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${DEZ_PT[d]} e ${UNI_PT[u]}` : DEZ_PT[d]);
    }
  }
  return partes.join(" e ");
}

/** Inteiro 0..999.999.999 por extenso (PT), com o "e" nas junções de escala. */
function inteiroPt(n: number): string {
  if (n === 0) return "zero";
  const grupos: { v: number; w: string }[] = [];
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const unidade = n % 1000;
  if (milhoes > 0)
    grupos.push({ v: milhoes, w: milhoes === 1 ? "um milhão" : `${grupoPt(milhoes)} milhões` });
  if (milhares > 0)
    grupos.push({ v: milhares, w: milhares === 1 ? "mil" : `${grupoPt(milhares)} mil` });
  if (unidade > 0) grupos.push({ v: unidade, w: grupoPt(unidade) });
  if (grupos.length === 1) return grupos[0].w;
  const ultimo = grupos[grupos.length - 1];
  const inicio = grupos.slice(0, -1).map((g) => g.w).join(", ");
  // "e" antes do último grupo quando ele é < 100 ou múltiplo redondo de 100.
  const usaE = ultimo.v < 100 || ultimo.v % 100 === 0;
  return usaE ? `${inicio} e ${ultimo.w}` : `${inicio}, ${ultimo.w}`;
}

// ---------------- Números por extenso (EN) ----------------

const UNI_EN = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen",
];
const DEZ_EN = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty",
  "ninety",
];

/** Grupo de 1..999 por extenso (EN). */
function grupoEn(n: number): string {
  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c > 0) partes.push(`${UNI_EN[c]} hundred`);
  if (resto > 0) {
    if (resto < 20) partes.push(UNI_EN[resto]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${DEZ_EN[d]}-${UNI_EN[u]}` : DEZ_EN[d]);
    }
  }
  return partes.join(" ");
}

/** Inteiro 0..999.999.999 por extenso (EN). */
function inteiroEn(n: number): string {
  if (n === 0) return "zero";
  const partes: string[] = [];
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const unidade = n % 1000;
  if (milhoes > 0) partes.push(`${grupoEn(milhoes)} million`);
  if (milhares > 0) partes.push(`${grupoEn(milhares)} thousand`);
  if (unidade > 0) partes.push(grupoEn(unidade));
  return partes.join(" ");
}

// ---------------- Números por extenso (ES) ----------------

const UNI_ES = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho",
  "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis",
  "diecisiete", "dieciocho", "diecinueve",
];
const VEINTI_ES = [
  "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro",
  "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const DEZ_ES = [
  "", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta",
  "ochenta", "noventa",
];
const CEM_ES = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos",
];

/**
 * Grupo 1..999 (ES). Contexto é sempre monetário (antecede substantivo
 * masculino: reales/mil/millón), então a apócope se aplica SEMPRE:
 * "uno"→"un", "veintiuno"→"veintiún" ("veintiún mil", "treinta y un reales").
 */
function grupoEs(n: number): string {
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CEM_ES[c]);
  if (resto > 0) {
    if (resto < 20) partes.push(UNI_ES[resto]);
    else if (resto < 30) partes.push(VEINTI_ES[resto - 20]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${DEZ_ES[d]} y ${UNI_ES[u]}` : DEZ_ES[d]);
    }
  }
  return partes
    .join(" ")
    .replace(/veintiuno$/, "veintiún")
    .replace(/\buno$/, "un");
}

function inteiroEs(n: number): string {
  if (n === 0) return "cero";
  const partes: string[] = [];
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const unidade = n % 1000;
  if (milhoes > 0)
    partes.push(milhoes === 1 ? "un millón" : `${grupoEs(milhoes)} millones`);
  if (milhares > 0)
    partes.push(milhares === 1 ? "mil" : `${grupoEs(milhares)} mil`);
  if (unidade > 0) partes.push(grupoEs(unidade));
  return partes.join(" ");
}

// ---------------- Números por extenso (FR) ----------------

const UNI_FR = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit",
  "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];
const DEZ_FR = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

/** Dezenas 20..99 (FR), com soixante-dix / quatre-vingt(s) / quatre-vingt-dix. */
function dezenaFr(n: number): string {
  if (n < 20) return UNI_FR[n];
  if (n < 70) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return DEZ_FR[d];
    if (u === 1) return `${DEZ_FR[d]} et un`;
    return `${DEZ_FR[d]}-${UNI_FR[u]}`;
  }
  if (n < 80) return n === 71 ? "soixante et onze" : `soixante-${UNI_FR[n - 60]}`;
  if (n === 80) return "quatre-vingts";
  return `quatre-vingt-${dezenaFr(n - 80)}`;
}

/** Grupo 1..999 (FR). "cent"/"cents" com o s só quando termina o grupo. */
function grupoFr(n: number): string {
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c === 0) return dezenaFr(resto);
  const cem = c === 1 ? "cent" : resto === 0 ? `${UNI_FR[c]} cents` : `${UNI_FR[c]} cent`;
  return resto === 0 ? cem : `${cem} ${dezenaFr(resto)}`;
}

/** "quatre-vingts"/"deux cents" perdem o s diante de "mille" (numeral). */
const semSFinalFr = (s: string) => s.replace(/(vingt|cent)s$/, "$1");

function inteiroFr(n: number): string {
  if (n === 0) return "zéro";
  const partes: string[] = [];
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const unidade = n % 1000;
  if (milhoes > 0)
    partes.push(milhoes === 1 ? "un million" : `${grupoFr(milhoes)} millions`);
  if (milhares > 0)
    partes.push(milhares === 1 ? "mille" : `${semSFinalFr(grupoFr(milhares))} mille`);
  if (unidade > 0) partes.push(grupoFr(unidade));
  return partes.join(" ");
}

// ---------------- Números por extenso (DE) ----------------

const UNI_DE = [
  "null", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht",
  "neun", "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn",
  "sechzehn", "siebzehn", "achtzehn", "neunzehn",
];
const DEZ_DE = [
  "", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig",
  "achtzig", "neunzig",
];

/** Grupo 1..999 (DE), composto numa palavra: "einhundertfünfundzwanzig". */
function grupoDe(n: number): string {
  const c = Math.floor(n / 100);
  const resto = n % 100;
  let s = c > 0 ? `${UNI_DE[c]}hundert` : "";
  if (resto > 0) {
    if (resto < 20) s += UNI_DE[resto];
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      s += u > 0 ? `${UNI_DE[u]}und${DEZ_DE[d]}` : DEZ_DE[d];
    }
  }
  return s;
}

/** Inteiro (DE). Milhão é palavra separada; o resto compõe numa palavra só. */
function inteiroDe(n: number): string {
  if (n === 0) return "null";
  const milhoes = Math.floor(n / 1_000_000);
  const resto6 = n % 1_000_000;
  const milhares = Math.floor(resto6 / 1000);
  const unidade = resto6 % 1000;
  let compacto = "";
  if (milhares > 0) compacto += `${grupoDe(milhares)}tausend`;
  if (unidade > 0) compacto += grupoDe(unidade);
  const partes: string[] = [];
  if (milhoes > 0)
    partes.push(milhoes === 1 ? "eine Million" : `${grupoDe(milhoes)} Millionen`);
  if (compacto) partes.push(compacto);
  return partes.join(" ");
}

// ---------------- Números por extenso (IT) ----------------

const UNI_IT = [
  "zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto",
  "nove", "dieci", "undici", "dodici", "tredici", "quattordici", "quindici",
  "sedici", "diciassette", "diciotto", "diciannove",
];
const DEZ_IT = [
  "", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta",
  "ottanta", "novanta",
];

/** Dezenas 20..99 (IT), com elisão antes de uno/otto e "-tré" acentuado. */
function dezenaIt(n: number): string {
  if (n < 20) return UNI_IT[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  const base = DEZ_IT[d];
  if (u === 0) return base;
  if (u === 1 || u === 8) return base.slice(0, -1) + UNI_IT[u]; // ventuno, ventotto
  if (u === 3) return `${base}tré`; // ventitré
  return base + UNI_IT[u];
}

/** Grupo 1..999 (IT), composto: "trecentoquarantadue"; "centottanta" elide. */
function grupoIt(n: number): string {
  const c = Math.floor(n / 100);
  const resto = n % 100;
  let cem = c === 0 ? "" : c === 1 ? "cento" : `${UNI_IT[c]}cento`;
  if (resto === 0) return cem;
  const dez = dezenaIt(resto);
  if (cem && dez.startsWith("o")) cem = cem.slice(0, -1); // cent+ottanta
  return cem + dez;
}

function inteiroIt(n: number): string {
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000);
  const resto6 = n % 1_000_000;
  const milhares = Math.floor(resto6 / 1000);
  const unidade = resto6 % 1000;
  let compacto = "";
  if (milhares > 0) compacto += milhares === 1 ? "mille" : `${grupoIt(milhares)}mila`;
  if (unidade > 0) compacto += grupoIt(unidade);
  const partes: string[] = [];
  if (milhoes > 0)
    partes.push(milhoes === 1 ? "un milione" : `${grupoIt(milhoes)} milioni`);
  if (compacto) partes.push(compacto);
  return partes.join(" ");
}

// ---------------- API pública ----------------

/**
 * Regras monetárias por idioma: numerador, moeda (a flexão que a língua usa de
 * verdade pro real brasileiro), centavos, conector, e a preposição de milhão
 * exato ("um milhão DE reais" pt/es/fr, "di" it; de/en não usam).
 */
const MOEDA: Record<
  IdiomaModelo,
  {
    n: (v: number) => string;
    real: [string, string];
    cent: [string, string];
    e: string;
    deMilhao: string;
  }
> = {
  pt: { n: inteiroPt, real: ["real", "reais"], cent: ["centavo", "centavos"], e: " e ", deMilhao: "de " },
  en: { n: inteiroEn, real: ["real", "reais"], cent: ["cent", "cents"], e: " and ", deMilhao: "" },
  es: { n: inteiroEs, real: ["real", "reales"], cent: ["centavo", "centavos"], e: " con ", deMilhao: "de " },
  fr: { n: inteiroFr, real: ["real", "reais"], cent: ["centavo", "centavos"], e: " et ", deMilhao: "de " },
  de: { n: inteiroDe, real: ["Real", "Reais"], cent: ["Centavo", "Centavos"], e: " und ", deMilhao: "" },
  it: { n: inteiroIt, real: ["real", "reais"], cent: ["centavo", "centavi"], e: " e ", deMilhao: "di " },
};

/**
 * Cachê por extenso no idioma do MODELO. Ex.: 3500.50 →
 *   PT "três mil e quinhentos reais e cinquenta centavos"
 *   EN "three thousand five hundred reais and fifty cents"
 *   ES "tres mil quinientos reales con cincuenta centavos"
 * Cobre 0..999.999.999 reais; valor ≤ 0 / não-finito / fora do alcance → "".
 */
export function cachePorExtenso(valor: number, idioma: IdiomaModelo): string {
  if (!Number.isFinite(valor) || valor <= 0) return "";
  // Centavos por inteiro pra não escorregar no float (nunca `valor % 1`).
  const cents = Math.round(valor * 100);
  const inteiro = Math.floor(cents / 100);
  const cent = cents % 100;
  if (inteiro > 999_999_999) return "";

  const m = MOEDA[idioma] ?? MOEDA.pt;
  const partes: string[] = [];
  if (inteiro > 0) {
    // Milhão exato exige a preposição ("um milhão DE reais" / "di reais").
    const de = inteiro % 1_000_000 === 0 ? m.deMilhao : "";
    partes.push(`${m.n(inteiro)} ${de}${inteiro === 1 ? m.real[0] : m.real[1]}`);
  }
  if (cent > 0) partes.push(`${m.n(cent)} ${cent === 1 ? m.cent[0] : m.cent[1]}`);
  return partes.join(m.e);
}

const MESES: Record<IdiomaModelo, string[]> = {
  pt: [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
    "agosto", "setembro", "outubro", "novembro", "dezembro",
  ],
  en: [
    "January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December",
  ],
  es: [
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
    "septiembre", "octubre", "noviembre", "diciembre",
  ],
  fr: [
    "janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
    "septembre", "octobre", "novembre", "décembre",
  ],
  de: [
    "Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August",
    "September", "Oktober", "November", "Dezember",
  ],
  it: [
    "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
    "agosto", "settembre", "ottobre", "novembre", "dicembre",
  ],
};

/**
 * Data (YYYY-MM-DD) por extenso, no idioma do modelo. Parse por split (mesma
 * tolerância do `dataBR`, zero `new Date()`). Ex.:
 *   PT "19 de dezembro de 2026"  EN "December 19, 2026"  ES "19 de diciembre de 2026"
 *   FR "19 décembre 2026"        DE "19. Dezember 2026"  IT "19 dicembre 2026"
 * Formato inválido → "".
 */
export function dataPorExtenso(
  iso: string | null | undefined,
  idioma: IdiomaModelo
): string {
  if (!iso) return "";
  const partes = iso.slice(0, 10).split("-");
  if (partes.length !== 3) return "";
  const ano = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || !Number.isInteger(dia)) return "";
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return "";
  const nomeMes = (MESES[idioma] ?? MESES.pt)[mes - 1];
  switch (idioma) {
    case "en":
      return `${nomeMes} ${dia}, ${ano}`;
    case "fr":
      // "1er décembre" é a praxe; os demais dias vão em algarismo puro.
      return `${dia === 1 ? "1er" : dia} ${nomeMes} ${ano}`;
    case "de":
      return `${dia}. ${nomeMes} ${ano}`;
    case "it":
      return `${dia} ${nomeMes} ${ano}`;
    case "es":
      return `${dia} de ${nomeMes} de ${ano}`;
    default:
      return `${dia} de ${nomeMes} de ${ano}`;
  }
}
