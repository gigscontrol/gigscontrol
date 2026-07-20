/**
 * FICHA DO SHOW — o que a agenda mostra, montado e REDIGIDO NO SERVIDOR.
 *
 * Antes o modal montava a ficha no CLIENTE, juntando a venda pelo `vendaId`
 * (`vendas.find(...)`). Isso tinha dois problemas graves:
 *
 *  1. `/api/vendas` responde 403 pra quem não tem chave de VENDAS. Um usuário
 *     com "Acesso total" na AGENDA recebia a lista vazia, e Contratante,
 *     Pagamento, Camarim, Efeitos, Logística e Documentos apareciam vazios —
 *     não por permissão de agenda, mas porque o dado nunca chegava.
 *  2. Redigir no cliente é teatro: o valor viaja no JSON e só é escondido na
 *     pintura. Quem abre o DevTools vê tudo.
 *
 * Agora o servidor monta a ficha e APAGA setor a setor conforme as chaves
 * `agenda.ver.*`. O que o usuário não pode ver não sai do servidor.
 *
 * A redação é pura (recebe `podeVer`) pra poder ser provada por execução —
 * `scripts/test-ficha-agenda.ts`.
 */

import type { SetorAgenda } from "@/lib/permissoes/setoresAgenda";
import type {
  ItemQuantidade,
  LogisticaSelecao,
  Moeda,
  Parcela,
} from "@/types";

export type FichaContratante = {
  nome: string;
  telefone?: string;
  email?: string;
  documento?: string;
  endereco?: string;
};

export type FichaLocal = {
  nomeLocal?: string;
  nomeEvento?: string;
  instagram?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  regiao?: string;
  capacidade?: number;
};

export type FichaDetalhes = {
  dataISO?: string;
  horario?: string;
  horarioFim?: string;
  duracaoHoras?: number;
  duracaoMinutos?: number;
  status?: string;
  fusoHorario?: string;
};

export type FichaPagamento = {
  cache?: number;
  moeda?: Moeda;
  parcelas?: Parcela[];
  taxaAgenciaValor?: number;
};

export type FichaDocumentos = {
  vendaId?: string;
  orcamentoId?: string;
  contratoId?: string;
};

/**
 * Cada setor é OPCIONAL: ausente = "você não pode ver isto". O cliente não
 * precisa saber por quê — ausência já é a resposta, e não vaza nem a forma do
 * dado escondido.
 */
export type FichaShow = {
  showId: string;
  artistaId?: string;
  artistaNome?: string;
  artistaCor?: string;
  contratante?: FichaContratante;
  local?: FichaLocal;
  detalhes?: FichaDetalhes;
  pagamento?: FichaPagamento;
  lineup?: string[];
  camarim?: ItemQuantidade[];
  efeitos?: ItemQuantidade[];
  tecnico?: ItemQuantidade[];
  logistica?: LogisticaSelecao;
  hotel?: { itens?: ItemQuantidade[]; booking?: unknown };
  observacoes?: string;
  documentos?: FichaDocumentos;
  /** Setores que ESTE usuário alcança — o modal usa pra não pintar bloco vazio. */
  setoresVisiveis: SetorAgenda[];
};

/** Um item com qtd 0 não foi contratado: não polui a ficha. */
function comQtd(itens: ItemQuantidade[] | undefined): ItemQuantidade[] | undefined {
  const filtrados = (itens ?? []).filter((i) => i.qtd > 0);
  return filtrados.length > 0 ? filtrados : undefined;
}

/**
 * Apaga da ficha COMPLETA tudo que o usuário não alcança.
 *
 * `podeVer` vem do motor de permissões (servidor). Anotações NÃO passam por
 * aqui: elas têm gate próprio (`podeVerAnotacao`, que também olha pasta
 * compartilhada) e viajam por outro endpoint — o setor `anotacoes` só governa
 * se o modal PINTA o bloco.
 */
export function redigirFicha(
  completa: Omit<FichaShow, "setoresVisiveis">,
  podeVer: (setor: SetorAgenda) => boolean
): FichaShow {
  const setoresVisiveis: SetorAgenda[] = [];
  const ve = (s: SetorAgenda) => {
    const pode = podeVer(s);
    if (pode) setoresVisiveis.push(s);
    return pode;
  };

  // A ordem das chamadas define a ordem de `setoresVisiveis` — mantida igual à
  // de SETORES_AGENDA pra o modal pintar na ordem que o dono definiu.
  const contratante = ve("contratante") ? completa.contratante : undefined;
  const local = ve("local") ? completa.local : undefined;
  const detalhes = ve("detalhes") ? completa.detalhes : undefined;
  const pagamento = ve("pagamento") ? completa.pagamento : undefined;
  const lineup = ve("lineup") ? completa.lineup : undefined;
  const camarim = ve("camarim") ? comQtd(completa.camarim) : undefined;
  const efeitos = ve("efeitos") ? comQtd(completa.efeitos) : undefined;
  const tecnico = ve("tecnico") ? comQtd(completa.tecnico) : undefined;
  const logistica = ve("logistica") ? completa.logistica : undefined;
  const hotel = ve("hotel")
    ? {
        itens: comQtd(completa.hotel?.itens),
        booking: completa.hotel?.booking,
      }
    : undefined;
  ve("anotacoes"); // sem payload aqui — só entra em setoresVisiveis
  const observacoes = ve("observacoes") ? completa.observacoes : undefined;
  const documentos = ve("documentos") ? completa.documentos : undefined;

  return {
    showId: completa.showId,
    artistaId: completa.artistaId,
    artistaNome: completa.artistaNome,
    artistaCor: completa.artistaCor,
    ...(contratante ? { contratante } : {}),
    ...(local ? { local } : {}),
    ...(detalhes ? { detalhes } : {}),
    ...(pagamento ? { pagamento } : {}),
    ...(lineup && lineup.length > 0 ? { lineup } : {}),
    ...(camarim ? { camarim } : {}),
    ...(efeitos ? { efeitos } : {}),
    ...(tecnico ? { tecnico } : {}),
    ...(logistica ? { logistica } : {}),
    ...(hotel && (hotel.itens || hotel.booking) ? { hotel } : {}),
    ...(observacoes ? { observacoes } : {}),
    ...(documentos ? { documentos } : {}),
    setoresVisiveis,
  };
}
