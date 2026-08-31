import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { documentoValido } from "@/lib/documento";
import type {
  Signatario,
  SignatarioEscrita,
  ExigenciasSignatario,
  ArquivosSignatario,
} from "@/lib/mappers/contratoSignatario";
import { uploadFoto, urlAssinada } from "@/lib/db/storage-assinaturas";
import { compararFaces } from "@/lib/db/rekognition";
import {
  rowParaSignatario,
  exigeValido,
} from "@/lib/mappers/contratoSignatario";
import {
  listarPorContrato,
  removerPendentes,
  criarVarios,
  removerSignatario as repoRemover,
  buscarPorToken,
  registrarAssinaturaPorToken,
  listarPorContratoAdmin,
  listarAssinadosDoContrato,
  resumoDoWorkspace,
  incrementarAberturas,
} from "@/lib/repositories/contratoSignatarios.repo";
import {
  buscarContrato,
  atualizarContrato,
} from "@/lib/repositories/contratos.repo";
import { rowParaContrato, type Contrato } from "@/lib/mappers/contrato";
import {
  hashConteudoContrato,
  gerarVerificacaoId,
} from "@/lib/contratos/integridade";
import { registrarEventoContrato } from "@/lib/services/contratoEventos.service";
import { selarPdfFinal } from "@/lib/services/contratoPdfFinal.service";

/** Token do link público — 24 bytes aleatórios, URL-safe (impossível de adivinhar). */
function gerarToken(): string {
  return randomBytes(24).toString("base64url");
}

export type EntradaSignatario = {
  nome: string;
  email?: string | null;
  telefone?: string | null;
  papel?: string | null;
  exige?: Partial<ExigenciasSignatario>;
};

export async function listarSignatariosDoContrato(
  supabase: SupabaseClient,
  contratoId: string
): Promise<Signatario[]> {
  const rows = await listarPorContrato(supabase, contratoId);
  return rows.map(rowParaSignatario);
}

/**
 * Define os signatários de um contrato: remove os ainda pendentes, cria a
 * nova lista (cada um com seu token) e marca o contrato como "enviado".
 * Quem já assinou é preservado.
 */
export async function definirSignatarios(
  supabase: SupabaseClient,
  workspaceId: string,
  contratoId: string,
  entradas: EntradaSignatario[]
): Promise<Signatario[]> {
  await removerPendentes(supabase, contratoId);
  const payloads: SignatarioEscrita[] = entradas.map((e, i) => {
    const exige = exigeValido(e.exige);
    return {
      contrato_id: contratoId,
      workspace_id: workspaceId,
      nome: e.nome,
      email: e.email ?? null,
      telefone: e.telefone ?? null,
      papel: e.papel ?? null,
      ordem: i,
      token: gerarToken(),
      exige,
      status: "pendente",
      metodo_autenticacao: exige.otpEmail ? "email_otp" : "link",
    };
  });
  const rows = await criarVarios(supabase, payloads);

  // SELA o conteúdo no envio (mig 98): o hash SHA-256 do corpo é O número que
  // identifica juridicamente "o que foi enviado pra assinar". Se o corpo mudou
  // desde o último envio, a versão sobe e a trilha registra a alteração.
  const contratoRow = await buscarContrato(supabase, contratoId);
  const corpo = contratoRow?.corpo_preenchido ?? "";
  const hash = hashConteudoContrato(corpo);
  let versao = contratoRow?.conteudo_versao ?? 1;
  if (contratoRow?.conteudo_hash && contratoRow.conteudo_hash !== hash) {
    versao += 1;
    await registrarEventoContrato({
      contratoId,
      workspaceId,
      tipo: "conteudo_alterado",
      detalhes: { hashAnterior: contratoRow.conteudo_hash, hash, versao },
    });
  }
  await atualizarContrato(supabase, contratoId, {
    status: "enviado",
    conteudo_hash: hash,
    conteudo_versao: versao,
  });
  await registrarEventoContrato({
    contratoId,
    workspaceId,
    tipo: "enviado",
    detalhes: {
      hash,
      versao,
      signatarios: rows.length,
      exigencias: payloads.map((p) => p.exige),
    },
  });
  return rows.map(rowParaSignatario);
}

/**
 * Uma exigência da assinatura (foto, selfie, documento…) não foi atendida.
 * O cliente valida na UI, mas o servidor é a fonte da verdade: um POST cru
 * não pode pular etapas que a agência marcou como obrigatórias.
 */
