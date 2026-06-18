import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Storage das fotos da assinatura (bucket privado `assinaturas`). Só o
 * service-role acessa: a rota pública faz o upload e a rota da agência gera
 * URLs assinadas pro relatório. Os arquivos não ficam públicos.
 */
const BUCKET = "assinaturas";

/** data:image/jpeg;base64,XXXX → { buffer, contentType }. */
function decodeDataUrl(
  dataUrl: string
): { buffer: Buffer; contentType: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { contentType: m[1], buffer: Buffer.from(m[2], "base64") };
}

/** Sobe uma foto (data URL) no caminho dado; devolve o path ou null se inválida. */
export async function uploadFoto(
  admin: SupabaseClient,
  caminho: string,
  dataUrl: string
): Promise<string | null> {
  const dec = decodeDataUrl(dataUrl);
  if (!dec) return null;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(caminho, dec.buffer, {
      contentType: dec.contentType,
      upsert: true,
    });
  if (error) throw error;
  return caminho;
}

/** URL assinada (temporária) pra exibir uma foto. null se falhar. */
export async function urlAssinada(
  admin: SupabaseClient,
  caminho: string,
  expiraSeg = 3600
): Promise<string | null> {
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(caminho, expiraSeg);
  if (error) return null;
  return data?.signedUrl ?? null;
}
