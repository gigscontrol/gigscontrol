/**
 * Normalização de telefone BRASILEIRO pra dedupe e colagem — o telefone é a
 * CHAVE DE IDENTIDADE do contratante (1 telefone = 1 contato), então quem
 * grava e quem compara precisam enxergar o mesmo número através de qualquer
 * formatação: "(47) 98809-8323", "47 8809 8323", "+55 47 98809-8323",
 * "554788098323"…
 *
 * A pegadinha real (caso vivo no banco): números salvos SEM o nono dígito
 * (DDD + 8 dígitos, era o formato antigo de celular). Colar o MESMO número
 * com o 9 nunca casava na comparação exata. Regra da Anatel: celular começa
 * com 6-9 → ganha o 9 na frente; fixo começa com 2-5 → NUNCA ganha 9.
 *
 * NÃO reescrevemos telefones já salvos — a comparação é que iguala (via
 * `variantesTelefone`, um conjunto FINITO de formas exatas pra `.in()` no
 * banco; nada de ilike, o anti-browse do /existe continua valendo).
 */

const soDigitos = (s: string): string => (s ?? "").replace(/\D/g, "");

/** Parece um número BR? (com/sem DDI 55, DDD + 8/9 dígitos.) */
function pareceBR(digs: string): boolean {
  if (digs.startsWith("55") && (digs.length === 12 || digs.length === 13)) return true;
  return digs.length === 10 || digs.length === 11;
}

/** DDD + local de um número BR já sem DDI. */
function separarBR(semDdi: string): { ddd: string; local: string } {
  return { ddd: semDdi.slice(0, 2), local: semDdi.slice(2) };
}

/**
 * Forma canônica: "55" + DDD + local com o 9 garantido (celular) — E.164 sem
 * "+", o formato que o banco usa. Celular de 8 dígitos (começa 6-9) ganha o 9;
 * fixo (começa 2-5) fica com 8. Não-BR (ou irreconhecível): só dígitos, com
 * eventual "00" internacional removido.
 */
export function canonicalizarTelefoneBR(raw: string): string {
  let digs = soDigitos(raw);
  if (digs.startsWith("00")) digs = digs.slice(2); // discagem internacional
  if (!pareceBR(digs)) return digs;

  const semDdi = digs.startsWith("55") && digs.length >= 12 ? digs.slice(2) : digs;
  const { ddd, local } = separarBR(semDdi);
  const celularSemNove = local.length === 8 && /^[6-9]/.test(local);
  const localFinal = celularSemNove ? `9${local}` : local;
  return `55${ddd}${localFinal}`;
}

/**
 * As formas EXATAS que o número pode ter no banco (com/sem 55, com/sem o 9)
 * — pra `.in("telefone", variantes)`. Conjunto finito e pequeno: o endpoint
 * continua sem browse (nenhum curinga).
 */
export function variantesTelefone(raw: string): string[] {
  let digs = soDigitos(raw);
  if (digs.startsWith("00")) digs = digs.slice(2);
  if (!digs) return [];
  if (!pareceBR(digs)) return [digs];

  const semDdi = digs.startsWith("55") && digs.length >= 12 ? digs.slice(2) : digs;
  const { ddd, local } = separarBR(semDdi);
  const locais = new Set<string>([local]);
  // celular: a variante com e sem o nono dígito
  if (local.length === 8 && /^[6-9]/.test(local)) locais.add(`9${local}`);
  if (local.length === 9 && local.startsWith("9") && /^[6-9]/.test(local[1]))
    locais.add(local.slice(1));

  const out = new Set<string>();
  for (const l of locais) {
    out.add(`55${ddd}${l}`);
    out.add(`${ddd}${l}`);
  }
  return [...out];
}

/** O mesmo número, através de qualquer formatação? */
export function telefonesIguais(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  const ca = canonicalizarTelefoneBR(a);
  const cb = canonicalizarTelefoneBR(b);
  return ca !== "" && ca === cb;
}
