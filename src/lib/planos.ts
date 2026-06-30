/**
 * Planos de assinatura do GIGS CONTROL.
 *
 * Cada plano tem dois preços: `precoMensal` (cobrado mês a mês) e
 * `precoAnual` (TOTAL do ano, cobrado uma vez — mais barato que 12×).
 *
 * O papel "Admin" (dono da conta) é sempre 1 e NÃO conta nos limites de
 * artistas nem de usuários da equipe.
 *
 * Preços em R$ (Brasil). A cobrança em outras moedas por IP entra numa
 * etapa futura — por ora tudo é BRL.
 */

export type PlanoId =
  | "individual"
  | "equipe"
  | "time"
  | "agencia"
  | "agencia-plus"
  | "agencia-max";

export type CicloCobranca = "mensal" | "anual";

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

/** Preço efetivo POR MÊS conforme o ciclo (no anual = total/12). */
export function precoPorMes(plano: Plano, ciclo: CicloCobranca): number {
  return ciclo === "anual" ? plano.precoAnual / 12 : plano.precoMensal;
}

/** Quanto se economiza por ano ao escolher o plano anual */
export function economiaAnual(plano: Plano): number {
  return plano.precoMensal * 12 - plano.precoAnual;
}

/** Percentual de desconto do plano anual frente ao mensal */
export function descontoAnualPct(plano: Plano): number {
  const cheio = plano.precoMensal * 12;
  if (cheio <= 0) return 0;
  return Math.round(((cheio - plano.precoAnual) / cheio) * 100);
}

/** Total cobrado no plano anual (12 meses de uma vez) */
export function totalAnual(plano: Plano): number {
  return plano.precoAnual;
}

export const formatarPreco = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Formata sem centavos quando for valor "redondo" — usado em totais grandes */
export const formatarPrecoCurto = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
