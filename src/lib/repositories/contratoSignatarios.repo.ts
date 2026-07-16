import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SignatarioRow,
  SignatarioEscrita,
  ArquivosSignatario,
} from "@/lib/mappers/contratoSignatario";

const COLS = `
  id, contrato_id, workspace_id, nome, email, papel, ordem, token,
  exige, arquivos, status, assinatura, documento, ip, geolocalizacao,
  dispositivo, assinado_em, aberturas, criado_em
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

/** Resumo de TODOS os signatários do workspace (pra pintar status na lista). */
export async function resumoDoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<
  Array<{ contrato_id: string; nome: string; status: string; aberturas: number | null; ordem: number | null }>
> {
  const { data, error } = await supabase
    .from("contrato_signatarios")
    .select("contrato_id, nome, status, aberturas, ordem")
    .eq("workspace_id", workspaceId)
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Array<{
    contrato_id: string;
    nome: string;
    status: string;
    aberturas: number | null;
    ordem: number | null;
  }>;
}

/** Incrementa o contador de aberturas de um signatário (link aberto sem assinar). */
export async function incrementarAberturas(
  admin: SupabaseClient,
  id: string,
  novoValor: number
): Promise<void> {
  await admin
    .from("contrato_signatarios")
    .update({ aberturas: novoValor })
    .eq("id", id)
    .neq("status", "assinado");
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
    arquivos: ArquivosSignatario;
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
      arquivos: dados.arquivos,
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

/**
 * Signatários que JÁ ASSINARAM de um contrato (COLS completas, via admin).
 * Alimenta o relatório de assinaturas no link público — por isso ordena e traz
 * tudo, mas o service filtra os campos KYC antes de expor.
 */
export async function listarAssinadosDoContrato(
  admin: SupabaseClient,
  contratoId: string
): Promise<SignatarioRow[]> {
  const { data, error } = await admin
    .from("contrato_signatarios")
    .select(COLS)
    .eq("contrato_id", contratoId)
    .eq("status", "assinado")
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as SignatarioRow[];
}
