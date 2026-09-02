/**
 * Detecção do TIPO de uma chave PIX pelo próprio valor digitado (cadastro do
 * artista): conta os dígitos e valida o que dá pra validar.
 *
 *  - contém "@"                        → e-mail
 *  - formato UUID (8-4-4-4-12 hex)     → chave aleatória
 *  - começa com "+"                    → telefone (E.164)
 *  - 14 dígitos                        → CNPJ (com dígitos verificadores)
 *  - 11 dígitos                        → CPF se os dígitos verificadores
 *                                        fecham; senão celular (DDD + 9…)
 *  - 10 dígitos                        → telefone fixo
 *
 * A ambiguidade CPF × celular (ambos têm 11 dígitos) é resolvida pela
 * validação real do CPF — a chance de um celular passar nos 2 dígitos
 * verificadores é ~1%, e nesse caso raro o dono confere pelo rótulo exibido.
 */

export type TipoChavePix =
  | "cpf"
  | "cnpj"
  | "email"
  | "telefone"
  | "aleatoria"
  | "desconhecida";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function digitos(s: string): string {
  return s.replace(/\D/g, "");
}

/** Validação REAL de CPF (dígitos verificadores, módulo 11). */
export function cpfValido(valor: string): boolean {
  const d = digitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (corte: number): number => {
    let soma = 0;
    for (let i = 0; i < corte; i++) soma += Number(d[i]) * (corte + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** Validação REAL de CNPJ (dígitos verificadores). */
export function cnpjValido(valor: string): boolean {
  const d = digitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (corte: number): number => {
    const pesos =
      corte === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < corte; i++) soma += Number(d[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

/**
 * Detecta o tipo da chave. null = campo vazio (nada a mostrar);
 * "desconhecida" = tem conteúdo mas não bate com nenhum formato de chave.
 */
export function detectarChavePix(chave: string): TipoChavePix | null {
  const v = chave.trim();
  if (!v) return null;
  if (v.includes("@")) return EMAIL_RE.test(v) ? "email" : "desconhecida";
  if (UUID_RE.test(v)) return "aleatoria";
  const d = digitos(v);
  if (v.startsWith("+")) {
    return d.length >= 10 && d.length <= 14 ? "telefone" : "desconhecida";
  }
  // Só aceita como numérica se o que sobrou fora dígito for pontuação de
  // máscara comum (. - / ( ) espaço) — "abc123" não é chave.
  if (!/^[\d.\-/() ]+$/.test(v)) return "desconhecida";
  if (d.length === 14) return cnpjValido(d) ? "cnpj" : "desconhecida";
  if (d.length === 11) return cpfValido(d) ? "cpf" : "telefone";
  if (d.length === 10) return "telefone";
  // 12–13 dígitos: telefone com código do país sem "+" (ex.: 5511 9…).
  if (d.length === 12 || d.length === 13) return "telefone";
  return "desconhecida";
}

/** Rótulo PT do tipo (a UI traduz via t()). */
export const ROTULO_CHAVE_PIX: Record<TipoChavePix, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  aleatoria: "Chave aleatória",
  desconhecida: "Chave não reconhecida",
};
