/**
 * MODELO DOS 5 MÓDULOS DA EQUIPE (v2) — fonte ÚNICA da escada de níveis.
 *
 * Espelha EXATAMENTE o protótipo aprovado (`public/permissoes-navegavel.html`):
 * cada módulo tem suas capacidades (uma linha/checkbox no editor) e TRÊS níveis
 * nomeados — Básico, Intermediário e Acesso total — com o conjunto EXATO de
 * chaves de cada um. A convenção de autoria é "criado por ele" × "criado por
 * outros" (nunca "próprio/seu/terceiro").
 *
 * A escada é a mesma em todo módulo:
 *   1 Básico        → faz o que é DELE.
 *   2 Intermediário → + VÊ o que é dos outros.
 *   3 Acesso total  → + ADMINISTRA tudo.
 *
 * Armazenamento continua sendo o array plano de chaves em
 * `membros_artista.permissoes` (jsonb, zero migration). Este arquivo é o que o
 * editor consome pra renderizar e o que o servidor usa pra derivar/aplicar
 * nível. Puro de propósito (zero import de servidor/React) — dá pra provar por
 * execução em `scripts/`.
 *
 * A AGENDA reusa os setores de `setoresAgenda.ts` (13 setores) e ganha o nível
 * INTERMEDIÁRIO NOVO (7 setores = básico + camarim, efeitos, rider técnico).
 */

import type { ModuloPermissao } from "./catalogo";
import {
  SETORES_AGENDA,
  CHAVES_SETORES_AGENDA,
  CHAVES_SETORES_BASICO,
  chaveDoSetor,
} from "./setoresAgenda";

export type NivelEquipe = "basico" | "inter" | "total" | "pers";

/** Só os 3 níveis nomeados (o que `aplicarNivel` sabe gravar). */
export type NivelNomeado = "basico" | "inter" | "total";

/** Agrupamento visual da capacidade no editor. */
export type GrupoCap = "ficha" | "dele" | "outros" | "modelos";

export type CapModelo = {
  /** Chave REAL guardada no vínculo. */
  chave: string;
  label: string;
  grupo: GrupoCap;
  /** Entra no piso do BÁSICO? (marcador visual do editor.) */
  piso: boolean;
};

export type NivelModelo = {
  k: NivelNomeado;
  rot: string;
  /** Conjunto EXATO de chaves deste nível. */
  chaves: readonly string[];
  desc: string;
  /** O que o nível NÃO dá (texto do editor). */
  nao: string;
};

export type ModuloModelo = {
  id: ModuloPermissao;
  nome: string;
  /** Agenda é sempre ativa (não tem liga/desliga de módulo). */
  sempre?: boolean;
  hint: string;
  grupoLabel: Partial<Record<GrupoCap, string>>;
  caps: readonly CapModelo[];
  niveis: readonly [NivelModelo, NivelModelo, NivelModelo];
  nota?: string;
};

// ------------------------------------------------------------------
// AGENDA — reusa os setores. Intermediário NOVO = básico + os 3 da produção.
// ------------------------------------------------------------------
const CAPS_AGENDA: CapModelo[] = SETORES_AGENDA.map((s) => ({
  chave: s.chave,
  label: s.label,
  grupo: "ficha" as const,
  piso: s.noBasico,
}));

/** Setores do INTERMEDIÁRIO da agenda: básico + camarim, efeitos, rider técnico. */
export const CHAVES_SETORES_INTER: readonly string[] = [
  ...CHAVES_SETORES_BASICO,
  chaveDoSetor("camarim"),
  chaveDoSetor("efeitos"),
  chaveDoSetor("tecnico"),
];

/**
 * ACESSO TOTAL da agenda = os 13 setores + criar item de agenda (voo,
 * transporte, evento) e editar/excluir qualquer item. NUNCA cria/edita SHOW —
 * isso é chave de VENDAS (mesma regra de `capacidades.ts`/`CHAVES_AGENDA_TOTAL`).
 */
export const CHAVES_AGENDA_TOTAL_MODELO: readonly string[] = [
  ...CHAVES_SETORES_AGENDA,
  "agenda.criar",
  "agenda.editar_todos",
  "agenda.excluir_todos",
];

