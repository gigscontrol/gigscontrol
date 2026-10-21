/**
 * Pilha de navegação DENTRO do painel (por aba do navegador), pro "Voltar"
 * levar pra onde a pessoa estava — não pra um destino fixo.
 *
 * O navegador não conta pro site se a entrada anterior do histórico é do
 * próprio app (pode ser o login, outro site, ou nada num link recém-aberto).
 * Então a gente espelha as visitas aqui: com 2+ entradas, `router.back()` é
 * seguro; com 1 (chegou por link/notificação, ou após login), o Voltar cai
 * no destino-padrão da tela.
 *
 * Puro — testado em pilha.test.ts. O NavProvider persiste em sessionStorage
 * (F5 mantém o histórico do navegador, então mantém a pilha também).
 */

export const LIMITE_PILHA = 50;

/**
 * Registra a URL atual. Retorna uma pilha NOVA.
 * - mesma URL do topo → nada muda (re-render, F5);
 * - `substituir` (router.replace) → troca o topo;
 * - igual à penúltima → foi o voltar do navegador/app → desempilha;
 * - senão → empilha.
 */
export function registrarVisita(pilha: string[], url: string, substituir = false): string[] {
  const topo = pilha[pilha.length - 1];
  if (topo === url) return pilha;
  if (substituir && pilha.length > 0) return [...pilha.slice(0, -1), url];
  if (pilha.length >= 2 && pilha[pilha.length - 2] === url) return pilha.slice(0, -1);
  const nova = [...pilha, url];
  return nova.length > LIMITE_PILHA ? nova.slice(nova.length - LIMITE_PILHA) : nova;
}

/** Há uma tela anterior DO APP pra onde o navegador pode voltar? */
export function temAnterior(pilha: string[]): boolean {
  return pilha.length >= 2;
}

export function anterior(pilha: string[]): string | null {
  return pilha.length >= 2 ? pilha[pilha.length - 2] : null;
}

/**
 * Pilha salva só vale se termina na URL atual (F5). Chegada por link novo,
 * login ou outra aba → recomeça do zero, senão o Voltar mandaria pra uma tela
 * que não está atrás desta no histórico do navegador.
 */
export function restaurarPilha(salva: unknown, urlAtual: string): string[] {
  if (Array.isArray(salva) && salva.length > 0 && salva.every((s) => typeof s === "string")) {
    if (salva[salva.length - 1] === urlAtual) return salva as string[];
  }
  return [urlAtual];
}
