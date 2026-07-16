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

/** Token do link público — 24 bytes aleatórios, URL-safe (impossível de adivinhar). */
function gerarToken(): string {
  return randomBytes(24).toString("base64url");
}

export type EntradaSignatario = {
  nome: string;
  email?: string | null;
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
  const payloads: SignatarioEscrita[] = entradas.map((e, i) => ({
    contrato_id: contratoId,
    workspace_id: workspaceId,
    nome: e.nome,
    email: e.email ?? null,
    papel: e.papel ?? null,
    ordem: i,
    token: gerarToken(),
    exige: exigeValido(e.exige),
    status: "pendente",
  }));
  const rows = await criarVarios(supabase, payloads);
  await atualizarContrato(supabase, contratoId, { status: "enviado" });
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
): Promise<{ signatario: Signatario; contrato: Contrato } | null> {
  const sigRow = await buscarPorToken(admin, token);
  if (!sigRow) return null;
  const contratoRow = await buscarContrato(admin, sigRow.contrato_id);
  if (!contratoRow) return null;
  return {
    signatario: rowParaSignatario(sigRow),
    contrato: rowParaContrato(contratoRow),
  };
}

/**
 * Forma PÚBLICA de uma assinatura para o relatório no link /assinar/{token}:
 * só os campos visíveis do relatório, SEM foto/selfie/arquivos KYC nem facial
 * (evidência sensível que nunca sai pela rota pública).
 */
export type AssinaturaPublica = {
  nome: string;
  papel: string | null;
  documento: string | null;
  email: string | null;
  ip: string | null;
  geolocalizacao: string | null;
  dispositivo: string | null;
  assinadoEm: string | null;
  assinatura: string | null;
};

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
    documento: s.documento,
    email: s.email,
    ip: s.ip,
    geolocalizacao: s.geolocalizacao,
    dispositivo: s.dispositivo,
    assinadoEm: s.assinadoEm,
    assinatura: s.assinatura,
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
    arquivos,
  });
  if (!row) return null;
  const todos = await listarPorContratoAdmin(admin, row.contrato_id);
  const todosAssinados =
    todos.length > 0 && todos.every((s) => s.status === "assinado");
  await atualizarContrato(admin, row.contrato_id, {
    status: todosAssinados ? "assinado" : "enviado",
  });
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
 * Registra uma ABERTURA do link (visualização sem assinar): +1 no contador.
 * No-op se já assinou. Chamado na rota pública GET /api/assinar/[token].
 */
export async function registrarAbertura(
  admin: SupabaseClient,
  signatario: { id: string; status: string; aberturas: number }
): Promise<void> {
  if (signatario.status === "assinado") return;
  await incrementarAberturas(admin, signatario.id, (signatario.aberturas ?? 0) + 1);
}