// ------------------------------------------------------------------
export const MODELOS_EQUIPE: readonly ModuloModelo[] = [
  {
    id: "agenda",
    nome: "Agenda",
    sempre: true,
    hint: "Sempre ativa. Marque o que aparece na ficha do show — o nível se ajusta sozinho.",
    grupoLabel: { ficha: "O que aparece na ficha do show" },
    caps: CAPS_AGENDA,
    niveis: [
      {
        k: "basico",
        rot: "Básico",
        chaves: [...CHAVES_SETORES_BASICO],
        desc: "Vê local, detalhes, line-up e anotações.",
        nao: "Não vê contratante, pagamento nem hotel.",
      },
      {
        k: "inter",
        rot: "Intermediário",
        chaves: CHAVES_SETORES_INTER,
        desc: "Tudo do Básico + camarim, efeitos e rider técnico — a produção do show.",
        nao: "Não vê contratante, pagamento, hotel nem documentos.",
      },
      {
        k: "total",
        rot: "Acesso total",
        chaves: CHAVES_AGENDA_TOTAL_MODELO,
        desc: "Vê os 13 setores da ficha e cria voo, transporte e evento.",
        nao: "",
      },
    ],
    nota: "Os 13 marcados = <b>Acesso total</b>; os 4 do básico = <b>Básico</b>; o conjunto do Intermediário = <b>Intermediário</b>; qualquer outra combinação = <b>Personalizado</b>. Criar voo/transporte/evento vem junto do Acesso total.",
  },

  {
    id: "vendas",
    nome: "Vendas",
    hint: "Orçamentos e vendas — e é daqui que vem mexer no show da agenda.",
    grupoLabel: { dele: "O que é dele", outros: "Sobre o dos outros" },
    caps: [
      { chave: "vendas.criar", label: "Criar orçamento e venda", grupo: "dele", piso: true },
      { chave: "vendas.editar_proprios", label: "Editar venda criada por ele", grupo: "dele", piso: true },
      { chave: "vendas.cancelar_proprios", label: "Cancelar venda criada por ele", grupo: "dele", piso: false },
      { chave: "vendas.ver_outros", label: "Ver orçamento e venda criada por outros", grupo: "outros", piso: false },
      { chave: "vendas.editar_outros", label: "Editar venda criada por outros", grupo: "outros", piso: false },
      { chave: "vendas.converter_outros", label: "Converter orçamento criado por outros em venda", grupo: "outros", piso: false },
      { chave: "vendas.cancelar_outros", label: "Cancelar venda criada por outros", grupo: "outros", piso: false },
    ],
    niveis: [
      {
        k: "basico",
        rot: "Básico",
        chaves: ["vendas.criar", "vendas.editar_proprios"],
        desc: "Cria orçamento e venda, e edita as que ele mesmo criou.",
        nao: "Não vê nem mexe no que os colegas criaram.",
      },
      {
        k: "inter",
        rot: "Intermediário",
        chaves: ["vendas.criar", "vendas.editar_proprios", "vendas.ver_outros"],
        desc: "Tudo do Básico + vê os orçamentos e vendas criados por outros.",
        nao: "Só olha — não edita, converte nem cancela o que é deles.",
      },
      {
        k: "total",
        rot: "Acesso total",
        chaves: [
          "vendas.criar",
          "vendas.editar_proprios",
          "vendas.cancelar_proprios",
          "vendas.ver_outros",
          "vendas.editar_outros",
          "vendas.converter_outros",
          "vendas.cancelar_outros",
        ],
        desc: "Cria, edita, converte e cancela qualquer orçamento ou venda do artista.",
        nao: "Excluir venda continua só com o admin.",
      },
    ],
    nota: "“Criar orçamento e venda” já inclui converter os próprios orçamentos e ver o que ele criou. As linhas “criado por outros” somam no Intermediário e no Total.",
  },

  {
    id: "financeiro",
    nome: "Financeiro",
    hint: "Parcelas, pagamentos e cobranças.",
    grupoLabel: { dele: "O que é dele", outros: "Sobre o dos outros" },
    caps: [
      { chave: "financeiro.ver_proprios", label: "Ver o financeiro da venda criada por ele", grupo: "dele", piso: true },
      { chave: "financeiro.editar_proprios", label: "Editar o financeiro da venda criada por ele", grupo: "dele", piso: true },
      { chave: "financeiro.informar_proprios", label: "Informar o pagamento da venda criada por ele", grupo: "dele", piso: true },
      { chave: "financeiro.fixar_proprios", label: "Fixar a cobrança da venda criada por ele", grupo: "dele", piso: true },
      { chave: "financeiro.ver_outros", label: "Ver o financeiro da venda criada por outros", grupo: "outros", piso: false },
      { chave: "financeiro.editar_outros", label: "Editar o financeiro da venda criada por outros", grupo: "outros", piso: false },
      { chave: "financeiro.informar_outros", label: "Informar o pagamento da venda criada por outros", grupo: "outros", piso: false },
      { chave: "financeiro.fixar_outros", label: "Fixar a cobrança da venda criada por outros", grupo: "outros", piso: false },
    ],
    niveis: [
      {
        k: "basico",
        rot: "Básico",
        chaves: [
          "financeiro.ver_proprios",
          "financeiro.editar_proprios",
          "financeiro.informar_proprios",
          "financeiro.fixar_proprios",
        ],
        desc: "Vê e administra o financeiro das vendas que ele criou — editar, informar pagamento e fixar cobrança.",
        nao: "Não vê o financeiro dos colegas.",
      },
      {
        k: "inter",
        rot: "Intermediário",
        chaves: [
          "financeiro.ver_proprios",
          "financeiro.editar_proprios",
          "financeiro.informar_proprios",
          "financeiro.fixar_proprios",
          "financeiro.ver_outros",
        ],
        desc: "Tudo do Básico + vê o financeiro das vendas criadas por outros.",
        nao: "Só olha — não mexe no que é dos outros.",
      },
      {
        k: "total",
        rot: "Acesso total",
        chaves: [
          "financeiro.ver_proprios",
          "financeiro.editar_proprios",
          "financeiro.informar_proprios",
          "financeiro.fixar_proprios",
          "financeiro.ver_outros",
          "financeiro.editar_outros",
          "financeiro.informar_outros",
          "financeiro.fixar_outros",
        ],
        desc: "Administra o financeiro de todas as vendas — as que ele criou e as criadas por outros.",
        nao: "",
      },
    ],
    nota: "Cada ação é uma linha, espelhada em “criada por ele” e “criada por outros” — o Acesso total marca as 8. A taxa de agência fica fora.",
  },

  {
    id: "contratos",
    nome: "Contratos",
    hint: "Gerar, acompanhar e assinar contratos das vendas.",
    grupoLabel: { dele: "O que é dele", outros: "Sobre o dos outros", modelos: "Modelos de contrato" },
    caps: [
      { chave: "contratos.criar", label: "Criar contrato", grupo: "dele", piso: true },
      { chave: "contratos.cancelar_proprios", label: "Cancelar contrato criado por ele", grupo: "dele", piso: true },
      { chave: "contratos.ver_outros", label: "Ver contrato criado por outros", grupo: "outros", piso: false },
      { chave: "contratos.cancelar_outros", label: "Cancelar contrato criado por outros", grupo: "outros", piso: false },
      { chave: "contratos.criar_modelo", label: "Criar modelo de contrato", grupo: "modelos", piso: false },
      { chave: "contratos.excluir_modelo", label: "Excluir modelo de contrato", grupo: "modelos", piso: false },
    ],
    niveis: [
      {
        k: "basico",
        rot: "Básico",
        chaves: ["contratos.criar", "contratos.cancelar_proprios"],
        desc: "Cria contratos (já inclui usar modelos e ver os que criou) e cancela os que ele criou.",
        nao: "Não vê contratos criados por outros.",
      },
      {
        k: "inter",
        rot: "Intermediário",
        chaves: ["contratos.criar", "contratos.cancelar_proprios", "contratos.ver_outros"],
        desc: "Tudo do Básico + vê os contratos criados por outros.",
        nao: "Só olha — não cancela o que é dos outros.",
      },
      {
        k: "total",
        rot: "Acesso total",
        chaves: [
          "contratos.criar",
          "contratos.cancelar_proprios",
          "contratos.ver_outros",
          "contratos.cancelar_outros",
          "contratos.criar_modelo",
          "contratos.excluir_modelo",
        ],
        desc: "+ cancela contratos criados por outros e gerencia os modelos (criar e excluir).",
        nao: "Excluir um contrato já gerado continua só com o admin.",
      },
    ],
    nota: "“Criar contrato” já inclui ver os que ele criou e gerar a partir de modelo. “Modelo de contrato” é o molde reutilizável — ≠ excluir um contrato já gerado (só admin).",
  },

  {
    id: "contatos",
    nome: "Contatos",
    hint: "Contratantes, casas de show e o mapa.",
    grupoLabel: { dele: "O que é dele", outros: "Sobre o dos outros" },
    caps: [
      { chave: "contatos.criar", label: "Criar contato", grupo: "dele", piso: true },
      { chave: "contatos.ver_proprios", label: "Ver contato criado por ele", grupo: "dele", piso: true },
      { chave: "contatos.editar_proprios", label: "Editar contato criado por ele", grupo: "dele", piso: true },
      { chave: "contatos.excluir_proprios", label: "Excluir contato criado por ele", grupo: "dele", piso: true },
      { chave: "contatos.ver_outros", label: "Ver contato criado por outros", grupo: "outros", piso: false },
      { chave: "contatos.editar_outros", label: "Editar contato criado por outros", grupo: "outros", piso: false },
      { chave: "contatos.excluir_outros", label: "Excluir contato criado por outros", grupo: "outros", piso: false },
    ],
    niveis: [
      {
        k: "basico",
        rot: "Básico",
        chaves: [
          "contatos.criar",
          "contatos.ver_proprios",
          "contatos.editar_proprios",
          "contatos.excluir_proprios",
        ],
        desc: "Cria contatos e gerencia os que ele criou — ver, editar e excluir.",
        nao: "Não vê os contatos criados por outros.",
      },
      {
        k: "inter",
        rot: "Intermediário",
        chaves: [
          "contatos.criar",
          "contatos.ver_proprios",
          "contatos.editar_proprios",
          "contatos.excluir_proprios",
          "contatos.ver_outros",
        ],
        desc: "Tudo do Básico + vê os contatos criados por outros.",
        nao: "Só olha — não edita nem exclui o que é dos outros.",
      },
      {
        k: "total",
        rot: "Acesso total",
        chaves: [
          "contatos.criar",
          "contatos.ver_proprios",
          "contatos.editar_proprios",
          "contatos.excluir_proprios",
          "contatos.ver_outros",
          "contatos.editar_outros",
          "contatos.excluir_outros",
        ],
        desc: "Gerencia todos os contatos — os que ele criou e os criados por outros.",
        nao: "",
      },
    ],
    nota: "“Editar” já cobre atualizar os dados. Cada ação espelhada em “criado por ele” e “criado por outros”.",
  },
] as const;

