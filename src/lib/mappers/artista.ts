import type { Artista, TaxaAgenciaModo, Cidade } from "@/types";
import { PRIVACIDADE_DJ_PADRAO, type PrivacidadeDj } from "@/lib/permissoes";
import { rowParaCidade, type CidadeRow } from "@/lib/mappers/contatos";

export type ArtistaRow = {
  id: string;
  workspace_id: string;
  nome: string;
  cor: string | null;
  acesso_suspenso: boolean | null;
  deletado_em: string | null;
  criado_em: string | null;
  // Cadastro completo (migração 21) — cidade denormalizada só-BR (legado)
  cidade_ibge_id: string | null;
  cidade_nome: string | null;
  cidade_uf: string | null;
  // Cidade global canônica (migração 82, FK cidades)
  cidade_id: string | null;
  /** Cidade embutida (join por cidade_id) — só nos SELECTs que embedam. */
  cidade?: CidadeRow | null;
  // Dados do contratado p/ contrato (migração 37) + país (migração 52)
  pais: string | null;
  nome_legal: string | null;
  documento_tipo: string | null;
  documento: string | null;
  razao_social: string | null;
  endereco: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  email: string | null;
  taxa_modo: TaxaAgenciaModo | null;
  taxa_valor: number | string | null; // numeric vem como string do PG às vezes
  rider_camarim: unknown; // jsonb — pode ser string[] ou formato legado {nome,qtdSugerida}
  rider_efeitos: unknown;
  rider_tecnico: unknown;
  // Privacidade do DJ (migração 33) — jsonb. Default '{}' no banco;
  // o objeto completo vem do merge em privacidadeValida.
  privacidade?: unknown;
  // Posição manual (migração 23). Quanto menor, mais no topo.
  posicao: number | null;
  // Username vem por JOIN com profiles na consulta (não está em artists)
  username?: string | null;
};

/**
 * Normaliza o rider para string[] (lista de nomes).
 * Aceita 2 formatos pra retrocompat:
 *  - Atual:  ["Jack Daniels", "Red Bull"]
 *  - Legado: [{nome:"Jack Daniels", qtdSugerida:1}] — pega só o nome
 */
function normalizarRider(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (typeof r === "string") return r.trim();
      if (typeof r === "object" && r !== null) {
        const nome = (r as { nome?: unknown }).nome;
        return typeof nome === "string" ? nome.trim() : "";
      }
      return "";
    })
    .filter((s) => s.length > 0);
}

/**
 * Normaliza o JSON do banco para o tipo PrivacidadeDj.
 * Merge campo-a-campo sobre PRIVACIDADE_DJ_PADRAO: cada boolean só é
 * aceito se for de fato boolean; o enum `contatos` só aceita
 * 'nenhum'|'proprios'|'todos'. Qualquer outro valor cai no default.
 * Retrocompat: registros antigos SEM `agendaTotal` viram false (padrão);
 * `contatos` legado ('todos'/'proprios') continua válido. Registros SEM
 * `financeiroVerTaxa` herdam o valor de `financeiroVer` (artista que via o
 * financeiro continua vendo a taxa); só um `false` explícito oculta a taxa.
 */
export function privacidadeValida(raw: unknown): PrivacidadeDj {
  if (!raw || typeof raw !== "object") return { ...PRIVACIDADE_DJ_PADRAO };
  const r = raw as Record<string, unknown>;
  const bool = (k: keyof PrivacidadeDj): boolean =>
    typeof r[k] === "boolean" ? (r[k] as boolean) : (PRIVACIDADE_DJ_PADRAO[k] as boolean);
  const financeiroVer = bool("financeiroVer");
  return {
    orcamentosVer: bool("orcamentosVer"),
    orcamentosCriar: bool("orcamentosCriar"),
    vendasVer: bool("vendasVer"),
    vendasCriar: bool("vendasCriar"),
    financeiroVer,
    // Ausente no jsonb salvo → herda financeiroVer (retrocompat). Presente →
    // respeita o boolean salvo (inclusive false para ocultar a taxa).
    financeiroVerTaxa:
      typeof r.financeiroVerTaxa === "boolean" ? r.financeiroVerTaxa : financeiroVer,
    financeiroInformar: bool("financeiroInformar"),
    contratosVer: bool("contratosVer"),
    contratosCriar: bool("contratosCriar"),
    agendaTotal: bool("agendaTotal"),
    contatos:
      r.contatos === "nenhum" || r.contatos === "proprios" || r.contatos === "todos"
        ? r.contatos
        : PRIVACIDADE_DJ_PADRAO.contatos,
  };
}

