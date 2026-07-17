import { normalizar } from "@/lib/normalizar";

/**
 * Regra de MATCH DIFUSO de casa (local) — usada só pelo endpoint
 * `/api/contatos/casas/parecidas`, sempre dentro de UMA cidade.
 *
 * Por que não um limiar único de similaridade: as armadilhas pontuam MAIS ALTO
 * que o acerto verdadeiro (medido no banco real):
 *   "downtown" vs "downtown urban club" (MESMO)        -> 0.42
 *   "win club" vs "wine club" (DIFERENTES)             -> 0.73
 *   "downtown urban club" vs "uptown urban club" (DIF) -> 0.64
 *   "club the hall" vs "club the wall" (DIFERENTES)    -> 0.65
 *   "downtown urban club" vs "downtown urban clube"    -> 0.857 (typo, MESMO)
 * Limiar 0.42 pegaria "wine club" junto; limiar 0.73 perderia o caso real.
 * Nenhum limiar único funciona — por isso a regra é a disjunção (a)|(b)|(c):
 *   (a) igual ignorando espaços     -> "win club" ≡ "winclub"
 *   (b) subconjunto de palavras     -> "downtown" ⊂ "downtown urban club"
 *   (c) similaridade trigrama >=.85 -> só pra typo
 * Trocar isso por um limiar só QUEBRA a feature.
 */

/**
 * Palavras genéricas demais pra sustentar a regra (b) sozinhas: "club" ⊂ "club
 * the hall" enumeraria o catálogo inteiro. Lista literal e fechada — artigos e
 * preposições ("the", "do", "da") NÃO entram: é justamente "the" que faz
 * "the hall" ⊂ "club the hall" disparar (caso legítimo).
 */
export const GENERICAS: ReadonlySet<string> = new Set([
  "club",
  "clube",
  "bar",
  "casa",
  "arena",
  "espaco",
  "salao",
  "teatro",
  "pub",
  "lounge",
  "hall",
]);

/**
 * Trigramas no formato do pg_trgm: quebra por não-alfanumérico e cada palavra
 * vira "  palavra " (DOIS espaços antes, UM depois) antes das janelas de 3.
 * Espera a string JÁ normalizada (equivalente do `unaccent(lower(x))`).
 */
function trigramas(s: string): Set<string> {
  const set = new Set<string>();
  for (const palavra of s.split(/[^a-z0-9]+/).filter(Boolean)) {
    const pad = `  ${palavra} `;
    for (let i = 0; i + 3 <= pad.length; i++) set.add(pad.slice(i, i + 3));
  }
  return set;
}

/**
 * `similarity()` do pg_trgm = Jaccard sobre os sets de trigramas. Recebe strings
 * JÁ normalizadas. Porta validada contra os números medidos no banco real.
 */
export function similaridadeTrigrama(a: string, b: string): number {
  const setA = trigramas(a);
  const setB = trigramas(b);
  let intersecao = 0;
  for (const t of setA) if (setB.has(t)) intersecao++;
  const uniao = setA.size + setB.size - intersecao;
  return uniao === 0 ? 0 : intersecao / uniao;
}

/**
 * Tokenização ÚNICA das três regras — a MESMA de `trigramas` (quebra por
 * não-alfanumérico). `normalizar` não tira pontuação, então quebrar só por
 * espaço faria (a) e (b) enxergarem a pontuação COLADA na palavra
 * ("villa-mix", "downtown," e "hall/curitiba" viram um token só) enquanto (c) a
 * ignora: "Downtown" ⊄ "Downtown, Urban Club" mataria o caso do dono só porque
 * tinha uma vírgula. Alinhar as três também faz a guarda D4 comparar tokens
 * limpos contra GENERICAS ("club." não estava no Set e furava a guarda).
 */
const palavrasDe = (n: string): string[] => n.split(/[^a-z0-9]+/).filter(Boolean);
const semEspacos = (n: string): string => n.replace(/[^a-z0-9]+/g, "");

/**
 * Teto de palavras da regra (b). Os casos calibrados precisam de pouco:
 * "downtown"(1) ⊂ "downtown urban club"(3) = 2 de diferença; "the hall"(2) ⊂
 * "club the hall"(3) = 1. Sem teto, (b) é simétrica e sem limite do lado longo
 * — um nome-sonda com um saco de palavras comuns casaria QUALQUER casa feita só
 * dessas palavras, e o endpoint (que se documenta como anti-browse) viraria um
 * enumerador do catálogo pra quem não enxerga a lista.
 */
