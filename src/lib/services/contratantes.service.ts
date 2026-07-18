import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contratante, DocumentoContratante } from "@/types";
import {
  rowParaContratante,
  type ContratanteEscrita,
} from "@/lib/mappers/contatos";
import {
  listarContratantes as repoListar,
  buscarContratante as repoBuscar,
  criarContratante as repoCriar,
  atualizarContratante as repoAtualizar,
  removerContratante as repoRemover,
} from "@/lib/repositories/contratantes.repo";
import type {
  ContratanteCreateInput,
  ContratanteUpdateInput,
} from "@/lib/validators/contatos.schema";
import type { SessaoAutenticada } from "@/lib/api/session";
import { contratanteIdsVisiveis } from "@/lib/services/contatosAcesso";
import { resolverGeoDoContato } from "@/lib/services/geoContato";
import { ehDocumentoEmpresa, detectarEmpresa } from "@/lib/data/documentos";

function entradaParaEscrita(
  input: ContratanteCreateInput | ContratanteUpdateInput
): ContratanteEscrita {
  const out: ContratanteEscrita = {};
  if (input.nome !== undefined) out.nome = input.nome;
  if (input.documento !== undefined) out.documento = input.documento;
  if (input.razao_social !== undefined) out.razao_social = input.razao_social;
  if (input.pais !== undefined) out.pais = input.pais;
  // Zod normaliza string vazia em e-mail como ""; tratamos como null no banco
  if (input.email !== undefined) out.email = input.email === "" ? null : input.email;
  if (input.telefone !== undefined) out.telefone = input.telefone;
  if (input.endereco !== undefined) out.endereco = input.endereco;
  if (input.cidade_id !== undefined) out.cidade_id = input.cidade_id;
  if (input.observacoes !== undefined) out.observacoes = input.observacoes;
  return out;
}

/**
 * Acumula um documento no histórico do contratante (migração 90).
 *
 * O documento NÃO é chave de identidade (a chave é o telefone) — o mesmo
 * contratante fecha um show com CPF e outro com CNPJ. Por isso ele acumula e
 * nunca entra em popup de divergência: já existe → só atualiza `ultimo_uso`;
 * novo → entra na lista. `contratantes.documento` segue como o principal.
 *
 * Compara por igualdade exata: o cliente já manda normalizado (normalizarDocumento).
 */
function acumularDocumento(
  atuais: DocumentoContratante[],
  documento: string,
  pais: string | undefined,
  razaoSocial: string | undefined,
  agora: string,
  tipoManual: "pf" | "pj" | undefined
): DocumentoContratante[] {
  // Razão social é do DOCUMENTO (migração 91): cada item carrega a SUA. Vazia →
  // não sobrescreve a que já estava (CPF nunca teve; CNPJ mantém a última boa).
  const razao = razaoSocial ? { razao_social: razaoSocial } : {};
  // `tipo` (PF/Empresa manual) grava SÓ quando o país é ambíguo E a escolha veio
  // do cliente. País com regra deriva do documento → não persiste. `tipoManual`
  // undefined → objeto vazio: preserva o `tipo` que já estava (via spread),
  // nunca escreve `tipo: undefined` por cima (o caso de borda crítico do B4).
  const tipo =
    detectarEmpresa(pais, documento) === null && tipoManual ? { tipo: tipoManual } : {};
  const i = atuais.findIndex((d) => d.documento === documento);
  if (i === -1) {
    return [
      ...atuais,
      { documento, ...(pais ? { pais } : {}), ...razao, ...tipo, primeiro_uso: agora, ultimo_uso: agora },
    ];
  }
  const out = [...atuais];
  // Mesmo documento de empresa com razão social diferente ATUALIZA em silêncio
  // (a empresa foi renomeada/corrigida) — nunca vira popup de divergência.
  out[i] = { ...out[i], ...(pais ? { pais } : {}), ...razao, ...tipo, ultimo_uso: agora };
  return out;
}

/**
 * A razão social pertence ao DOCUMENTO, não à pessoa (migração 91): só existe
 * quando o documento é de EMPRESA (`ehDocumentoEmpresa`). Pessoa física (ou
 * documento que a UI marcou como PF num país ambíguo) → sempre null, pra não
 * sobrar razão social órfã de um documento de empresa que virou pessoa.
 *
 * `empresaManual` = a escolha do seletor PF/Empresa (só pesa em país ambíguo;
 * país com regra ignora — a regra ganha).
 */
