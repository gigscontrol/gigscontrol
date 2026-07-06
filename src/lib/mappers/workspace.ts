import type { PlanoId } from "@/lib/planos";

/** Row da tabela `workspaces`. */
export type WorkspaceRow = {
  id: string;
  nome: string;
  plano: string;
  ciclo: string | null;
  status: string | null;
  logo_url: string | null;
  slug: string | null;
  whatsapp: string | null;
  cor_acento: string | null;
  cidade_ibge_id: string | null;
  cidade_nome: string | null;
  cidade_uf: string | null;
  idioma_padrao: string | null;
  pais_padrao: string | null;
  formato_data: string | null;
  fuso_padrao: string | null;
  criado_em: string | null;
};

/** Aparência consumida pela UI (lê do workspace-context). */
export type WorkspaceAparencia = {
  nomeAgencia: string;
  logoUrl: string | null;
};

export type WorkspaceResumo = WorkspaceAparencia & {
  id: string;
  plano: PlanoId;
  ciclo: string | null;
  status: string | null;
  /** Slug único — vai pro fim do username dos artistas/equipe. */
  slug: string;
  /** Identidade (adicionado na etapa 26 — onboarding wizard). */
  whatsapp: string | null;
  corAcento: string | null;
  cidadeIbgeId: string | null;
  cidadeNome: string | null;
  cidadeUf: string | null;
  /** Preferências da agência (migração 45): idioma, país e formato de data. */
  idiomaPadrao: string | null;
  paisPadrao: string | null;
  formatoData: string | null;
  /** Fuso horário padrão da agência (IANA). Display-only; pré-preenche o evento. */
  fusoPadrao: string | null;
  /** ISO timestamp da criação do workspace (limite inferior dos filtros de data). */
  criadoEm: string | null;
};

export function rowParaWorkspace(row: WorkspaceRow): WorkspaceResumo {
  return {
    id: row.id,
    nomeAgencia: row.nome,
    logoUrl: row.logo_url,
    plano: row.plano as PlanoId,
    ciclo: row.ciclo,
    status: row.status,
    slug: row.slug ?? "",
    whatsapp: row.whatsapp,
    corAcento: row.cor_acento,
    cidadeIbgeId: row.cidade_ibge_id,
    cidadeNome: row.cidade_nome,
    cidadeUf: row.cidade_uf,
    idiomaPadrao: row.idioma_padrao,
    paisPadrao: row.pais_padrao,
    formatoData: row.formato_data,
    fusoPadrao: row.fuso_padrao,
    criadoEm: row.criado_em,
  };
}
