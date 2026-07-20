import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { pertenceAoWorkspace } from "@/lib/api/pertence";
import { respostaDeErro } from "@/lib/api/erros";
import { atualizarArtista } from "@/lib/repositories/artistas.repo";
import type { ArtistaEscrita } from "@/lib/mappers/artista";

/**
 * /api/perfil — DADOS PESSOAIS do próprio usuário logado.
 *
 * RAMIFICA por papel:
 *  - papel === "artista": os dados pessoais/legais (nome_legal, documento,
 *    telefone, nascimento, país, cidade, razão social, endereço) moram na
 *    tabela `artists` (é de lá que contratos/orçamentos leem, via
 *    profiles.artista_id). Se gravássemos em `profiles` o dado ficaria
 *    invisível pro resto do sistema. Só o APELIDO (`nome`) fica no profile.
 *  - admin / equipe: tudo em `profiles`, como sempre.
 *
 * O e-mail NÃO muda por aqui — é a credencial de login.
 *
 * Whitelist ESTRITA: o schema abaixo é a única superfície aceita. Zod descarta
 * qualquer chave fora dela, então papel/funcoes/escopo/status/workspace_id/
 * is_super_admin/cor/pode_criar_anotacoes NUNCA são graváveis por aqui. (A cor
 * de identificação é tratada no fluxo próprio — não neste endpoint.)
 */
const schema = z.object({
  // Apelido (nome de exibição). No artista fica em profiles; nos demais idem.
  nome: z.string().min(1).max(120).optional(),
  nome_legal: z.string().max(120).nullable().optional(),
  pais: z.string().min(2).max(2).optional(),
  documento_tipo: z.string().max(20).nullable().optional(),
  documento: z.string().max(60).nullable().optional(),
  razao_social: z.string().max(140).nullable().optional(),
  endereco: z.string().max(200).nullable().optional(),
  telefone: z.string().max(40).nullable().optional(),
  data_nascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
    .nullable()
    .optional(),
  // Cidade onde reside (FK cidades). O client resolve a seleção pro UUID do
  // catálogo do próprio workspace antes de mandar; null limpa.
  cidade_id: z.string().uuid().nullable().optional(),
});

/** Colunas da cidade embutida (join por cidade_id) — pré-preenche o seletor. */
const CIDADE_EMBED =
  "cidade:cidades!cidade_id(nome, estado, ibge_id, geoname_id, latitude, longitude, pais)";

type CidadeEmbed = {
  nome: string;
  estado: string | null;
  ibge_id: string | null;
  geoname_id: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  pais: string | null;
} | null;

/** Linha de leitura (profiles OU artists) já normalizada pro shape do GET. */
type LinhaPerfil = {
  nome?: string | null;
  nome_legal: string | null;
  pais: string | null;
  documento_tipo: string | null;
  documento: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  cidade_id: string | null;
  razao_social: string | null;
  endereco: string | null;
  cidade: CidadeEmbed;
};

/** Shape uniforme devolvido pelo GET (as duas ramificações batem). */
type PerfilOut = {
  nome: string;
  nome_legal: string | null;
  pais: string | null;
  documento_tipo: string | null;
  documento: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  cidade_id: string | null;
  razao_social: string | null;
  endereco: string | null;
  cidade: CidadeEmbed;
  /** Cor de identificação do PRÓPRIO avatar — sempre de `profiles.cor`,
   *  inclusive pro artista (é preferência de UI da conta, não dado de
   *  contrato). Gravada só pelo endpoint dedicado /api/perfil/cor. */
  cor: string | null;
};

function montarPerfil(
  nome: string,
  linha: LinhaPerfil | null,
  cor: string | null
): PerfilOut {
  return {
    nome,
    nome_legal: linha?.nome_legal ?? null,
    pais: linha?.pais ?? null,
    documento_tipo: linha?.documento_tipo ?? null,
    documento: linha?.documento ?? null,
    telefone: linha?.telefone ?? null,
    data_nascimento: linha?.data_nascimento ?? null,
    cidade_id: linha?.cidade_id ?? null,
    razao_social: linha?.razao_social ?? null,
    endereco: linha?.endereco ?? null,
    cidade: linha?.cidade ?? null,
    cor,
  };
}

