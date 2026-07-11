/**
 * Validação de CPF/CNPJ para campos de documento de um valor único.
 *
 * A máscara progressiva (CPF/CNPJ) vive em `@/lib/formatters`
 * (`mascararCpfCnpj`) — esse arquivo mantém só a validação, que não tem
 * equivalente lá.
 */

import { apenasDigitos } from "./formatters";

/** Válido apenas com exatamente 11 (CPF) ou 14 (CNPJ) dígitos. */
export function documentoValido(valor: string): boolean {
  const n = apenasDigitos(valor).length;
  return n === 11 || n === 14;
}