export class ExigenciaNaoAtendidaError extends Error {
  status = 422;
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ExigenciaNaoAtendidaError";
  }
}

// ---------------- Público (service-role, sem login) ----------------

/** Busca o contrato + o signatário daquele token (página pública). */
export async function buscarParaAssinar(
  admin: SupabaseClient,
  token: string
): Promise<{
  signatario: Signatario;
  contrato: Contrato;
  /** Pra trilha de auditoria (contrato_eventos exige workspace). */
  workspaceId: string;
} | null> {
  const sigRow = await buscarPorToken(admin, token);
  if (!sigRow) return null;
  const contratoRow = await buscarContrato(admin, sigRow.contrato_id);
  if (!contratoRow) return null;
  return {
    signatario: rowParaSignatario(sigRow),
    contrato: rowParaContrato(contratoRow),
    workspaceId: sigRow.workspace_id,
  };
}

/**
 * Forma PÚBLICA de uma assinatura para o relatório no link /assinar/{token}:
 * só os campos visíveis do relatório, SEM foto/selfie/arquivos KYC nem facial
 * (evidência sensível que nunca sai pela rota pública).
 *
 * PII FORENSE REDIGIDA ENTRE CONTRAPARTES: a rota é pública (o token é a
 * credencial e o link se repassa), então quem detém o link de B via, cru, o
 * CPF integral, o GPS com 6 casas (~11 cm = endereço residencial), o IP e o
 * e-mail de A. Aqui só sai o mínimo do relatório (quem assinou, quando, com
 * qual assinatura, documento mascarado). Os dados forenses completos ficam na
 * folha A4 que a AGÊNCIA dona imprime pelo caminho autenticado.
 */
export type AssinaturaPublica = {
  nome: string;
  papel: string | null;
  /** Mascarado: só os últimos dígitos (•••• 12). */
  documento: string | null;
  dispositivo: string | null;
  assinadoEm: string | null;
  assinatura: string | null;
};

/** CPF/CNPJ → só os últimos 2 dígitos, o resto vira ponto. Vazio → null. */
function mascararDocumento(doc: string | null): string | null {
  const d = (doc ?? "").replace(/\D/g, "");
  if (d.length < 3) return doc ? "••••" : null;
  return `•••• ${d.slice(-2)}`;
}

/**
 * Signatários do MESMO contrato que já assinaram — pro relatório visível no
 * link público. Só campos do relatório; nada de KYC.
 */
export async function assinantesPublicosDoContrato(
  admin: SupabaseClient,
  contratoId: string
): Promise<AssinaturaPublica[]> {
  const rows = await listarAssinadosDoContrato(admin, contratoId);
  return rows.map(rowParaSignatario).map((s) => ({
    nome: s.nome,
    papel: s.papel,
    documento: mascararDocumento(s.documento),
    dispositivo: s.dispositivo,
    assinadoEm: s.assinadoEm,
    assinatura: s.assinatura,
    // ip, email e geolocalizacao NÃO saem entre contrapartes (ver o tipo).
  }));
}

/**
 * Registra a assinatura (uma única vez). Devolve o signatário atualizado ou
 * null se o link já tinha sido assinado / é inválido. Recomputa o status do
 * contrato (todos assinados → "assinado").
 */
