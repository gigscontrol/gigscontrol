/**
 * Máscara e validação de CPF/CNPJ para campos de documento de um valor único.
 *
 * Regra: até 11 dígitos formata como CPF (000.000.000-00); de 12 a 14 dígitos
 * formata como CNPJ (00.000.000/0000-00). Só são válidos exatamente 11 (CPF)
 * ou 14 (CNPJ) dígitos.
 */

/** Mantém só os dígitos de uma string. */
export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Formata progressivamente conforme a pessoa digita: CPF (≤ 11 dígitos) ou
 * CNPJ (12–14 dígitos). Ignora qualquer dígito além de 14.
 */
export function formatarCpfCnpj(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 14);
  if (d.length <= 11) {
    // CPF: 000.000.000-00
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  // CNPJ: 00.000.000/0000-00
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

/** Válido apenas com exatamente 11 (CPF) ou 14 (CNPJ) dígitos. */
export function documentoValido(valor: string): boolean {
  const n = apenasDigitos(valor).length;
  return n === 11 || n === 14;
}