function razaoSocialCoerente(
  documento: string | null | undefined,
  pais: string | null | undefined,
  razaoSocial: string | null | undefined,
  empresaManual: boolean
): string | null {
  if (!ehDocumentoEmpresa(pais, documento, empresaManual)) return null;
  return (razaoSocial ?? "").trim() || null;
}

/**
 * Aplica bloquear/desbloquear numa escrita de contratante, carimbando
 * quem/quando com o usuário da sessão. Bloquear → grava motivo/por/em.
 * Desbloquear → limpa os 4 campos. Só age se `input.bloqueado` veio no PATCH.
 */
function aplicarBloqueio(
  escrita: ContratanteEscrita,
  input: ContratanteUpdateInput,
  bloqueadoPor?: string
): ContratanteEscrita {
  if (input.bloqueado === undefined) return escrita;
  if (input.bloqueado) {
    return {
      ...escrita,
      bloqueado: true,
      bloqueado_motivo: input.bloqueado_motivo ?? null,
      bloqueado_por: bloqueadoPor ?? null,
      bloqueado_em: new Date().toISOString(),
    };
  }
  return {
    ...escrita,
    bloqueado: false,
    bloqueado_motivo: null,
    bloqueado_por: null,
    bloqueado_em: null,
  };
}

export async function listarContratantesDoWorkspace(
  supabase: SupabaseClient,
  sessao?: SessaoAutenticada
): Promise<Contratante[]> {
  // Visibilidade DERIVADA (modelo novo): só os contratantes que o usuário
  // alcança (criou, fez orçamento/venda, ou é de um artista que ele atende).
  // Admin/legado → "todos". Ver contatosAcesso.ts.
  if (sessao) {
    const visiveis = await contratanteIdsVisiveis(supabase, sessao);
    if (visiveis !== "todos") {
      if (visiveis.size === 0) return [];
      const ids = Array.from(visiveis);
      const rows = await repoListar(supabase, <Q,>(q: Q) =>
        (q as unknown as { in(c: string, v: string[]): unknown }).in("id", ids) as Q
      );
      return rows.map(rowParaContratante);
    }
  }
  const rows = await repoListar(supabase);
  return rows.map(rowParaContratante);
}

export async function buscarContratantePorId(
  supabase: SupabaseClient,
  id: string
): Promise<Contratante | null> {
  const row = await repoBuscar(supabase, id);
  return row ? rowParaContratante(row) : null;
}

export async function criarContratanteNoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  criadoPor: string,
  input: ContratanteCreateInput
): Promise<Contratante> {
  const escrita = entradaParaEscrita(input);
  // País ambíguo (US, GB…) → o cliente manda `documento_tipo`; país com regra
  // ignora (a regra do documento decide).
  const empresaManual = input.documento_tipo === "pj";
  // Razão social segue o documento principal (migração 91): pessoa física → null.
  escrita.razao_social = razaoSocialCoerente(
    escrita.documento,
    escrita.pais,
    input.razao_social,
    empresaManual
  );
  // Documento nasce já acumulado no histórico (migração 90), com a razão dele.
  if (typeof escrita.documento === "string" && escrita.documento.trim()) {
    escrita.documentos = acumularDocumento(
      [],
      escrita.documento,
      escrita.pais ?? undefined,
      escrita.razao_social ?? undefined,
      new Date().toISOString(),
      input.documento_tipo ?? undefined
    );
  }
  // Geocodifica NO CADASTRO (tokens.md §7): endereço → ponto exato;
  // senão centroide da cidade. Falha nunca bloqueia o save.
  const geo = await resolverGeoDoContato(supabase, {
    endereco: escrita.endereco,
    cidadeId: escrita.cidade_id,
    paisIso2: escrita.pais,
  });
  const row = await repoCriar(supabase, workspaceId, criadoPor, { ...escrita, ...geo });
  return rowParaContratante(row);
}

