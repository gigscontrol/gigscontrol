import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * TRILHA DE AUDITORIA DOS CONTRATOS (mig 98 — validade jurídica).
 *
 * Cada evento relevante do ciclo de vida (criado, conteúdo alterado, enviado,
 * aberto, OTP, assinado, finalizado, PDF final, cancelado) vira uma linha
 * APPEND-ONLY em contrato_eventos, encadeada por hash: o hash de cada evento
 * sela o anterior (RPC registrar_contrato_evento, atômica com advisory lock).
 * Adulterar/apagar qualquer linha quebra a cadeia — e um trigger bloqueia
 * UPDATE/DELETE até para o service_role.
 *
 * A trilha é BEST-EFFORT nos pontos não-críticos (abrir link) e OBRIGATÓRIA
 * nos críticos (assinatura): quem chama decide via `obrigatorio`.
 */

export type TipoEventoContrato =
  | "criado"
  | "conteudo_alterado"
  | "enviado"
  | "aberto"
  | "otp_enviado"
  | "otp_verificado"
  | "assinado"
  | "finalizado"
  | "pdf_final_gerado"
  | "cancelado";

export type EventoContratoInput = {
  contratoId: string;
  workspaceId: string;
  signatarioId?: string | null;
  tipo: TipoEventoContrato;
  /** Fatos do evento (hash do conteúdo, versão, método, similaridade facial…). */
  detalhes?: Record<string, unknown>;
  ip?: string | null;
  dispositivo?: string | null;
  fusoHorario?: string | null;
};

/**
 * Registra um evento na cadeia. `obrigatorio: true` propaga o erro (o caller
 * decide abortar a operação); false (default) só loga — a operação de negócio
 * não morre por falha de auditoria não-crítica.
 */
export async function registrarEventoContrato(
  evento: EventoContratoInput,
  obrigatorio = false
): Promise<{ seq: number; hash: string } | null> {
  const admin = criarClienteAdmin();
  const { data, error } = await admin.rpc("registrar_contrato_evento", {
    p_contrato_id: evento.contratoId,
    p_workspace_id: evento.workspaceId,
    p_signatario_id: evento.signatarioId ?? null,
    p_tipo: evento.tipo,
    p_detalhes: evento.detalhes ?? {},
    p_ip: evento.ip ?? null,
    p_dispositivo: evento.dispositivo ?? null,
    p_fuso: evento.fusoHorario ?? null,
  });
  if (error) {
    if (obrigatorio) throw error;
    console.warn(`[trilha contrato] falha ao registrar '${evento.tipo}':`, error.message);
    return null;
  }
  const r = data as { seq: number; hash: string };
  return { seq: r.seq, hash: r.hash };
}

export type CadeiaContrato = {
  integra: boolean;
  eventos: number;
  furoSeq: number | null;
};

/** Recomputa a cadeia inteira no banco e diz se está íntegra. */
export async function verificarCadeiaContrato(contratoId: string): Promise<CadeiaContrato> {
  const admin = criarClienteAdmin();
  const { data, error } = await admin.rpc("verificar_cadeia_contrato", {
    p_contrato_id: contratoId,
  });
  if (error) throw error;
  const r = data as { integra: boolean; eventos: number; furo_seq: number | null };
  return { integra: r.integra, eventos: r.eventos, furoSeq: r.furo_seq };
}

/** Linha da trilha para exibição (detalhe do contrato / verificação pública). */
export type EventoContratoLinha = {
  seq: number;
  tipo: string;
  detalhes: Record<string, unknown>;
  ip: string | null;
  dispositivo: string | null;
  fusoHorario: string | null;
  criadoEm: string;
  hash: string;
};

export async function listarEventosContrato(
  contratoId: string
): Promise<EventoContratoLinha[]> {
  const admin = criarClienteAdmin();
  const { data, error } = await admin
    .from("contrato_eventos")
    .select("seq, tipo, detalhes, ip, dispositivo, fuso_horario, criado_em, hash")
    .eq("contrato_id", contratoId)
    .order("seq", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    seq: r.seq as number,
    tipo: r.tipo as string,
    detalhes: (r.detalhes ?? {}) as Record<string, unknown>,
    ip: (r.ip ?? null) as string | null,
    dispositivo: (r.dispositivo ?? null) as string | null,
    fusoHorario: (r.fuso_horario ?? null) as string | null,
    criadoEm: r.criado_em as string,
    hash: r.hash as string,
  }));
}
