import crypto from "crypto";

/**
 * Criptografia simétrica dos tokens do Google em repouso (AES-256-GCM).
 *
 * A chave vem de GOOGLE_TOKEN_ENC_KEY (32 bytes em base64 — gere com
 * `openssl rand -base64 32`). Formato do blob: `iv.tag.ciphertext`, cada
 * parte em base64. O auth tag do GCM garante integridade (detecta
 * adulteração na decriptação).
 */

function chave(): Buffer {
  const b64 = process.env.GOOGLE_TOKEN_ENC_KEY;
  if (!b64) {
    throw new Error("GOOGLE_TOKEN_ENC_KEY não configurada no ambiente.");
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error(
      "GOOGLE_TOKEN_ENC_KEY precisa ter 32 bytes — gere com: openssl rand -base64 32"
    );
  }
  return key;
}

export function cripto(texto: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", chave(), iv);
  const enc = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(".");
}

export function decripto(blob: string): string {
  const [ivB64, tagB64, encB64] = blob.split(".");
  if (!ivB64 || !tagB64 || !encB64) {
    throw new Error("Token criptografado em formato inválido.");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    chave(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