export function rowParaArtista(row: ArtistaRow): Artista {
  const artista: Artista = {
    id: row.id,
    name: row.nome,
    color: row.cor ?? "#3b82f6",
    acessoSuspenso: !!row.acesso_suspenso,
    taxaModo: row.taxa_modo ?? "sem-taxa",
    riderCamarim: normalizarRider(row.rider_camarim),
    riderEfeitos: normalizarRider(row.rider_efeitos),
    riderTecnico: normalizarRider(row.rider_tecnico),
    privacidade: privacidadeValida(row.privacidade),
  };
  if (row.cidade_ibge_id) artista.cidadeIbgeId = row.cidade_ibge_id;
  if (row.cidade_nome) artista.cidadeNome = row.cidade_nome;
  if (row.cidade_uf) artista.cidadeUf = row.cidade_uf;
  if (row.cidade_id) artista.cidadeId = row.cidade_id;
  if (row.cidade) artista.cidade = rowParaCidade(row.cidade);
  if (row.pais) artista.pais = row.pais;
  if (row.nome_legal) artista.nomeLegal = row.nome_legal;
  if (row.documento_tipo === "cpf" || row.documento_tipo === "cnpj")
    artista.documentoTipo = row.documento_tipo;
  if (row.documento) artista.documento = row.documento;
  if (row.razao_social) artista.razaoSocial = row.razao_social;
  if (row.endereco) artista.endereco = row.endereco;
  if (row.telefone) artista.telefone = row.telefone;
  if (row.data_nascimento) artista.dataNascimento = row.data_nascimento;
  if (row.email) artista.email = row.email;
  if (row.taxa_valor !== null && row.taxa_valor !== undefined) {
    const n = Number(row.taxa_valor);
    if (Number.isFinite(n)) artista.taxaValor = n;
  }
  if (row.username) artista.username = row.username;
  return artista;
}

/**
 * Redige a PII pessoal/legal e a taxa (fee da agência) de um artista para
 * quem NÃO é admin. Mantém o operacional (nome, cor, cidade, riders, username,
 * privacidade). Usado no GET /api/artistas — a lista é carregada por QUALQUER
 * usuário logado (workspace-context), então não pode vazar CPF/endereço/telefone
 * /razão social nem o fee de todos os artistas.
 */
export function redigirArtista(artista: Artista): Artista {
  const limpo: Artista = { ...artista, taxaModo: "sem-taxa" };
  delete limpo.taxaValor;
  delete limpo.nomeLegal;
  delete limpo.documentoTipo;
  delete limpo.documento;
  delete limpo.razaoSocial;
  delete limpo.endereco;
  delete limpo.telefone;
  delete limpo.dataNascimento;
  delete limpo.email;
  return limpo;
}

export type ArtistaEscrita = {
  workspace_id?: string;
  nome?: string;
  cor?: string;
  acesso_suspenso?: boolean;
  cidade_ibge_id?: string | null;
  cidade_nome?: string | null;
  cidade_uf?: string | null;
  cidade_id?: string | null;
  pais?: string | null;
  nome_legal?: string | null;
  documento_tipo?: string | null;
  documento?: string | null;
  razao_social?: string | null;
  endereco?: string | null;
  telefone?: string | null;
  data_nascimento?: string | null;
  email?: string | null;
  taxa_modo?: TaxaAgenciaModo;
  taxa_valor?: number | null;
  rider_camarim?: string[];
  rider_efeitos?: string[];
  rider_tecnico?: string[];
  posicao?: number;
  // Aceita parcial: o que o admin manda é gravado direto no jsonb; o
  // objeto completo é reconstruído na leitura por privacidadeValida
  // (merge sobre PRIVACIDADE_DJ_PADRAO).
  privacidade?: Partial<PrivacidadeDj>;
};
