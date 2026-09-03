import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * INTEGRIDADE DOS CONTRATOS (mig 98 — validade jurídica).
 *
 * - hashConteudoContrato: SHA-256 canônico do corpo do contrato. É O número
 *   que sela "o que foi assinado": gravado em contratos.conteudo_hash no
 *   envio, selado na trilha (contrato_eventos) e exibido na página pública
 *   de verificação. Canonicalização: normaliza quebras de linha pra \n e
 *   apara espaços à direita de cada linha — reordenar bytes invisíveis não
 *   pode mudar a identidade jurídica do texto.
 * - sha256Hex: hash de bytes crus (PDF final).
 * - gerarVerificacaoId: id público GC-XXXX-XXXX (Crockford base32, sem
 *   caracteres ambíguos O/0, I/1/L) pra página /verificar.
 * - OTP: geração de código de 6 dígitos + hash com o token como sal (o
 *   código em claro nunca toca o banco) + comparação em tempo constante.
 *
 * A CADEIA de eventos é computada e verificada NO POSTGRES (RPCs da mig 98)
 * — uma engine só, sem risco de duas implementações divergirem.
 */

/** SHA-256 hex de bytes crus (ex.: PDF final). */
export function sha256Hex(dados: Buffer | Uint8Array | string): string {
  return createHash("sha256").update(dados).digest("hex");
}

/** Canonicaliza texto de contrato: CRLF/CR → LF, apara trailing spaces. */
export function canonicalizarConteudo(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n");
}

/** SHA-256 hex do conteúdo canônico do contrato. */
export function hashConteudoContrato(corpo: string): string {
  return sha256Hex(canonicalizarConteudo(corpo));
}

const CROCKFORD = "23456789ABCDEFGHJKMNPQRSTVWXYZ"; // sem 0/O, 1/I/L, U

/** ID público de verificação: GC-XXXX-XXXX (~41 bits — não enumerável com rate limit). */
export function gerarVerificacaoId(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += CROCKFORD[bytes[i] % CROCKFORD.length];
  return `GC-${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Formato aceito pela página/rota de verificação (case-insensitive). */
export function verificacaoIdValido(id: string): boolean {
  return /^GC-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/i.test(id.trim());
}

// ---------------- OTP por e-mail ----------------

export const OTP_VALIDADE_MIN = 30;
export const OTP_MAX_TENTATIVAS = 5;

/** Token do botão "concluir assinatura" do e-mail (24 bytes URL-safe). */
export function gerarTokenConfirmacao(): string {
  return randomBytes(24).toString("base64url");
}

/** Hash do token de confirmação — só o hash toca o banco. */
export function hashTokenConfirmacao(token: string): string {
  return sha256Hex(`confirmar|${token}`);
}

/** Código de 6 dígitos criptograficamente aleatório (nunca começa forçado em 0? começa como vier — 000123 é válido). */
export function gerarCodigoOtp(): string {
  // randomBytes → inteiro uniforme em [0, 1e6)
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(6, "0");
}

/** Hash do OTP com o TOKEN do signatário como sal — código em claro nunca persiste. */
export function hashOtp(token: string, codigo: string): string {
  return sha256Hex(`${token}|otp|${codigo}`);
}

/** Comparação em tempo constante entre o hash gravado e o do código digitado. */
export function otpConfere(token: string, codigoDigitado: string, hashGravado: string): boolean {
  const a = Buffer.from(hashOtp(token, codigoDigitado), "hex");
  const b = Buffer.from(hashGravado, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
