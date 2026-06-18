import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SignatarioRow,
  SignatarioEscrita,
} from "@/lib/mappers/contratoSignatario";

const COLS = `
  id, contrato_id, workspace_id, nome, email, papel, ordem, token,
  exige, status, assinatura, documento, ip, geolocalizacao, dispositivo,
  assinado_em, criado_em
`;

/** Signatários de um contrato (uso da agência — RLS por workspace). */
export async function listarPorContrato(
  supabase: SupabaseClient,
  contratoId: string
): Promise<SignatarioRow[]> {
  const { data, error } = await supabase
    .from("contrato_signatarios")
    .select(COLS)
    .eq("contrato_id", contratoId)
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as SignatarioRow[];
}

/** Remove os signatários ainda NÃO assinados de um contrato (pra redefinir). */
export async function removerPendentes(
  supabase: SupabaseClient,
  contratoId: string
): Promise<void> {
  const { error } = await supabase
    .from("contrato_signatarios")
    .delete()
    .eq("contrato_id", contratoId)
    .eq("status", "pendente");
  if (error) throw error;
}

/** Insere vários signatários de uma vez. */
export async function criarVarios(
  supabase: SupabaseClient,
  payloads: SignatarioEscrita[]
): Promise<SignatarioRow[]> {
  if (payloads.length === 0) return [];
  const { data, error } = await supabase
    .from("contrato_signatarios")
    .insert(payloads)
    .select(COLS);
  if (error) throw error;
  return (data ?? []) as unknown as SignatarioRow[];
}

export async function removerSignatario(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("contrato_signatarios")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------------- Acesso público por token (service-role) ----------------

/** Busca UM signatário pelo token (página pública — usa client admin). */
export async function buscarPorToken(
  admin: SupabaseClient,
  token: string
): Promise<SignatarioRow | null> {
  const { data, error } = await admin
    .from("contrato_signatarios")
    .select(COLS)
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as SignatarioRow) ?? null;
}

/**
 * Registra a assinatura por token, SOMENTE se ainda estiver pendente
 * (garante assinatura única). Devolve a linha atualizada ou null se já
 * estava assinado / token inexistente.
 */
export async function registrarAssinaturaPorToken(
  admin: SupabaseClient,
  token: string,
  dados: {
    assinatura: string | null;
    documento: string | null;
    ip: string | null;
    geolocalizacao: string | null;
    dispositivo: string | null;
  }
): Promise<SignatarioRow | null> {
  const { data, error } = await admin
    .from("contrato_signatarios")
    .update({
      status: "assinado",
      assinatura: dados.assinatura,
      documento: dados.documento,
      ip: dados.ip,
      geolocalizacao: dados.geolocalizacao,
      dispositivo: dados.dispositivo,
      assinado_em: new Date().toISOString(),
    })
    .eq("token", token)
    .eq("status", "pendente")
    .select(COLS)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as SignatarioRow) ?? null;
}

/** Todos os signatários de um contrato (via admin) — pra recomputar status. */
export async function listarPorContratoAdmin(
  admin: SupabaseClient,
  contratoId: string
): Promise<SignatarioRow[]> {
  const { data, error } = await admin
    .from("contrato_signatarios")
    .select("status")
    .eq("contrato_id", contratoId);
  if (error) throw error;
  return (data ?? []) as unknown as SignatarioRow[];
}
