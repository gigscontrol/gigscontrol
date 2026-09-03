import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { documentoValido } from "@/lib/documento";
import type {
  Signatario,
  SignatarioRow,
  SignatarioEscrita,
  ExigenciasSignatario,
  ArquivosSignatario,
} from "@/lib/mappers/contratoSignatario";
import { uploadFoto, urlAssinada } from "@/lib/db/storage-assinaturas";
import { compararFaces } from "@/lib/db/rekognition";
import {
  rowParaSignatario,
  exigeValido,
  arquivosValido,
} from "@/lib/mappers/contratoSignatario";
import {
  listarPorContrato,
  removerPendentes,
  criarVarios,
  removerSignatario as repoRemover,
  buscarPorToken,
  atualizarPorToken,
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
  gerarCodigoOtp,
  hashOtp,
  gerarTokenConfirmacao,
  hashTokenConfirmacao,
  OTP_VALIDADE_MIN,
} from "@/lib/contratos/integridade";
import { cpfValido } from "@/lib/pix";
import { mailerConfigurado, enviarEmail } from "@/lib/mailer";
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

/** Mailer ausente (RESEND_API_KEY) — a rota traduz pra 503 com mensagem clara. */
export class MailerIndisponivelError extends Error {
  status = 503;
  constructor() {
    super(
      "O envio de e-mail ainda não está configurado na plataforma. Fale com a agência para concluir a assinatura de outra forma."
    );
    this.name = "MailerIndisponivelError";
  }
}

/** Prazo dos 30 minutos do código/botão vencido — a rota traduz pra 410. */
export class ConfirmacaoExpiradaError extends Error {
  status = 410;
  constructor() {
    super(
      "O prazo de 30 minutos para confirmar expirou. Abra o link do contrato e assine novamente."
    );
    this.name = "ConfirmacaoExpiradaError";
  }
}

/** Pacote da assinatura guardado em `pendente_payload` até a confirmação. */
type PayloadAssinatura = {
  assinatura: string | null;
  documento: string | null;
  ip: string | null;
  geolocalizacao: string | null;
  dispositivo: string | null;
  fuso_horario: string | null;
  metodo_autenticacao: string | null;
  arquivos: ArquivosSignatario;
  nome_completo: string | null;
  data_nascimento: string | null;
};

export type ResultadoAssinatura =
  | { status: "assinado"; signatario: Signatario }
  | { status: "aguardando"; expiraEm: string };

/**
 * EFETIVA a assinatura (uma única vez): grava a linha como assinada, sela o
 * evento obrigatório na trilha e, se todos assinaram, finaliza o contrato
 * (verificacao_id + PDF selado). Chamada direto (sem OTP) ou na confirmação.
 */
async function efetivarAssinatura(
  admin: SupabaseClient,
  token: string,
  payload: PayloadAssinatura
): Promise<Signatario | null> {
  const row = await registrarAssinaturaPorToken(admin, token, payload);
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
        metodo: payload.metodo_autenticacao,
        documento: payload.documento
          ? `****${payload.documento.replace(/\D/g, "").slice(-2)}`
          : null,
        geolocalizacao: !!payload.geolocalizacao,
        ...(payload.nome_completo ? { cpfAvancado: true } : {}),
        ...(payload.arquivos.facialSimilaridade !== undefined
          ? {
              facialSimilaridade: payload.arquivos.facialSimilaridade,
              facialMatch: payload.arquivos.facialMatch ?? false,
            }
          : {}),
      },
      ip: payload.ip,
      dispositivo: payload.dispositivo,
      fusoHorario: payload.fuso_horario,
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