export async function atualizarContratantePorId(
  supabase: SupabaseClient,
  id: string,
  input: ContratanteUpdateInput,
  bloqueadoPor?: string
): Promise<Contratante> {
  let escrita = entradaParaEscrita(input);

  const documentoNovo =
    typeof escrita.documento === "string" && escrita.documento.trim()
      ? escrita.documento
      : null;
  const mexeEmGeo = input.endereco !== undefined || input.cidade_id !== undefined;
  // Documento e razão social andam juntos (migração 91): mexer num decide o outro.
  const mexeEmRazao = input.documento !== undefined || input.razao_social !== undefined;

  // Uma leitura só, compartilhada pelo re-geocode, o acúmulo de documento e a razão social.
  const atual =
    mexeEmGeo || documentoNovo || mexeEmRazao ? await repoBuscar(supabase, id) : null;

  // Razão social segue o documento PRINCIPAL final (o input é parcial: o que não
  // veio agora vem do cadastro). Trocar empresa por pessoa física zera a razão.
  //
  // Razão VAZIA = "não informada", não "apague" — mesma semântica do
  // `acumularDocumento` acima, senão as duas metades do dado (coluna e jsonb)
  // divergem. Sem isso, qualquer PATCH que mande o documento com a razão em
  // branco (form que não reidratou, campo escondido) apaga a razão do cadastro
  // em silêncio. Quem zera é só empresa→pessoa, pelo `ehDocumentoEmpresa`.
  //
  // Em país AMBÍGUO, a reedição que NÃO reenviou o seletor (documento_tipo
  // undefined) não pode zerar a razão de um contato pj — cai no `tipo` salvo no
  // histórico. Este é O caso de borda crítico do B4.
  if (mexeEmRazao) {
    const razaoInformada = (input.razao_social ?? "").trim() ? input.razao_social : undefined;
    const docFinal = input.documento !== undefined ? escrita.documento : atual?.documento;
    const tipoSalvo = ((atual?.documentos ?? []) as DocumentoContratante[]).find(
      (d) => d.documento === docFinal
    )?.tipo;
    const empresaManual = input.documento_tipo
      ? input.documento_tipo === "pj"
      : tipoSalvo === "pj";
    escrita.razao_social = razaoSocialCoerente(
      docFinal,
      escrita.pais ?? atual?.pais,
      razaoInformada ?? atual?.razao_social,
      empresaManual
    );
  }

  // Documento ACUMULA (migração 90) — nunca é sobrescrito no histórico, e nunca
  // entra em popup de divergência. `documento` segue como o principal (último usado).
  if (documentoNovo) {
    escrita.documentos = acumularDocumento(
      (atual?.documentos ?? []) as DocumentoContratante[],
      documentoNovo,
      escrita.pais ?? atual?.pais ?? undefined,
      escrita.razao_social ?? undefined,
      new Date().toISOString(),
      input.documento_tipo ?? undefined
    );
  }

  // Re-geocodifica SÓ se endereço/cidade mudaram (cache via geocoded_at).
  if (mexeEmGeo) {
    const enderecoNovo = input.endereco !== undefined ? (input.endereco ?? null) : (atual?.endereco ?? null);
    const cidadeNova = input.cidade_id !== undefined ? (input.cidade_id ?? null) : (atual?.cidade_id ?? null);
    const mudou =
      (atual?.endereco ?? null) !== enderecoNovo ||
      (atual?.cidade_id ?? null) !== cidadeNova ||
      atual?.lat == null; // nunca geocodificado → aproveita o save
    if (mudou) {
      const geo = await resolverGeoDoContato(supabase, {
        endereco: enderecoNovo,
        cidadeId: cidadeNova,
        paisIso2: input.pais ?? atual?.pais ?? null,
      });
      escrita = { ...escrita, ...geo };
    }
  }

  // Bloquear/desbloquear carimba quem/quando com o usuário da sessão.
  escrita = aplicarBloqueio(escrita, input, bloqueadoPor);

  const row = await repoAtualizar(supabase, id, escrita);
  return rowParaContratante(row);
}

export async function removerContratantePorId(
  supabase: SupabaseClient,
  id: string,
  deletadoPor?: string
): Promise<void> {
  await repoRemover(supabase, id, deletadoPor);
}
