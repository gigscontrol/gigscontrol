import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Storage dos vouchers de voo (bucket privado `vouchers`). Só o service-role
 * acessa: a rota do servidor sobe o PDF e gera URLs assinadas pro download.
 * Os arquivos nunca ficam públicos.
 */
const BUCKET = "vouchers";

/** Sobe um PDF (base64 puro, sem o prefixo data:) no caminho dado. */
export async function uploadVoucher(
  admin: SupabaseClient,
  caminho: string,
  base64: string
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const { error } = await admin.storage.from(BUCKET).upload(caminho, buffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) throw error;
  return caminho;
}

/** URL assinada (temporária) pra baixar o voucher. null se falhar. */
export async function urlVoucher(
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
