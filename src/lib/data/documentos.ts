/**
 * Documento fiscal/pessoal por país.
 *
 * Cada país tem seu documento (o "CPF/CNPJ" de lá). Aqui mapeamos rótulo,
 * placeholder e formatação por país. Onde temos certeza do formato,
 * aplicamos máscara; onde é ambíguo/variado, deixamos livre (alfanumérico)
 * mas com o RÓTULO correto do país. Fallback genérico pros demais.
 */

import { mascararCpfCnpj } from "@/lib/formatters";
import { aplicarMascara } from "@/lib/data/countries";

export type DocConfig = {
  /** Rótulo do campo — ex "CPF / CNPJ", "SSN / EIN". */
  label: string;
  placeholder: string;
  /** Formata o valor cru pra exibição no input. */
  format: (raw: string) => string;
};

const digitos = (s: string) => s.replace(/\D/g, "");
const alnum = (s: string) => s.replace(/[^0-9A-Za-z]/g, "").toUpperCase();

/** Máscara numérica fixa (reusa aplicarMascara dos telefones). */
const mascara = (mask: string, max: number) => (raw: string) =>
  aplicarMascara(digitos(raw).slice(0, max), mask);

/** Documento livre: mantém letras+números, sem separadores fixos. */
const livre = (raw: string) => alnum(raw).slice(0, 24);

/** Países cujo documento é puramente numérico (guardamos só dígitos). */
const NUMERICOS = new Set(["BR", "US", "PT", "AR", "FR", "CA"]);

const DOCS: Record<string, DocConfig> = {
  BR: { label: "CPF / CNPJ", placeholder: "000.000.000-00", format: mascararCpfCnpj },
  US: { label: "SSN / EIN / ITIN", placeholder: "000-00-0000", format: mascara("XXX-XX-XXXX", 9) },
  PT: { label: "NIF", placeholder: "000 000 000", format: mascara("XXX XXX XXX", 9) },
  AR: { label: "CUIT / CUIL / DNI", placeholder: "00-00000000-0", format: mascara("XX-XXXXXXXX-X", 11) },
  FR: { label: "SIRET / SIREN", placeholder: "000 000 000 00000", format: mascara("XXX XXX XXX XXXXX", 14) },
  CA: { label: "BN / SIN", placeholder: "000 000 000", format: mascara("XXX XXX XXX", 9) },
  ES: { label: "NIF / NIE / CIF", placeholder: "00000000A", format: livre },
  MX: { label: "RFC / CURP", placeholder: "RFC ou CURP", format: livre },
  CL: { label: "RUT", placeholder: "12.345.678-9", format: livre },
  CO: { label: "NIT / Cédula", placeholder: "NIT / Cédula", format: livre },
  PE: { label: "RUC / DNI", placeholder: "RUC / DNI", format: livre },
  UY: { label: "RUT / CI", placeholder: "RUT / CI", format: livre },
  PY: { label: "RUC / CI", placeholder: "RUC / CI", format: livre },
  EC: { label: "RUC / Cédula", placeholder: "RUC / Cédula", format: livre },
  BO: { label: "NIT / CI", placeholder: "NIT / CI", format: livre },
  VE: { label: "RIF / Cédula", placeholder: "RIF / Cédula", format: livre },
  IT: { label: "Codice Fiscale / P.IVA", placeholder: "Codice Fiscale / P.IVA", format: livre },
  DE: { label: "USt-IdNr / Steuer-ID", placeholder: "USt-IdNr / Steuer-ID", format: livre },
  GB: { label: "UTR / VAT / Company No.", placeholder: "UTR / VAT", format: livre },
  AU: { label: "ABN / TFN", placeholder: "ABN / TFN", format: livre },
  JP: { label: "法人番号 / My Number", placeholder: "Corporate No. / My Number", format: livre },
};

const DEFAULT_DOC: DocConfig = {
  label: "Documento / Tax ID",
  placeholder: "Documento / Tax ID",
  format: livre,
};

export function configDocumento(pais: string | undefined | null): DocConfig {
  return DOCS[(pais ?? "BR").toUpperCase()] ?? DEFAULT_DOC;
}

/**
 * Valor limpo pra salvar (sem separadores). Documentos numéricos → só
 * dígitos (compatível com o que o Brasil já guardava); demais →
 * alfanumérico em maiúsculas.
 */
export function normalizarDocumento(pais: string | undefined | null, raw: string): string {
  const p = (pais ?? "BR").toUpperCase();
  return NUMERICOS.has(p) ? digitos(raw) : alnum(raw);
}