export const MODELO_POR_ID: Record<string, ModuloModelo> = Object.fromEntries(
  MODELOS_EQUIPE.map((m) => [m.id, m])
);

// ============================================================
// DERIVAÇÃO E APLICAÇÃO DE NÍVEL
// ============================================================

/**
 * "Universo" de chaves que ESTE módulo governa — a união das chaves das
 * capacidades com as dos três níveis. Precisa incluir as dos níveis porque o
 * ACESSO TOTAL da agenda tem chaves de AÇÃO (`agenda.criar`/`editar_todos`/
 * `excluir_todos`) que não são capacidades-linha do editor. Sem elas o conjunto
 * "total" nunca casaria na derivação.
 */
function universoDoModulo(mod: ModuloModelo): Set<string> {
  const u = new Set<string>();
  for (const c of mod.caps) u.add(c.chave);
  for (const n of mod.niveis) for (const k of n.chaves) u.add(k);
  return u;
}

function mesmoConjunto(a: string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((k) => set.has(k));
}

/** Só as chaves DESTE módulo presentes no conjunto de permissões. */
export function chavesDoModulo(perms: Set<string>, mod: ModuloModelo): string[] {
  const universo = universoDoModulo(mod);
  return [...perms].filter((k) => universo.has(k));
}

/**
 * Em qual nível o conjunto de permissões cai NESTE módulo?
 *   - casa EXATO com básico/inter/total → o nível nomeado;
 *   - qualquer outra combinação (inclusive vazia) → "pers" (Personalizado).
 */
