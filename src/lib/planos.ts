/**
 * Planos de assinatura do GIGS CONTROL.
 *
 * Cada plano tem dois preços: `precoMensal` (cobrado mês a mês) e
 * `precoAnual` (TOTAL do ano, cobrado uma vez — mais barato que 12×).
 *
 * O papel "Admin" (dono da conta) é sempre 1 e NÃO conta nos limites de
 * artistas nem de usuários da equipe.
 *
 * Preços em R$ (Brasil) e US$ (fora do Brasil). A moeda é escolhida por IP
 * (cookie `gc-moeda`, definido no middleware): BR → BRL, exterior → USD.
 */

export type PlanoId =
  | "individual"
  | "equipe"
  | "time"
  | "agencia"
  | "agencia-plus"
  | "agencia-max";

export type CicloCobranca = "mensal" | "anual";

/** Moeda de cobrança — definida por região (IP). */
export type Moeda = "brl" | "usd";

export type Plano = {
  id: PlanoId;
  nome: string;
  tagline: string;
  /** Limite de artistas (DJs/cantores/MCs) cadastráveis */
  maxArtistas: number;
  /**
   * Limite de usuários adicionais da equipe — produtores, vendedores,
   * financeiro... NÃO inclui o admin (sempre 1) nem os artistas.
   */
  maxUsuariosAdicionais: number;
  /** Limite de modelos de contrato salvos */
  maxModelos: number;
  /** Limite de contratos gerados por mês (janela de calendário) */
  maxContratosMes: number;
  /** Preço por mês no plano mensal (R$) */
  precoMensal: number;
  /** Preço TOTAL do ano no plano anual (R$) — cobrado 1× ao ano */
  precoAnual: number;
  /** Preço por mês em US$ (cobrado fora do Brasil) */
  precoMensalUsd: number;
  /** Preço TOTAL do ano em US$ */
  precoAnualUsd: number;
  destaque?: boolean;
  /** Recursos listados na página de planos */
  recursos: string[];
};

/** Total de usuários de um plano = 1 admin + artistas + adicionais */
export function totalUsuarios(plano: Plano): number {
  return 1 + plano.maxArtistas + plano.maxUsuariosAdicionais;
}

export const PLANOS: Plano[] = [
  {
    id: "individual",
    nome: "Individual",
    tagline: "Para o artista que gere a própria carreira",
    maxArtistas: 1,
    maxUsuariosAdicionais: 3,
    maxModelos: 2,
    maxContratosMes: 8,
    precoMensal: 149,
    precoAnual: 1490,
    precoMensalUsd: 59,
    precoAnualUsd: 590,
    recursos: [
      "1 artista",
      "3 usuários da equipe",
      "2 modelos de contrato",
      "8 contratos por mês",
      "Agenda, vendas e financeiro",
      "Orçamento por WhatsApp",
    ],
  },
  {
    id: "equipe",
    nome: "Equipe",
    tagline: "Para quem trabalha com um time enxuto",
    maxArtistas: 3,
    maxUsuariosAdicionais: 9,
    maxModelos: 6,
    maxContratosMes: 24,
    precoMensal: 367,
    precoAnual: 3670,
    precoMensalUsd: 137,
    precoAnualUsd: 1370,
    destaque: true,
    recursos: [
      "3 artistas",
      "9 usuários da equipe",
      "6 modelos de contrato",
      "24 contratos por mês",
      "Tudo do plano Individual",
      "Papéis e permissões por usuário",
    ],
  },
  {
    id: "time",
    nome: "Time",
    tagline: "Para o time que está crescendo",
    maxArtistas: 5,
    maxUsuariosAdicionais: 15,
    maxModelos: 10,
    maxContratosMes: 40,
    precoMensal: 585,
    precoAnual: 5850,
    precoMensalUsd: 215,
    precoAnualUsd: 2150,
    recursos: [
      "5 artistas",
      "15 usuários da equipe",
      "10 modelos de contrato",
      "40 contratos por mês",
      "Tudo do plano Equipe",
      "Métricas por artista",
    ],
  },
  {
    id: "agencia",
    nome: "Agência",
    tagline: "Para agências em crescimento",
    maxArtistas: 10,
    maxUsuariosAdicionais: 30,
    maxModelos: 20,
    maxContratosMes: 80,
    precoMensal: 1130,
    precoAnual: 11300,
    precoMensalUsd: 410,
    precoAnualUsd: 4100,
    recursos: [
      "10 artistas",
      "30 usuários da equipe",
      "20 modelos de contrato",
      "80 contratos por mês",
      "Tudo do plano Time",
      "Relatórios consolidados da agência",
      "Suporte prioritário",
    ],
  },
  {
    id: "agencia-plus",
    nome: "Agência Plus",
    tagline: "Operações de grande porte",
    maxArtistas: 20,
    maxUsuariosAdicionais: 60,
    maxModelos: 40,
    maxContratosMes: 160,
    precoMensal: 2765,
    precoAnual: 27650,
    precoMensalUsd: 995,
    precoAnualUsd: 9950,
    recursos: [
      "20 artistas",
      "60 usuários da equipe",
      "40 modelos de contrato",
      "160 contratos por mês",
      "Tudo do plano Agência",
      "Exportação de dados",
      "Gerente de conta dedicado",
    ],
  },
  {
    id: "agencia-max",
    nome: "Agência Max",
    tagline: "O maior porte de operação",
    maxArtistas: 40,
    maxUsuariosAdicionais: 120,
    maxModelos: 80,
    maxContratosMes: 320,
    precoMensal: 5490,
    precoAnual: 54900,
    precoMensalUsd: 1970,
    precoAnualUsd: 19700,
    recursos: [
      "40 artistas",
      "120 usuários da equipe",
      "80 modelos de contrato",
      "320 contratos por mês",
      "Tudo do plano Agência Plus",
      "Onboarding assistido",
      "Suporte dedicado com SLA",
    ],
  },
];