/**
 * GET /api/perfil
 *
 * Prefill dos dados pessoais do próprio usuário, com a MESMA ramificação do
 * PATCH: o artista lê de `artists` (via profiles.artista_id), o resto de
 * `profiles`. Sempre devolve `{ perfil }` no mesmo shape, seja qual for o papel.
 */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  const admin = criarClienteAdmin();

  if (r.sessao.papel === "artista" && r.sessao.artistaId) {
    // Anti-IDOR: escopa por workspace_id. O artista lê só o PRÓPRIO row, e só
    // se ele pertence ao seu tenant (o service_role ignora o RLS).
    // Cor de identidade do artista mora em `artists.cor` (a mesma da Agenda/
    // roster) — o seletor "Cor do meu avatar" mostra e edita ESSA cor.
    const { data: art, error } = await admin
      .from("artists")
      .select(
        `nome_legal, pais, documento_tipo, documento, telefone, data_nascimento, cidade_id, razao_social, endereco, cor, ${CIDADE_EMBED}`
      )
      .eq("id", r.sessao.artistaId)
      .eq("workspace_id", r.sessao.workspaceId)
      .maybeSingle<LinhaPerfil & { cor: string | null }>();
    if (error) {
      return respostaDeErro(error, "Falha ao carregar o perfil.");
    }
    // O apelido mora no profile (não em artists).
    return NextResponse.json({
      perfil: montarPerfil(r.sessao.userNome ?? "", art, art?.cor ?? null),
    });
  }

  // admin / equipe → tudo em profiles.
  const { data: prof, error } = await admin
    .from("profiles")
    .select(
      `nome, nome_legal, pais, documento_tipo, documento, telefone, data_nascimento, cidade_id, razao_social, endereco, cor, ${CIDADE_EMBED}`
    )
    .eq("id", r.sessao.userId)
    .maybeSingle<LinhaPerfil & { cor: string | null }>();
  if (error) {
    return respostaDeErro(error, "Falha ao carregar o perfil.");
  }
  return NextResponse.json({
    perfil: montarPerfil(
      prof?.nome ?? r.sessao.userNome ?? "",
      prof,
      prof?.cor ?? null
    ),
  });
}

/**
 * PATCH /api/perfil
 *
 * Atualiza os DADOS PESSOAIS do próprio usuário logado. Só grava os campos
 * presentes no body; string vazia limpa (vira null). Ver ramificação por papel
 * no cabeçalho do arquivo.
 */
export async function PATCH(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Só os campos presentes; string vazia vira null (limpa o campo).
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    patch[k] = v === "" ? null : v;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const admin = criarClienteAdmin();

  // A cidade é uma FK ao catálogo `cidades`, que é POR WORKSPACE. O client
  // admin (service_role) ignora o RLS, então valida à mão que a cidade existe
  // E pertence a este tenant — senão dá pra fixar o perfil numa cidade de
  // outra agência (ou num UUID inexistente). Só valida quando veio um id (null
  // limpa o campo, fluxo legítimo). Vale pras duas ramificações.
  if (typeof patch.cidade_id === "string" && patch.cidade_id) {
    const ok = await pertenceAoWorkspace(
      admin,
      "cidades",
      patch.cidade_id,
      r.sessao.workspaceId
    );
    if (!ok) {
      return NextResponse.json({ erro: "Cidade inválida." }, { status: 400 });
    }
  }

  // ----- Ramificação ARTISTA: dados pessoais/legais vão pra `artists` -----
  if (r.sessao.papel === "artista" && r.sessao.artistaId) {
    const artistaId = r.sessao.artistaId;

    // Anti-IDOR: confirma que o artista vinculado pertence a este workspace
    // antes de gravar (defesa em profundidade sobre o vínculo do próprio
    // profile).
    const pertence = await pertenceAoWorkspace(
      admin,
      "artists",
      artistaId,
      r.sessao.workspaceId
    );
    if (!pertence) {
      return NextResponse.json({ erro: "Artista inválido." }, { status: 400 });
    }

    // Whitelist de campos que vão pra `artists` (o apelido `nome` NÃO entra —
    // fica no profile).
    const escrita: ArtistaEscrita = {};
    if ("nome_legal" in patch) escrita.nome_legal = patch.nome_legal as string | null;
    if ("pais" in patch) escrita.pais = patch.pais as string | null;
    if ("documento" in patch) escrita.documento = patch.documento as string | null;
    if ("documento_tipo" in patch) {
      // `artists.documento_tipo` tem CHECK in ('cpf','cnpj'). Qualquer outro
      // valor (ex.: "doc" de país estrangeiro) vira null — bate com o cadastro
      // de artista, que deixa nulo fora de BR.
      const dt = patch.documento_tipo;
      escrita.documento_tipo = dt === "cpf" || dt === "cnpj" ? dt : null;
    }
    if ("razao_social" in patch)
      escrita.razao_social = patch.razao_social as string | null;
    if ("endereco" in patch) escrita.endereco = patch.endereco as string | null;
    if ("telefone" in patch) escrita.telefone = patch.telefone as string | null;
    if ("data_nascimento" in patch)
      escrita.data_nascimento = patch.data_nascimento as string | null;
    if ("cidade_id" in patch) escrita.cidade_id = patch.cidade_id as string | null;

    if (Object.keys(escrita).length > 0) {
      try {
        await atualizarArtista(admin, artistaId, escrita);
      } catch (e) {
        return respostaDeErro(e, "Falha ao salvar o perfil.");
      }
    }

    // O apelido (nome de exibição) fica no profile.
    if ("nome" in patch) {
      const { error } = await admin
        .from("profiles")
        .update({ nome: patch.nome })
        .eq("id", r.sessao.userId);
      if (error) {
        return respostaDeErro(error, "Falha ao salvar o perfil.");
      }
    }

    return NextResponse.json({ ok: true });
  }

  // ----- admin / equipe: tudo em `profiles` (como sempre) -----
  const { error } = await admin
    .from("profiles")
    .update(patch)
    .eq("id", r.sessao.userId);
  if (error) {
    return respostaDeErro(error, "Falha ao salvar o perfil.");
  }
  return NextResponse.json({ ok: true });
}