export async function registrarAssinatura(
  admin: SupabaseClient,
  token: string,
  dados: {
    assinatura: string | null;
    documento: string | null;
    ip: string | null;
    geolocalizacao: string | null;
    dispositivo: string | null;
    /** Fuso IANA do navegador (Intl…timeZone) — evidência da mig 98. */
    fusoHorario?: string | null;
    fotoCpf?: string | null;
    fotoDocumento?: string | null;
    fotoDocumentoVerso?: string | null;
    selfie?: string | null;
  }
): Promise<Signatario | null> {
  // Confere antes de subir foto (evita upload pra link já assinado/inválido).
  const sigRow = await buscarPorToken(admin, token);
  if (!sigRow || sigRow.status === "assinado") return null;

  // Enforcement server-side das exigências ANTES de qualquer upload/facial.
  // O cliente também valida (UX), mas o servidor é a autoridade — um POST cru
  // não pode assinar pulando selfie/facial/documento nem mandar CPF inválido.
  const exige = exigeValido(sigRow.exige);
  if (exige.otpEmail && !sigRow.otp_verificado_em) {
    throw new ExigenciaNaoAtendidaError(
      "Confirme o código enviado ao seu e-mail antes de assinar."
    );
  }
  if (exige.cpfCnpj && !documentoValido(dados.documento ?? "")) {
    throw new ExigenciaNaoAtendidaError("CPF/CNPJ inválido ou não informado.");
  }
  if (exige.fotoDocumento && !dados.fotoDocumento) {
    throw new ExigenciaNaoAtendidaError("Foto do documento é obrigatória.");
  }
  if (exige.fotoCpf && !dados.fotoCpf) {
    throw new ExigenciaNaoAtendidaError("Foto do CPF é obrigatória.");
  }
  // 'facial' depende da selfie + foto do documento pra comparar; exigir ambas.
  if ((exige.selfie || exige.facial) && !dados.selfie) {
    throw new ExigenciaNaoAtendidaError("Selfie é obrigatória.");
  }
  if (exige.facial && !dados.fotoDocumento) {
    throw new ExigenciaNaoAtendidaError(
      "Verificação facial exige a foto do documento."
    );
  }

  const base = `${sigRow.contrato_id}/${sigRow.id}`;
  const arquivos: ArquivosSignatario = {};
  if (dados.fotoCpf) {
    const p = await uploadFoto(admin, `${base}/foto-cpf.jpg`, dados.fotoCpf);
    if (p) arquivos.fotoCpf = p;
  }
  if (dados.fotoDocumento) {
    const p = await uploadFoto(
      admin,
      `${base}/foto-documento.jpg`,
      dados.fotoDocumento
    );
    if (p) arquivos.fotoDocumento = p;
  }
  if (dados.fotoDocumentoVerso) {
    const p = await uploadFoto(
      admin,
      `${base}/foto-documento-verso.jpg`,
      dados.fotoDocumentoVerso
    );
    if (p) arquivos.fotoDocumentoVerso = p;
  }
  if (dados.selfie) {
    const p = await uploadFoto(admin, `${base}/selfie.jpg`, dados.selfie);
    if (p) arquivos.selfie = p;
  }

  // Reconhecimento facial (Fase 3): se exigido e temos selfie + documento.
  if (exige.facial && dados.selfie && dados.fotoDocumento) {
    const r = await compararFaces(dados.selfie, dados.fotoDocumento);
    if (r) {
      arquivos.facialSimilaridade = r.similaridade;
      arquivos.facialMatch = r.match;
    }
  }

  const row = await registrarAssinaturaPorToken(admin, token, {
    assinatura: dados.assinatura,
    documento: dados.documento,
    ip: dados.ip,
    geolocalizacao: dados.geolocalizacao,
    dispositivo: dados.dispositivo,
    fuso_horario: dados.fusoHorario ?? null,
    metodo_autenticacao: exige.otpEmail ? "email_otp" : "link",
    arquivos,
  });
  if (!row) return null;

  // Evento OBRIGATÓRIO na cadeia (mig 98): a assinatura é o ponto crítico da
  // trilha — se a auditoria falhar aqui, a operação inteira falha (a linha do
  // signatário fica gravada, mas o erro sobe e fica visível; o mesmo banco que
  // acabou de aceitar o UPDATE praticamente não falha na RPC).
  const contratoRow = await buscarContrato(admin, row.contrato_id);
  await registrarEventoContrato(
    {
      contratoId: row.contrato_id,
      workspaceId: row.workspace_id,
      signatarioId: row.id,
      tipo: "assinado",
      detalhes: {
        conteudoHash: contratoRow?.conteudo_hash ?? null,
        conteudoVersao: contratoRow?.conteudo_versao ?? 1,
        metodo: exige.otpEmail ? "email_otp" : "link",
        documento: dados.documento
          ? `****${dados.documento.replace(/\D/g, "").slice(-2)}`
          : null,
        geolocalizacao: !!dados.geolocalizacao,
        ...(arquivos.facialSimilaridade !== undefined
          ? {
              facialSimilaridade: arquivos.facialSimilaridade,
              facialMatch: arquivos.facialMatch ?? false,
            }
          : {}),
      },
      ip: dados.ip,
      dispositivo: dados.dispositivo,
      fusoHorario: dados.fusoHorario ?? null,
    },
    true
  );

  const todos = await listarPorContratoAdmin(admin, row.contrato_id);
  const todosAssinados =
    todos.length > 0 && todos.every((s) => s.status === "assinado");

  if (!todosAssinados) {
    await atualizarContrato(admin, row.contrato_id, { status: "enviado" });
    return rowParaSignatario(row);
  }

  // FINALIZAÇÃO: todos assinaram → contrato imutável. Gera o ID público de
  // verificação (GC-XXXX-XXXX, único — retry em colisão) e sela na trilha.
  let verificacaoId = contratoRow?.verificacao_id ?? null;
  const finalizadoEm = contratoRow?.finalizado_em ?? new Date().toISOString();
  if (!verificacaoId) {
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const candidato = gerarVerificacaoId();
      try {
        await atualizarContrato(admin, row.contrato_id, {
          status: "assinado",
          verificacao_id: candidato,
          finalizado_em: finalizadoEm,
        });
        verificacaoId = candidato;
        break;
      } catch (e) {
        // 23505 = colisão do índice único de verificacao_id → tenta outro.
        if ((e as { code?: string })?.code !== "23505") throw e;
      }
    }
  } else {
    await atualizarContrato(admin, row.contrato_id, {
      status: "assinado",
      finalizado_em: finalizadoEm,
    });
  }
  await registrarEventoContrato(
    {
      contratoId: row.contrato_id,
      workspaceId: row.workspace_id,
      tipo: "finalizado",
      detalhes: {
        verificacaoId,
        conteudoHash: contratoRow?.conteudo_hash ?? null,
        conteudoVersao: contratoRow?.conteudo_versao ?? 1,
        signatarios: todos.length,
      },
    },
    true
  );
  // PDF final selado (só contratos por UPLOAD): carimba, hasheia e congela.
  // Best-effort — se falhar, a rota do PDF assinado sela na primeira abertura.
  try {
    await selarPdfFinal(admin, row.contrato_id);
  } catch (e) {
    console.warn("[contrato] falha ao selar PDF final:", (e as Error).message);
  }
  return rowParaSignatario(row);
}