export function getPlano(id: PlanoId): Plano {
  return PLANOS.find((p) => p.id === id) ?? PLANOS[0];
}

/** Preço mensal cru na moeda escolhida */
export function valorMensal(plano: Plano, moeda: Moeda = "brl"): number {
  return moeda === "usd" ? plano.precoMensalUsd : plano.precoMensal;
}

/** Preço anual (total do ano) cru na moeda escolhida */
export function valorAnual(plano: Plano, moeda: Moeda = "brl"): number {
  return moeda === "usd" ? plano.precoAnualUsd : plano.precoAnual;
}

/** Preço efetivo POR MÊS conforme o ciclo (no anual = total/12). */
export function precoPorMes(
  plano: Plano,
  ciclo: CicloCobranca,
  moeda: Moeda = "brl"
): number {
  return ciclo === "anual" ? valorAnual(plano, moeda) / 12 : valorMensal(plano, moeda);
}

/** Quanto se economiza por ano ao escolher o plano anual */
export function economiaAnual(plano: Plano, moeda: Moeda = "brl"): number {
  return valorMensal(plano, moeda) * 12 - valorAnual(plano, moeda);
}

/** Percentual de desconto do anual frente ao mensal (igual nas duas moedas) */
export function descontoAnualPct(plano: Plano): number {
  const cheio = plano.precoMensal * 12;
  if (cheio <= 0) return 0;
  return Math.round(((cheio - plano.precoAnual) / cheio) * 100);
}

/** Total cobrado no plano anual (12 meses de uma vez) */
export function totalAnual(plano: Plano, moeda: Moeda = "brl"): number {
  return valorAnual(plano, moeda);
}

export const formatarPreco = (v: number, moeda: Moeda = "brl") =>
  v.toLocaleString(moeda === "usd" ? "en-US" : "pt-BR", {
    style: "currency",
    currency: moeda === "usd" ? "USD" : "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Formata sem centavos quando for valor "redondo" — usado em totais grandes */
export const formatarPrecoCurto = (v: number, moeda: Moeda = "brl") =>
  v.toLocaleString(moeda === "usd" ? "en-US" : "pt-BR", {
    style: "currency",
    currency: moeda === "usd" ? "USD" : "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