export function derivarNivel(mod: ModuloModelo, perms: Set<string>): NivelEquipe {
  const atuais = chavesDoModulo(perms, mod);
  for (const n of mod.niveis) {
    if (mesmoConjunto(atuais, n.chaves)) return n.k;
  }
  return "pers";
}

/**
 * Aplica um nível NOMEADO ao conjunto: remove TODAS as chaves do módulo e
 * grava exatamente as do nível escolhido. "pers" (Personalizado) NÃO existe
 * como alvo — o editor só abre a lista granular; trocar pra pers e voltar não
 * perde nada.
 */
export function aplicarNivel(
  mod: ModuloModelo,
  perms: Set<string>,
  nivel: NivelNomeado
): Set<string> {
  const universo = universoDoModulo(mod);
  const next = new Set([...perms].filter((k) => !universo.has(k)));
  const n = mod.niveis.find((x) => x.k === nivel);
  if (n) for (const k of n.chaves) next.add(k);
  return next;
}

/** Conjunto EXATO de chaves de um nível nomeado (usado por perfis/presets). */
export function chavesDoNivel(moduloId: string, nivel: NivelNomeado): string[] {
  const mod = MODELO_POR_ID[moduloId];
  if (!mod) return [];
  const n = mod.niveis.find((x) => x.k === nivel);
  return n ? [...n.chaves] : [];
}

/** TODAS as chaves novas (v2) dos 5 módulos — validação/documentação. */
export function todasAsChavesDoModelo(): string[] {
  const set = new Set<string>();
  for (const mod of MODELOS_EQUIPE) for (const k of universoDoModulo(mod)) set.add(k);
  return [...set];
}