const MAX_DIF_PALAVRAS = 3;

/** Regra D2 completa — (a) | (b) | (c), com a guarda D4 em (b). */
export function nomesParecidos(a: string, b: string): boolean {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (!na || !nb) return false;

  // (a) igual ignorando espaços — cobre também o caso exato.
  if (semEspacos(na) === semEspacos(nb)) return true;

  // (b) subconjunto de palavras. D4: se o lado que é subconjunto for feito SÓ de
  // palavras genéricas, (b) não vale — ruído demais. (a) e (c) seguem valendo.
  const pa = palavrasDe(na);
  const pb = palavrasDe(nb);
  const setA = new Set(pa);
  const setB = new Set(pb);
  const aSubB = pa.every((w) => setB.has(w));
  const bSubA = pb.every((w) => setA.has(w));
  if ((aSubB || bSubA) && Math.abs(setA.size - setB.size) <= MAX_DIF_PALAVRAS) {
    const curto = aSubB ? pa : pb;
    if (!curto.every((w) => GENERICAS.has(w))) return true;
  }

  // (c) typo.
  return similaridadeTrigrama(na, nb) >= 0.85;
}

/**
 * Normaliza endereço pra comparação: o `normalizar` canônico + abreviações de
 * logradouro + pontuação virando espaço. Nunca modifica o `normalizar` (fonte
 * única casada com `/api/cidades-br`) — só constrói em cima dele.
 */
function normalizarEndereco(s: string): string {
  const base = normalizar(s)
    .replace(/[.,;/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base
    .split(" ")
    .map((p) => {
      if (p === "r" || p === "rua") return "rua";
      if (p === "av" || p === "avenida") return "avenida";
      if (p === "pca" || p === "praca") return "praca";
      return p;
    })
    .join(" ")
    .trim();
}

function primeiroNumero(s: string): string | null {
  const m = s.match(/\d+/);
  return m ? m[0] : null;
}

/**
 * D5 — endereço como 2º sinal, dentro da MESMA cidade (casa que trocou de nome).
 * Conservador de propósito: NÚMERO + NOME DA RUA já resolve, e é literalmente
 * isso que a regra exige.
 *
 * O número é obrigatório dos DOIS lados: sem ele o texto sozinho não é o sinal
 * calibrado — "Centro" x "Centro" (ou "Av. Brasil", "Zona Sul", "s/n", que são
 * texto livre no form de venda) casaria dois locais reais distintos e abriria a
 * pergunta com o badge "Endereço parecido", que é o falso-positivo que o D6 diz
 * ser PIOR que duplicar. Isso também fecha o furo do `nome` lixo: o piso de
 * nome do endpoint não podia ser contornado por um endereço vago
 * (`?nome=zzzz&endereco=avenida paulista` não casa mais nada).
 * Números diferentes NUNCA disparam (o sinal mais forte de locais distintos).
 */
export function enderecosParecidos(a?: string, b?: string): boolean {
  const na = normalizarEndereco(a ?? "");
  const nb = normalizarEndereco(b ?? "");
  if (!na || !nb) return false;

  const numA = primeiroNumero(na);
  const numB = primeiroNumero(nb);
  if (numA === null || numB === null) return false;
  if (numA !== numB) return false;

  const palavrasA = palavrasSemNumero(na);
  const palavrasB = palavrasSemNumero(nb);
  if (palavrasA.length === 0 || palavrasB.length === 0) return false;

  const textoA = palavrasA.join(" ");
  const textoB = palavrasB.join(" ");
  if (semEspacos(textoA) === semEspacos(textoB)) return true;

  // Mesmo número + a rua de um lado sendo o COMEÇO do outro = complemento no
  // fim ("Rua das Flores, 100" x "Rua das Flores, 100 - Loja 2" / bairro /
  // "Térreo"), que é comum em dado real e derrubava a igualdade e o trigrama.
  // O lado curto precisa de 2+ palavras: só "rua" seria prefixo de toda rua da
  // cidade que tivesse o mesmo número.
  const menor = palavrasA.length <= palavrasB.length ? palavrasA : palavrasB;
  const maior = palavrasA.length <= palavrasB.length ? palavrasB : palavrasA;
  if (menor.length >= 2 && menor.every((w, i) => maior[i] === w)) return true;

  return similaridadeTrigrama(textoA, textoB) >= 0.85;
}

/** Palavras do endereço já normalizado, sem os números (que casam à parte). */
function palavrasSemNumero(n: string): string[] {
  return palavrasDe(n).filter((p) => !/^\d+$/.test(p));
}
