/**
 * Mapper de "contrato_signatarios" — os signatários de um contrato (Fase 1
 * da assinatura). Cada signatário tem um `token` que vira o link público
 * /assinar/{token}. As exigências (o que a pessoa precisa preencher) ficam
 * em `exige` (jsonb).
 */

export type ExigenciasSignatario = {
  /** Desenhar a assinatura na tela (Fase 1 — sempre true). */
  assinaturaTela: boolean;
  /** Informar CPF/CNPJ (Fase 1 — sempre true). */
  cpfCnpj: boolean;
  /** Enviar foto do CPF (Fase 2 — Storage). */
  fotoCpf: boolean;
  /** Enviar foto do documento de identidade (Fase 2 — Storage). */
  fotoDocumento: boolean;
  /** Enviar selfie (Fase 2 — Storage). */
  selfie: boolean;
  /** Reconhecimento facial (Fase 3 — serviço de biometria). */
  facial: boolean;
  /** Verificar posse do e-mail via código OTP antes de assinar (mig 98). */
  otpEmail: boolean;
};

export const EXIGENCIAS_PADRAO: ExigenciasSignatario = {
  assinaturaTela: true,
  cpfCnpj: true,
  fotoCpf: false,
  fotoDocumento: false,
  selfie: false,
  facial: false,
  otpEmail: false,
};

/** Teto de signatários por contrato (vale pros dois fluxos: modelo e PDF). */
export const MAX_SIGNATARIOS = 6;

/**
 * Caminhos das fotos no Storage (Fase 2) + resultado do reconhecimento facial
 * (Fase 3). Quando exibidas, as fotos viram URLs assinadas. Guardado tudo no
 * jsonb `arquivos` pra não precisar de migração nova.
 */
export type ArquivosSignatario = {
  fotoCpf?: string;
  fotoDocumento?: string;
  fotoDocumentoVerso?: string;
  selfie?: string;
  /** Similaridade selfie × documento (0..100), do AWS Rekognition. */
  facialSimilaridade?: number;
  facialMatch?: boolean;
};

export function arquivosValido(raw: unknown): ArquivosSignatario {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: ArquivosSignatario = {};
  if (typeof o.fotoCpf === "string" && o.fotoCpf) out.fotoCpf = o.fotoCpf;
  if (typeof o.fotoDocumento === "string" && o.fotoDocumento)
    out.fotoDocumento = o.fotoDocumento;
  if (typeof o.fotoDocumentoVerso === "string" && o.fotoDocumentoVerso)
    out.fotoDocumentoVerso = o.fotoDocumentoVerso;
  if (typeof o.selfie === "string" && o.selfie) out.selfie = o.selfie;
  if (typeof o.facialSimilaridade === "number")
    out.facialSimilaridade = o.facialSimilaridade;
  if (typeof o.facialMatch === "boolean") out.facialMatch = o.facialMatch;
  return out;
}

export type SignatarioStatus = "pendente" | "assinado";

export type SignatarioRow = {
  id: string;
  contrato_id: string;
  workspace_id: string;
  nome: string;
  email: string | null;
  papel: string | null;
  ordem: number | null;
  token: string;
  exige: unknown;
  arquivos: unknown;
  status: string;
  assinatura: string | null;
  documento: string | null;
  ip: string | null;
  geolocalizacao: string | null;
  dispositivo: string | null;
  assinado_em: string | null;
  /** Nº de vezes que o link foi ABERTO sem assinar (tracking de visualização). */
  aberturas: number | null;
  criado_em: string | null;
  // Evidências + OTP (mig 98 — validade jurídica)
  telefone?: string | null;
  fuso_horario?: string | null;
  metodo_autenticacao?: string | null;
  otp_hash?: string | null;
  otp_expira_em?: string | null;
  otp_tentativas?: number | null;
  otp_verificado_em?: string | null;
};

