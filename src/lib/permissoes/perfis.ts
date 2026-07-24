/**
 * PERFIS (presets de permissão) — reescritos nas CHAVES v2.
 *
 * Perfil = BASE. Ao aplicar um perfil a um vínculo (usuário × artista), as
 * permissões dele são semeadas (marcadas). Depois o admin pode personalizar
 * qualquer checkbox — a personalização (o conjunto final salvo no vínculo) é
 * que vale. Um vínculo pode ter VÁRIOS perfis (herda a união).
 *
 * As permissões saem do MODELO da equipe (`modelosEquipe.ts`) via
 * `chavesDoNivel(modulo, nivel)`, para que preset e editor NUNCA discordem
 * sobre o que um nível concede. Presets espelham os 4 do protótipo aprovado
 * (Vendedor/Operação/Financeiro/Manager); Jurídico e Artista são composições
 * de leitura.
 *
 * ⚠️ PRESET É SEMENTE, NÃO BACKFILL: vale para vínculos NOVOS (ou reaplicar o
 * perfil). Vínculos JÁ SALVOS não ganham chave sozinhos — a expansão de legado
 * (`legadoEquipe.ts`) é que garante que ninguém PERDE acesso no deploy.
 *
 * `anotacoes.ver` entra em TODOS os presets (a leitura de anotações fecha
 * contra essa chave, decisão L1); `anotacoes.criar` só em quem opera a base
 * (manager, vendedor, equipe).
 *
 * Fase 1: perfis são presets FIXOS (código). Criar/editar perfis próprios
 * (tabela no banco) fica pra uma fase posterior — ver agencia.criar_perfil.
 */

import { CHAVES_SETORES_AGENDA } from "./setoresAgenda";
import { chavesDoNivel } from "./modelosEquipe";

export type PerfilId =
  | "manager"
  | "financeiro"
  | "juridico"
  | "vendedor"
  | "equipe"
  | "artista";

export type Perfil = {
  id: PerfilId;
  nome: string;
  descricao: string;
  /** Cor de identidade do perfil (categórica — como cor de papel). */
  cor: string;
  /** Chaves de permissão que este perfil concede por padrão. */
  permissoes: string[];
};

export const PERFIS: Perfil[] = [
  {
    id: "manager",
    nome: "Manager",
    descricao: "Administra tudo do artista — agenda, vendas, financeiro, contratos e contatos.",
    cor: "#6366f1",
    permissoes: [
      ...chavesDoNivel("agenda", "total"),
      ...chavesDoNivel("vendas", "total"),
      ...chavesDoNivel("financeiro", "total"),
      ...chavesDoNivel("contratos", "total"),
      ...chavesDoNivel("contatos", "total"),
      "anotacoes.ver",
      "anotacoes.criar",
    ],
  },
  {
    id: "financeiro",
    nome: "Financeiro",
    descricao: "Cuida do dinheiro, não vende — vê as vendas e administra o financeiro.",
    cor: "#3b82f6",
    permissoes: [
      ...chavesDoNivel("agenda", "basico"),
      ...chavesDoNivel("vendas", "inter"),
      ...chavesDoNivel("financeiro", "total"),
      ...chavesDoNivel("contatos", "basico"),
      "anotacoes.ver",
    ],
  },
  {
    id: "juridico",
    nome: "Jurídico",
    descricao: "Cria e gerencia os contratos do artista.",
    cor: "#14b8a6",
    permissoes: [
      ...chavesDoNivel("agenda", "basico"),
      // Vê as vendas dos outros (base para gerar contrato), sem criar venda.
      "vendas.ver_outros",
      ...chavesDoNivel("contratos", "total"),
      "anotacoes.ver",
    ],
  },
  {
    id: "vendedor",
    nome: "Vendedor",
    descricao: "Vende e contrata o que é dele.",
    cor: "#22c55e",
    permissoes: [
      ...chavesDoNivel("agenda", "basico"),
      ...chavesDoNivel("vendas", "basico"),
      ...chavesDoNivel("contratos", "basico"),
      ...chavesDoNivel("contatos", "inter"),
      "anotacoes.ver",
      "anotacoes.criar",
    ],
  },
  {
    id: "equipe",
    nome: "Operação",
    descricao: "Logística e agenda completa — cuida do dia a dia.",
    cor: "#f59e0b",
    permissoes: [
      ...chavesDoNivel("agenda", "total"),
      ...chavesDoNivel("vendas", "inter"),
      ...chavesDoNivel("contatos", "basico"),
      "anotacoes.ver",
      "anotacoes.criar",
    ],
  },
  {
    id: "artista",
    nome: "Artista",
    descricao: "O próprio artista — vê os dados dele.",
    cor: "#a855f7",
    permissoes: [
      // Leitura: todos os setores da ficha + ver o financeiro e contratos.
      // (O papel `artista` é resolvido pela privacidade no motor — estas chaves
      // são só a base/exibição do preset.)
      ...CHAVES_SETORES_AGENDA,
      "vendas.ver_outros",
      "financeiro.ver_proprios",
      "financeiro.ver_outros",
      "contratos.ver_outros",
      "anotacoes.ver",
    ],
  },
];

export const PERFIL_POR_ID: Record<PerfilId, Perfil> = Object.fromEntries(
  PERFIS.map((p) => [p.id, p])
) as Record<PerfilId, Perfil>;

/**
 * União das permissões de um conjunto de perfis (a semente inicial de um
 * vínculo antes de personalizar).
 */
export function permissoesDosPerfis(perfis: PerfilId[]): string[] {
  const set = new Set<string>();
  for (const id of perfis) {
    const p = PERFIL_POR_ID[id];
    if (p) for (const c of p.permissoes) set.add(c);
  }
  return [...set];
}