/** Monta e envia o e-mail de confirmação (código + botão mágico). */
async function enviarEmailConfirmacao(
  admin: SupabaseClient,
  sigRow: SignatarioRow,
  numeroContrato: string
): Promise<string> {
  if (!sigRow.email) {
    throw new ExigenciaNaoAtendidaError(
      "Este signatário não tem e-mail cadastrado. Fale com a agência."
    );
  }
  if (!mailerConfigurado()) throw new MailerIndisponivelError();

  const codigo = gerarCodigoOtp();
  const tokenBotao = gerarTokenConfirmacao();
  const expiraEm = new Date(Date.now() + OTP_VALIDADE_MIN * 60_000).toISOString();
  await atualizarPorToken(admin, sigRow.token, {
    otp_hash: hashOtp(sigRow.token, codigo),
    otp_expira_em: expiraEm,
    otp_tentativas: 0,
    confirm_token_hash: hashTokenConfirmacao(tokenBotao),
  });

  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://gigscontrol.com").replace(/\/$/, "");
  const urlBotao = `${base}/assinar/concluir/${tokenBotao}`;
  const assunto = `Confirme sua assinatura — contrato ${numeroContrato}`;
  const texto = [
    `Olá, ${sigRow.nome}!`,
    "",
    `Recebemos sua assinatura do contrato ${numeroContrato}. Falta só confirmar que este e-mail é seu.`,
    "",
    `Código de confirmação: ${codigo}`,
    "",
    `Ou conclua com um clique: ${urlBotao}`,
    "",
    `O código e o botão valem por ${OTP_VALIDADE_MIN} minutos. Se você não pediu isto, ignore este e-mail.`,
    "",
    "GIGS CONTROL",
  ].join("\n");
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1c1c22">
    <div style="font-weight:800;letter-spacing:.14em;font-size:14px;margin-bottom:16px">GIGS CONTROL</div>
    <h2 style="font-size:20px;margin:0 0 8px">Confirme sua assinatura</h2>
    <p style="margin:0 0 16px;line-height:1.6">Olá, <strong>${sigRow.nome}</strong>! Recebemos sua assinatura do contrato <strong>${numeroContrato}</strong>. Falta só confirmar que este e-mail é seu.</p>
    <p style="margin:0 0 6px;color:#6d6d78;font-size:13px">Digite este código na página de assinatura:</p>
    <div style="font-size:32px;font-weight:700;letter-spacing:.35em;text-align:center;background:#f6f6f8;border:1px solid #e3e3ea;border-radius:8px;padding:14px 0;margin-bottom:20px">${codigo}</div>
    <p style="margin:0 0 10px;color:#6d6d78;font-size:13px">Ou, se preferir, conclua com um clique:</p>
    <div style="text-align:center;margin-bottom:20px">
      <a href="${urlBotao}" style="display:inline-block;background:#3D7BFF;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:8px">Concluir assinatura</a>
    </div>
    <p style="color:#6d6d78;font-size:12px;line-height:1.6;margin:0">O código e o botão valem por <strong>${OTP_VALIDADE_MIN} minutos</strong>. Depois disso será preciso assinar novamente pelo mesmo link. Se você não pediu isto, ignore este e-mail.</p>
  </div>`;
  await enviarEmail({ para: sigRow.email, assunto, texto, html });

  await registrarEventoContrato({
    contratoId: sigRow.contrato_id,
    workspaceId: sigRow.workspace_id,
    signatarioId: sigRow.id,
    tipo: "otp_enviado",
    detalhes: {
      email: sigRow.email.replace(/^(..).*(@.*)$/, "$1***$2"),
      validadeMin: OTP_VALIDADE_MIN,
    },
  });
  return expiraEm;
}

/** Limpa o staging (expirou ou foi cancelado). */
async function limparPendente(admin: SupabaseClient, token: string): Promise<void> {
  await atualizarPorToken(admin, token, {
    pendente_payload: null,
    otp_hash: null,
    otp_expira_em: null,
    confirm_token_hash: null,
  });
}

/**
 * REENVIA o código/botão de uma assinatura pendente (mesmo payload, código e
 * token novos, prazo renovado). 404 lógico se não há nada pendente.
 */
export async function reenviarConfirmacao(
  admin: SupabaseClient,
  token: string
): Promise<{ expiraEm: string } | null> {
  const sigRow = await buscarPorToken(admin, token);
  if (!sigRow || sigRow.status === "assinado" || !sigRow.pendente_payload) {
    return null;
  }
  const contratoRow = await buscarContrato(admin, sigRow.contrato_id);
  const expiraEm = await enviarEmailConfirmacao(
    admin,
    sigRow,
    contratoRow?.numero ?? ""
  );
  return { expiraEm };
}

/**
 * CONFIRMA uma assinatura pendente (código digitado OU botão do e-mail) e a
 * EFETIVA. Expirado → limpa o staging e lança ConfirmacaoExpiradaError (a
 * pessoa reabre o MESMO link e assina de novo).
 */
export async function confirmarAssinaturaPendente(
  admin: SupabaseClient,
  sigRow: SignatarioRow,
  via: "codigo" | "botao"
): Promise<Signatario | null> {
  const payload = sigRow.pendente_payload as PayloadAssinatura | null;
  if (!payload) return null;
  if (!sigRow.otp_expira_em || new Date(sigRow.otp_expira_em) < new Date()) {
    await limparPendente(admin, sigRow.token);
    throw new ConfirmacaoExpiradaError();
  }
  await atualizarPorToken(admin, sigRow.token, {
    otp_verificado_em: new Date().toISOString(),
  });
  await registrarEventoContrato({
    contratoId: sigRow.contrato_id,
    workspaceId: sigRow.workspace_id,
    signatarioId: sigRow.id,
    tipo: "otp_verificado",
    detalhes: { via },
  });
  return efetivarAssinatura(admin, sigRow.token, {
    ...payload,
    arquivos: arquivosValido(payload.arquivos),
  });
}

/**
 * Registra a assinatura (uma única vez). Sem OTP: efetiva na hora. Com a
 * exigência de e-mail (otpEmail): guarda o pacote como PENDENTE, envia o
 * código + botão por e-mail e a assinatura só conta após a confirmação.
 * Devolve null se o link já tinha sido assinado / é inválido.
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
    /** CPF avançado (mig 99): nome completo + nascimento declarados. */
    nomeCompleto?: string | null;
    dataNascimento?: string | null;
    fotoCpf?: string | null;
    fotoDocumento?: string | null;
    fotoDocumentoVerso?: string | null;
    selfie?: string | null;
  }
): Promise<ResultadoAssinatura | null> {
  // Confere antes de subir foto (evita upload pra link já assinado/inválido).
  const sigRow = await buscarPorToken(admin, token);
  if (!sigRow || sigRow.status === "assinado") return null;

  // Enforcement server-side das exigências ANTES de qualquer upload/facial.
  // O cliente também valida (UX), mas o servidor é a autoridade — um POST cru
  // não pode assinar pulando selfie/facial/documento nem mandar CPF inválido.
  const exige = exigeValido(sigRow.exige);
  if (exige.cpfCnpj && !documentoValido(dados.documento ?? "")) {
    throw new ExigenciaNaoAtendidaError("CPF/CNPJ inválido ou não informado.");
  }
  if (exige.cpfAvancado) {
    // CPF AVANÇADO: CPF com dígitos verificadores REAIS + nome completo +
    // data de nascimento (checagem em base oficial é plugável via provedor).
    if (!cpfValido(dados.documento ?? "")) {
      throw new ExigenciaNaoAtendidaError(
        "CPF inválido — confira os 11 dígitos."
      );
    }
    const nome = (dados.nomeCompleto ?? "").trim();
    if (nome.split(/\s+/).length < 2) {
      throw new ExigenciaNaoAtendidaError("Informe o nome completo.");
    }
    const nasc = (dados.dataNascimento ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nasc)) {
      throw new ExigenciaNaoAtendidaError("Informe a data de nascimento.");
    }
    const idade =
      (Date.now() - new Date(`${nasc}T00:00:00Z`).getTime()) / 31_557_600_000;
    if (!Number.isFinite(idade) || idade < 14 || idade > 120) {
      throw new ExigenciaNaoAtendidaError("Data de nascimento inválida.");
    }
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

  const payload: PayloadAssinatura = {
    assinatura: dados.assinatura,
    documento: dados.documento,
    ip: dados.ip,
    geolocalizacao: dados.geolocalizacao,
    dispositivo: dados.dispositivo,
    fuso_horario: dados.fusoHorario ?? null,
    metodo_autenticacao: exige.otpEmail ? "email_otp" : "link",
    arquivos,
    nome_completo: exige.cpfAvancado ? (dados.nomeCompleto ?? "").trim() : null,
    data_nascimento: exige.cpfAvancado ? (dados.dataNascimento ?? null) : null,
  };

  if (exige.otpEmail) {
    // PENDENTE: guarda o pacote e espera o código/botão do e-mail (30 min).
    await atualizarPorToken(admin, token, {
      pendente_payload: payload as unknown as Record<string, unknown>,
    });
    const contratoRow = await buscarContrato(admin, sigRow.contrato_id);
    const expiraEm = await enviarEmailConfirmacao(
      admin,
      sigRow,
      contratoRow?.numero ?? ""
    );
    return { status: "aguardando", expiraEm };
  }

  const signatario = await efetivarAssinatura(admin, token, payload);
  if (!signatario) return null;
  return { status: "assinado", signatario };
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