export type Signatario = {
  id: string;
  contratoId: string;
  nome: string;
  email: string | null;
  papel: string | null;
  ordem: number;
  token: string;
  exige: ExigenciasSignatario;
  arquivos: ArquivosSignatario;
  /** URLs assinadas das fotos (preenchidas só quando a agência lista). */
  arquivosUrls?: ArquivosSignatario;
  status: SignatarioStatus;
  assinatura: string | null;
  documento: string | null;
  ip: string | null;
  geolocalizacao: string | null;
  dispositivo: string | null;
  assinadoEm: string | null;
  /** Nº de aberturas do link sem assinar. */
  aberturas: number;
  criadoEm: string;
  // Evidências (mig 98)
  telefone: string | null;
  fusoHorario: string | null;
  /** email_otp | link (legado — só posse do token). */
  metodoAutenticacao: string | null;
  /** Quando o OTP foi verificado (null = nunca). */
  otpVerificadoEm: string | null;
};

function bool(v: unknown, d: boolean): boolean {
  return typeof v === "boolean" ? v : d;
}

export function exigeValido(raw: unknown): ExigenciasSignatario {
  if (!raw || typeof raw !== "object") return { ...EXIGENCIAS_PADRAO };
  const o = raw as Record<string, unknown>;
  return {
    assinaturaTela: bool(o.assinaturaTela, EXIGENCIAS_PADRAO.assinaturaTela),
    cpfCnpj: bool(o.cpfCnpj, EXIGENCIAS_PADRAO.cpfCnpj),
    fotoCpf: bool(o.fotoCpf, EXIGENCIAS_PADRAO.fotoCpf),
    fotoDocumento: bool(o.fotoDocumento, EXIGENCIAS_PADRAO.fotoDocumento),
    selfie: bool(o.selfie, EXIGENCIAS_PADRAO.selfie),
    facial: bool(o.facial, EXIGENCIAS_PADRAO.facial),
    otpEmail: bool(o.otpEmail, EXIGENCIAS_PADRAO.otpEmail),
  };
}

function statusValido(s: string | null | undefined): SignatarioStatus {
  return s === "assinado" ? "assinado" : "pendente";
}

export function rowParaSignatario(row: SignatarioRow): Signatario {
  return {
    id: row.id,
    contratoId: row.contrato_id,
    nome: row.nome,
    email: row.email ?? null,
    papel: row.papel ?? null,
    ordem: row.ordem ?? 0,
    token: row.token,
    exige: exigeValido(row.exige),
    arquivos: arquivosValido(row.arquivos),
    status: statusValido(row.status),
    assinatura: row.assinatura ?? null,
    documento: row.documento ?? null,
    ip: row.ip ?? null,
    geolocalizacao: row.geolocalizacao ?? null,
    dispositivo: row.dispositivo ?? null,
    assinadoEm: row.assinado_em ?? null,
    aberturas: row.aberturas ?? 0,
    criadoEm: row.criado_em ?? "",
    telefone: row.telefone ?? null,
    fusoHorario: row.fuso_horario ?? null,
    metodoAutenticacao: row.metodo_autenticacao ?? null,
    otpVerificadoEm: row.otp_verificado_em ?? null,
  };
}

export type SignatarioEscrita = {
  contrato_id?: string;
  workspace_id?: string;
  nome?: string;
  email?: string | null;
  papel?: string | null;
  ordem?: number;
  token?: string;
  exige?: ExigenciasSignatario;
  arquivos?: ArquivosSignatario;
  status?: SignatarioStatus;
  assinatura?: string | null;
  documento?: string | null;
  ip?: string | null;
  geolocalizacao?: string | null;
  dispositivo?: string | null;
  assinado_em?: string | null;
  // Evidências + OTP (mig 98)
  telefone?: string | null;
  fuso_horario?: string | null;
  metodo_autenticacao?: string | null;
  otp_hash?: string | null;
  otp_expira_em?: string | null;
  otp_tentativas?: number;
  otp_verificado_em?: string | null;
};
