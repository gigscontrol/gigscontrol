import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Storage do PDF-fonte dos contratos por UPLOAD (bucket privado `assinaturas`,
 * o mesmo das fotos de assinatura — sem bucket novo). Só o service-role acessa:
 * a rota do servidor sobe o PDF, o editor baixa via URL assinada, e o carimbo
 * (pdf-lib) baixa o binário. Paths: `pdf-fonte/<workspaceId>/<contratoId>/...`.
 */
const BUCKET = "assinaturas";

/** Sobe o PDF-fonte (buffer) no caminho dado. Devolve o path. */
export async function uploadPdfContrato(
  admin: SupabaseClient,
  caminho: string,
  buffer: ArrayBuffer | Buffer
): Promise<string> {
  const { error } = await admin.storage.from(BUCKET).upload(caminho, buffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) throw error;
  return caminho;
}

/** Baixa o PDF-fonte (pra renderizar/carimbar). Lança se não achar. */
export async function baixarPdfContrato(
  admin: SupabaseClient,
  caminho: string
): Promise<ArrayBuffer> {
  const { data, error } = await admin.storage.from(BUCKET).download(caminho);
  if (error || !data) throw error ?? new Error("PDF do contrato não encontrado.");
  return data.arrayBuffer();
}

/** URL assinada (temporária) pro PDF-fonte — usada no editor de posicionamento. */
export async function urlPdfContrato(
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

/** Remove o PDF-fonte (best-effort, ao trocar/apagar). */
export async function removerPdfContrato(
  admin: SupabaseClient,
  caminho: string
): Promise<void> {
  await admin.storage.from(BUCKET).remove([caminho]).catch(() => undefined);
}
