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

export type EmpresaConfig = {
  /**
   * Recebe o documento JÁ NORMALIZADO (saída de normalizarDocumento).
   * `true` = empresa, `false` = pessoa física, `null` = não dá pra saber
   * (ambíguo → a UI mostra o seletor PF/Empresa).
   */
  detecta: (docNormalizado: string) => boolean | null;
  /** Nome do campo de empresa no país (passa por t() no front). */
  rotulo: string;
};

export type DocConfig = {
  /** Rótulo do campo — ex "CPF / CNPJ", "SSN / EIN". */
  label: string;
  placeholder: string;
  /** Formata o valor cru pra exibição no input. */
  format: (raw: string) => string;
  /** Regra de empresa vs pessoa + rótulo do campo de razão social. */
  empresa?: EmpresaConfig;
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

/**
 * Regras `detecta` por país (entrada = documento JÁ NORMALIZADO). Países com
 * regra devolvem sempre true/false (nunca `null`) → ZERO seletor na UI. Países
 * AMBÍGUOS (sem regra confiável) devolvem `null` → a UI mostra o seletor
 * PF/Empresa e a escolha manual vira `tipo` no jsonb.
 */
const AMBIGUO: EmpresaConfig["detecta"] = () => null;

const DOCS: Record<string, DocConfig> = {
  // BR: CNPJ = 14 dígitos (empresa), CPF = 11 (pessoa). NUNCA null — comportamento
  // idêntico ao ehCnpj de hoje; o seletor jamais aparece no BR.
  BR: {
    label: "CPF / CNPJ",
    placeholder: "000.000.000-00",
    format: mascararCpfCnpj,
    empresa: { detecta: (d) => d.length === 14, rotulo: "Razão social" },
  },
  // US: SSN e EIN têm 9 dígitos ambos — impossível distinguir. Ambíguo.
  US: {
    label: "SSN / EIN / ITIN",
    placeholder: "000-00-0000",
    format: mascara("XXX-XX-XXXX", 9),
    empresa: { detecta: AMBIGUO, rotulo: "Company legal name" },
  },
  // PT: NIF de pessoa coletiva começa com 5.
  PT: {
    label: "NIF",
    placeholder: "000 000 000",
    format: mascara("XXX XXX XXX", 9),
    empresa: { detecta: (d) => d.startsWith("5"), rotulo: "Denominação social" },
  },
  // AR: CUIT de empresa = 11 dígitos com prefixo 30/33/34. CUIT/CUIL de pessoa
  // (20/23/24/27) e DNI (8) → pessoa.
  AR: {
    label: "CUIT / CUIL / DNI",
    placeholder: "00-00000000-0",
    format: mascara("XX-XXXXXXXX-X", 11),
    empresa: { detecta: (d) => d.length === 11 && /^(30|33|34)/.test(d), rotulo: "Razón social" },
  },
  // FR: SIREN (9) / SIRET (14) preenchido = entidade sempre.
  FR: {
    label: "SIRET / SIREN",
    placeholder: "000 000 000 00000",
    format: mascara("XXX XXX XXX XXXXX", 14),
    empresa: { detecta: (d) => d.length === 9 || d.length === 14, rotulo: "Raison sociale" },
  },
  // CA: BN e SIN ambos 9 dígitos — impossível distinguir. Ambíguo.
  CA: {
    label: "BN / SIN",
    placeholder: "000 000 000",
    format: mascara("XXX XXX XXX", 9),
    empresa: { detecta: AMBIGUO, rotulo: "Company legal name" },
  },
  // ES: CIF (empresa) começa com LETRA (≠ X/Y/Z, que são NIE de pessoa). DNI =
  // 8 dígitos + letra no fim; NIE = X/Y/Z no início → pessoa.
  ES: {
    label: "NIF / NIE / CIF",
    placeholder: "00000000A",
    format: livre,
    empresa: { detecta: (d) => /^[A-Z]/.test(d) && !"XYZ".includes(d[0]!), rotulo: "Razón social" },
  },
  // MX: RFC moral (empresa) = 12 caracteres; RFC físico (pessoa) = 13. INVERTIDO
  // de propósito (o mais curto é a empresa).
  MX: {
    label: "RFC / CURP",
    placeholder: "RFC ou CURP",
    format: livre,
    empresa: { detecta: (d) => d.length === 12, rotulo: "Razón social" },
  },
  // CL: RUT de empresa e de pessoa têm o mesmo formato. Ambíguo.
  CL: {
    label: "RUT",
    placeholder: "12.345.678-9",
    format: livre,
    empresa: { detecta: AMBIGUO, rotulo: "Razón social" },
  },
  // CO: NIT e Cédula não distinguíveis com segurança. Ambíguo.
  CO: {
    label: "NIT / Cédula",
    placeholder: "NIT / Cédula",
    format: livre,
    empresa: { detecta: AMBIGUO, rotulo: "Razón social" },
  },
  // PE: RUC (empresa) = 11 dígitos; DNI (pessoa) = 8.
  PE: {
    label: "RUC / DNI",
    placeholder: "RUC / DNI",
    format: livre,
    empresa: { detecta: (d) => /^\d{11}$/.test(d), rotulo: "Razón social" },
  },
  // UY: RUT/CI sem regra confiável. Ambíguo.
  UY: {
    label: "RUT / CI",
    placeholder: "RUT / CI",
    format: livre,
    empresa: { detecta: AMBIGUO, rotulo: "Razón social" },
  },
  // PY: RUC/CI sem regra confiável. Ambíguo.
  PY: {
    label: "RUC / CI",
    placeholder: "RUC / CI",
    format: livre,
    empresa: { detecta: AMBIGUO, rotulo: "Razón social" },
  },
  // EC: RUC/Cédula sem regra confiável. Ambíguo.
  EC: {
    label: "RUC / Cédula",
    placeholder: "RUC / Cédula",
    format: livre,
    empresa: { detecta: AMBIGUO, rotulo: "Razón social" },
  },
  // BO: NIT/CI sem regra confiável. Ambíguo.
  BO: {
    label: "NIT / CI",
    placeholder: "NIT / CI",
    format: livre,
    empresa: { detecta: AMBIGUO, rotulo: "Razón social" },
  },
  // VE: RIF/Cédula sem regra confiável. Ambíguo.
  VE: {
    label: "RIF / Cédula",
    placeholder: "RIF / Cédula",
    format: livre,
    empresa: { detecta: AMBIGUO, rotulo: "Razón social" },
  },
  // IT: P.IVA (empresa) = 11 dígitos numéricos; Codice Fiscale (pessoa) = 16
  // alfanumérico.
  IT: {
    label: "Codice Fiscale / P.IVA",
    placeholder: "Codice Fiscale / P.IVA",
    format: livre,
    empresa: { detecta: (d) => /^\d{11}$/.test(d), rotulo: "Ragione sociale" },
  },
  // DE: USt-IdNr e Steuer-ID não distinguem pessoa de empresa. Ambíguo.
  DE: {
    label: "USt-IdNr / Steuer-ID",
    placeholder: "USt-IdNr / Steuer-ID",
    format: livre,
    empresa: { detecta: AMBIGUO, rotulo: "Firmenname" },
  },
  // GB: UTR/VAT/Company No. sem regra confiável no campo único. Ambíguo.
  GB: {
    label: "UTR / VAT / Company No.",
    placeholder: "UTR / VAT",
    format: livre,
    empresa: { detecta: AMBIGUO, rotulo: "Company legal name" },
  },
  // AU: ABN (empresa) = 11 dígitos; TFN (pessoa) = 8-9.
  AU: {
    label: "ABN / TFN",
    placeholder: "ABN / TFN",
    format: livre,
    empresa: { detecta: (d) => /^\d{11}$/.test(d), rotulo: "Company legal name" },
  },
  // JP: 法人番号 (empresa) = 13 dígitos; My Number (pessoa) = 12.
  JP: {
    label: "法人番号 / My Number",
    placeholder: "Corporate No. / My Number",
    format: livre,
    empresa: { detecta: (d) => /^\d{13}$/.test(d), rotulo: "Company name" },
  },
};

const DEFAULT_DOC: DocConfig = {
  label: "Documento / Tax ID",
  placeholder: "Documento / Tax ID",
  format: livre,
  empresa: { detecta: AMBIGUO, rotulo: "Company name" },
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

/**
 * Detecta se o documento é de EMPRESA, PESSOA ou AMBÍGUO.
 * `true` = empresa · `false` = pessoa física · `null` = a regra do país não
 * decide (a UI mostra o seletor PF/Empresa).
 *
 * Documento vazio/null → `false` (NUNCA `null` — senão o seletor piscaria antes
 * de o usuário digitar). Normalizou pra vazio (só separadores) → também `false`.
 */
export function detectarEmpresa(
  pais: string | undefined | null,
  documento: string | null | undefined
): boolean | null {
  if (!documento || !documento.trim()) return false;
  const norm = normalizarDocumento(pais, documento);
  if (!norm) return false;
  const cfg = configDocumento(pais);
  return cfg.empresa ? cfg.empresa.detecta(norm) : null;
}

/**
 * O documento é de EMPRESA (= tem razão social)? Ponto ÚNICO da regra — nada de
 * `length === 14` espalhado pelo app. Substitui o antigo `ehCnpj` em todos os
 * call-sites (exceto o gate BR-only da busca BrasilAPI).
 *
 * A regra do país decide; quando ela é ambígua (`null`), vale a `escolhaManual`
 * (default `false`). Vazio → sempre `false`. Para BR o resultado é idêntico ao
 * `ehCnpj` (BR nunca é ambíguo).
 */
export function ehDocumentoEmpresa(
  pais: string | undefined | null,
  documento: string | null | undefined,
  escolhaManual?: boolean
): boolean {
  return detectarEmpresa(pais, documento) ?? (escolhaManual ?? false);
}

/**
 * Rótulo do campo de razão social/empresa do país (passa por t() no front).
 * Fallback "Company name" pra qualquer país sem config específica.
 */
export function rotuloEmpresa(pais: string | undefined | null): string {
  return configDocumento(pais).empresa?.rotulo ?? "Company name";
}

/**
 * @deprecated Use {@link ehDocumentoEmpresa}. Semântica congelada = "é um CNPJ
 * brasileiro" (BR + 14 dígitos). O ÚNICO uso legítimo restante é o gate da busca
 * BrasilAPI em RazaoSocialCnpj.tsx (que é BR-only por natureza — não há API
 * universal). CORPO INTACTO byte-a-byte de propósito: generalizar aqui faria um
 * NIF português "5xxxxxxxx" disparar consulta BrasilAPI indevida.
 */
export function ehCnpj(pais: string | undefined | null, documento: string | null | undefined): boolean {
  const p = (pais ?? "BR").toUpperCase();
  if (p !== "BR" || !documento) return false;
  return normalizarDocumento(p, documento).length === 14;
}
