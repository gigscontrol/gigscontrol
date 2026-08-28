/**
 * SETORES DA AGENDA — fonte ÚNICA da visibilidade da ficha do show.
 *
 * A agenda deixou de ter dois níveis de leitura (`agenda.ver` básico ×
 * `agenda.ver_detalhado` completo) e passou a ter UMA CHAVE POR SETOR. Os três
 * modos do editor viraram presets do mesmo mecanismo:
 *
 *   BÁSICO        → os 4 setores marcados `noBasico`
 *   ACESSO TOTAL  → todos os setores + criar/editar/excluir item de agenda
 *   PERSONALIZADO → o admin liga setor a setor, na ordem desta lista
 *
 * Este arquivo é consumido por TODOS os lados — catálogo, editor, redação no
 * servidor e o modal — justamente pra que "ligado no editor" e "aparece na
 * tela" nunca possam divergir. Setor novo se adiciona AQUI e em mais lugar
 * nenhum.
 *
 * Puro de propósito (zero import de servidor/React): dá pra provar por
 * execução em `scripts/test-setores-agenda.ts`.
 */

export type SetorAgenda =
  | "contratante"
  | "local"
  | "detalhes"
  | "pagamento"
  | "lineup"
  | "camarim"
  | "efeitos"
  | "tecnico"
  | "logistica"
  | "hotel"
  | "anotacoes"
  | "observacoes"
  | "documentos";

export type DefSetorAgenda = {
  setor: SetorAgenda;
  /** Chave de permissão. Sempre `agenda.ver.<setor>`. */
  chave: string;
  /** Rótulo no editor (PT é a chave do i18n). */
  label: string;
  /** O que o setor entrega — some no editor pra não virar adivinhação. */
  descricao: string;
  /** Entra no preset BÁSICO? */
  noBasico: boolean;
};

/** Ordem definida pelo dono; Hotel entra junto de Logística (viagem/estadia). */
export const SETORES_AGENDA: readonly DefSetorAgenda[] = [
  {
    setor: "contratante",
    chave: "agenda.ver.contratante",
    label: "Contratante",
    descricao: "Nome, telefone, e-mail, documento e endereço",
    noBasico: false,
  },
  {
    setor: "local",
    chave: "agenda.ver.local",
    label: "Local do evento",
    descricao: "Local, evento, Instagram, endereço, cidade e capacidade",
    noBasico: true,
  },
  {
    setor: "detalhes",
    chave: "agenda.ver.detalhes",
    label: "Detalhes do show",
    descricao: "Horário de apresentação e duração",
    noBasico: true,
  },
  {
    setor: "pagamento",
    chave: "agenda.ver.pagamento",
    label: "Pagamento",
    descricao: "Cachê, parcelas, recebido, a receber e atrasado",
    noBasico: false,
  },
  {
    setor: "lineup",
    chave: "agenda.ver.lineup",
    label: "Line-Up",
    descricao: "Outros artistas do evento",
    noBasico: true,
  },
  {
    setor: "camarim",
    chave: "agenda.ver.camarim",
    label: "Rider de Camarim",
    descricao: "Itens de camarim e consumação",
    noBasico: false,
  },
  {
    setor: "efeitos",
    chave: "agenda.ver.efeitos",
    label: "Rider de Efeitos",
    descricao: "Efeitos contratados para o show",
    noBasico: false,
  },
  {
    setor: "tecnico",
    chave: "agenda.ver.tecnico",
    label: "Rider Técnico",
    descricao: "Exigências técnicas do artista",
    noBasico: false,
  },
  {
    setor: "logistica",
    chave: "agenda.ver.logistica",
    label: "Logística",
    descricao: "Aéreo e translado",
    noBasico: false,
  },
  {
    setor: "hotel",
    chave: "agenda.ver.hotel",
    label: "Hotel",
    descricao: "Hospedagem, check-in/out e voucher (dado pessoal do hóspede)",
    noBasico: false,
  },
  {
    setor: "anotacoes",
    chave: "agenda.ver.anotacoes",
    label: "Anotações",
    descricao: "Anotações do show",
    noBasico: true,
  },
  {
    setor: "observacoes",
    chave: "agenda.ver.observacoes",
    label: "Observações internas",
    descricao: "Campo de observações da venda/orçamento",
    noBasico: false,
  },
  {
    setor: "documentos",
    chave: "agenda.ver.documentos",
    label: "Documentos vinculados",
    descricao: "Contrato, venda e orçamento ligados ao show",
    noBasico: false,
  },
] as const;

/** Chave de permissão do setor. */
export function chaveDoSetor(setor: SetorAgenda): string {
  return `agenda.ver.${setor}`;
}

export const CHAVES_SETORES_AGENDA: readonly string[] = SETORES_AGENDA.map(
  (s) => s.chave
);

/** Só os setores do preset BÁSICO. */
export const CHAVES_SETORES_BASICO: readonly string[] = SETORES_AGENDA.filter(
  (s) => s.noBasico
).map((s) => s.chave);

// ============================================================
// LEGADO — `agenda.ver` e `agenda.ver_detalhado`
//
// Vínculos gravados antes desta mudança guardam as duas chaves antigas. NÃO
// reescrevemos o banco: expandimos na LEITURA, nos dois lados (sessão do
// servidor e do cliente). Assim ninguém perde nem ganha acesso no deploy, e o
// editor mostra o preset certo sem depender de migração de dado.
//
//   agenda.ver_detalhado → todos os setores
//   agenda.ver           → só os do básico
// ============================================================

export const CHAVE_LEGADO_BASICO = "agenda.ver";
export const CHAVE_LEGADO_DETALHADO = "agenda.ver_detalhado";

/**
 * Troca as chaves legadas de leitura pelos setores equivalentes. Idempotente:
 * rodar duas vezes dá o mesmo resultado. Chaves não-legadas passam intactas.
 */
export function expandirLegadoAgenda(chaves: readonly string[]): string[] {
  const temDetalhado = chaves.includes(CHAVE_LEGADO_DETALHADO);
  const temBasico = chaves.includes(CHAVE_LEGADO_BASICO);
  if (!temDetalhado && !temBasico) return [...chaves];

  const saida = new Set(
    chaves.filter(
      (c) => c !== CHAVE_LEGADO_BASICO && c !== CHAVE_LEGADO_DETALHADO
    )
  );
  // Detalhado GANHA do básico: quem tinha os dois via tudo.
  for (const c of temDetalhado ? CHAVES_SETORES_AGENDA : CHAVES_SETORES_BASICO) {
    saida.add(c);
  }
  return [...saida];
}

/** Aplica `expandirLegadoAgenda` em todos os vínculos de uma vez. */
export function expandirLegadoNosVinculos(
  vinculos: Record<string, string[]>
): Record<string, string[]> {
  const saida: Record<string, string[]> = {};
  for (const [artistaId, chaves] of Object.entries(vinculos)) {
    saida[artistaId] = expandirLegadoAgenda(chaves);
  }
  return saida;
}
