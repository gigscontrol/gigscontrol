/**
 * Planos de assinatura do GIGS CONTROL.
 *
 * Cada plano tem dois preços: mensal (cobrado mês a mês) e anual
 * (valor por mês, cobrado uma vez ao ano — mais barato).
 *
 * O papel "Admin" (dono da conta) não conta no limite de usuários da equipe.
 */

export type PlanoId =
  | "individual"
  | "equipe"
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
  /** Preço por mês no plano mensal (R$) */
  precoMensal: number;
  /** Preço por mês quando assinado no plano anual (R$) */
  precoAnualPorMes: number;
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
    maxUsuariosAdicionais: 1,
    precoMensal: 149.9,
    precoAnualPorMes: 119.9,
    recursos: [
      "1 artista",
      "1 usuário adicional (produtor, assistente...)",
      "Agenda e escala de shows",
      "Orçamentos e vendas",
      "Controle financeiro de pagamentos",
      "Envio de orçamento por WhatsApp",
    ],
  },
  {
    id: "equipe",
    nome: "Equipe",
    tagline: "Para quem trabalha com um time enxuto",
    maxArtistas: 3,
    maxUsuariosAdicionais: 6,
    precoMensal: 349.9,
    precoAnualPorMes: 299.9,
    destaque: true,
    recursos: [
      "Até 3 artistas",
      "Até 6 usuários adicionais",
      "Tudo do plano Individual",
      "Papéis: vendedor, produtor e financeiro",
      "Controle de permissões por usuário",
      "Métricas por artista",
    ],
  },
  {
    id: "agencia",
    nome: "Agência",
    tagline: "Para agências em crescimento",
    maxArtistas: 10,
    maxUsuariosAdicionais: 14,
    precoMensal: 549.9,
    precoAnualPorMes: 499.9,
    recursos: [
      "Até 10 artistas",
      "Até 14 usuários adicionais",
      "Tudo do plano Equipe",
      "Permissões avançadas por escopo",
      "Relatórios consolidados da agência",
      "Suporte prioritário",
    ],
  },
  {
    id: "agencia-plus",
    nome: "Agência Plus",
    tagline: "Operações de grande porte",
    maxArtistas: 25,
    maxUsuariosAdicionais: 34,
    precoMensal: 1199.9,
    precoAnualPorMes: 999.9,
    recursos: [
      "Até 25 artistas",
      "Até 34 usuários adicionais",
      "Tudo do plano Agência",
      "Multi-equipes de vendas",
      "Exportação de dados",
      "Gerente de conta dedicado",
    ],
  },
  {
    id: "agencia-max",
    nome: "Agência Max",
    tagline: "O maior porte de operação",
    maxArtistas: 50,
    maxUsuariosAdicionais: 74,
    precoMensal: 2399.9,
    precoAnualPorMes: 1799.9,
    recursos: [
      "Até 50 artistas",
      "Até 74 usuários adicionais",
      "Tudo do plano Agência Plus",
      "Capacidade máxima de operação",
      "Onboarding assistido",
      "Suporte dedicado com SLA",
    ],
  },
];

export function getPlano(id: PlanoId): Plano {
  return PLANOS.find((p) => p.id === id) ?? PLANOS[0];
}

/** Preço efetivo por mês conforme o ciclo escolhido */
export function precoPorMes(plano: Plano, ciclo: CicloCobranca): number {
  return ciclo === "anual" ? plano.precoAnualPorMes : plano.precoMensal;
}

/** Quanto se economiza por ano ao escolher o plano anual */
export function economiaAnual(plano: Plano): number {
  return (plano.precoMensal - plano.precoAnualPorMes) * 12;
}

/** Percentual de desconto do plano anual frente ao mensal */
export function descontoAnualPct(plano: Plano): number {
  if (plano.precoMensal <= 0) return 0;
  return Math.round(
    ((plano.precoMensal - plano.precoAnualPorMes) / plano.precoMensal) * 100
  );
}

/** Total cobrado no plano anual (12 meses de uma vez) */
export function totalAnual(plano: Plano): number {
  return plano.precoAnualPorMes * 12;
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