/** Preenche URLs assinadas (temporárias) das fotos — pra agência exibir. */
export async function preencherUrls(
  admin: SupabaseClient,
  signatarios: Signatario[]
): Promise<Signatario[]> {
  return Promise.all(
    signatarios.map(async (s) => {
      const { fotoCpf, fotoDocumento, fotoDocumentoVerso, selfie } = s.arquivos;
      if (!fotoCpf && !fotoDocumento && !fotoDocumentoVerso && !selfie)
        return s;
      const urls: ArquivosSignatario = {};
      if (fotoCpf) urls.fotoCpf = (await urlAssinada(admin, fotoCpf)) ?? undefined;
      if (fotoDocumento)
        urls.fotoDocumento =
          (await urlAssinada(admin, fotoDocumento)) ?? undefined;
      if (fotoDocumentoVerso)
        urls.fotoDocumentoVerso =
          (await urlAssinada(admin, fotoDocumentoVerso)) ?? undefined;
      if (selfie) urls.selfie = (await urlAssinada(admin, selfie)) ?? undefined;
      return { ...s, arquivosUrls: urls };
    })
  );
}

/** Resumo dos assinantes por contrato do workspace (status + aberturas). */
export type AssinanteResumo = {
  nome: string;
  status: "pendente" | "assinado";
  aberturas: number;
};

export async function resumoAssinantesDoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<Record<string, AssinanteResumo[]>> {
  const rows = await resumoDoWorkspace(supabase, workspaceId);
  const mapa: Record<string, AssinanteResumo[]> = {};
  for (const row of rows) {
    (mapa[row.contrato_id] ??= []).push({
      nome: row.nome,
      status: row.status === "assinado" ? "assinado" : "pendente",
      aberturas: row.aberturas ?? 0,
    });
  }
  return mapa;
}

/**
 * Registra uma ABERTURA do link (visualização sem assinar): +1 no contador e
 * evento 'aberto' na trilha (best-effort). No-op se já assinou. Chamado na
 * rota pública GET /api/assinar/[token].
 */
export async function registrarAbertura(
  admin: SupabaseClient,
  signatario: { id: string; status: string; aberturas: number; contratoId: string },
  contexto: {
    workspaceId: string;
    ip?: string | null;
    dispositivo?: string | null;
  }
): Promise<void> {
  if (signatario.status === "assinado") return;
  await incrementarAberturas(admin, signatario.id, (signatario.aberturas ?? 0) + 1);
  await registrarEventoContrato({
    contratoId: signatario.contratoId,
    workspaceId: contexto.workspaceId,
    signatarioId: signatario.id,
    tipo: "aberto",
    detalhes: { abertura: (signatario.aberturas ?? 0) + 1 },
    ip: contexto.ip ?? null,
    dispositivo: contexto.dispositivo ?? null,
  });
}
