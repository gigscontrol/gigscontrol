import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SignatarioRow,
  SignatarioEscrita,
  ArquivosSignatario,
} from "@/lib/mappers/contratoSignatario";

const COLS = `
  id, contrato_id, workspace_id, nome, email, papel, ordem, token,
  exige, arquivos, status, assinatura, documento, ip, geolocalizacao,
  dispositivo, assinado_em, aberturas, criado_em,
  telefone, fuso_horario, metodo_autenticacao,
  otp_hash, otp_expira_em, otp_tentativas, otp_verificado_em,
  pendente_payload, confirm_token_hash, nome_completo, data_nascimento
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

/** Busca pelo HASH do token de confirmação do e-mail (botão mágico). */
export async function buscarPorConfirmTokenHash(
  admin: SupabaseClient,
  hash: string
): Promise<SignatarioRow | null> {
  const { data, error } = await admin
    .from("contrato_signatarios")
    .select(COLS)
    .eq("confirm_token_hash", hash)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as SignatarioRow) ?? null;
}

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
    fuso_horario: string | null;
    metodo_autenticacao: string | null;
    arquivos: ArquivosSignatario;
    nome_completo?: string | null;
    data_nascimento?: string | null;
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
      fuso_horario: dados.fuso_horario,
      metodo_autenticacao: dados.metodo_autenticacao,
      arquivos: dados.arquivos,
      nome_completo: dados.nome_completo ?? null,
      data_nascimento: dados.data_nascimento ?? null,
      assinado_em: new Date().toISOString(),
      // Efetivou → staging/tokens de confirmação não valem mais.
      pendente_payload: null,
      otp_hash: null,
      confirm_token_hash: null,
    })
    .eq("token", token)
    .eq("status", "pendente")
    .select(COLS)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as SignatarioRow) ?? null;
}

/**
 * Atualiza campos de um signatário PENDENTE pelo token (fluxo público de OTP:
 * gravar hash do código, incrementar tentativas, marcar verificado). Devolve a
 * linha atualizada ou null se o token não existe / já assinou.
 */
export async function atualizarPorToken(
  admin: SupabaseClient,
  token: string,
  patch: SignatarioEscrita
): Promise<SignatarioRow | null> {
  const { data, error } = await admin
    .from("contrato_signatarios")
    .update(patch)
    .eq("token", token)
    .eq("status", "pendente")
    .select(COLS)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as SignatarioRow) ?? null;
}

/**
 * Consome UMA tentativa de OTP de forma serializada (compare-and-swap): o
 * UPDATE só aplica se `otp_tentativas` ainda vale o que a rota leu. N
 * requisições concorrentes leem o mesmo valor mas só uma vence — o teto de
 * 5 tentativas vale de verdade mesmo sob flood paralelo (antes o read-modify-
 * write deixava todas gravarem "1" e o cap virava decorativo).
 */
export async function consumirTentativaOtp(
  admin: SupabaseClient,
  token: string,
  tentativasLidas: number
): Promise<boolean> {
  const { data, error } = await admin
    .from("contrato_signatarios")
    .update({ otp_tentativas: tentativasLidas + 1 })
    .eq("token", token)
    .eq("status", "pendente")
    .eq("otp_tentativas", tentativasLidas)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return !!data;
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
