/**
 * LEGADO DA EQUIPE (v2) — expande as chaves ANTIGAS dos 4 módulos
 * (vendas/financeiro/contratos/contatos) para o conjunto NOVO mais próximo, na
 * LEITURA, exatamente como `expandirLegadoAgenda` faz para a agenda.
 *
 * Por quê na leitura e não migrando o banco: hoje NENHUM vínculo grava chave
 * antiga desses 4 módulos (medido — só existe 1 vínculo, e ele usa chaves de
 * agenda já novas). O blast radius é ZERO. Mas a expansão é a rede de segurança
 * pra qualquer vínculo/preset antigo que apareça: ninguém perde acesso no
 * deploy. NÃO gravamos mais chave antiga — os presets (perfis.ts) foram
 * reescritos em chaves novas; o banco fica intacto, a tradução é na leitura.
 *
 * Mapa CONSERVADOR (definido no contrato): quando não há equivalente exato, o
 * lado que preserva ACESSO ganha. Chaves cuja string sobrevive na v2
 * (`contratos.criar`, `contatos.criar`, `contatos.ver_proprios`) NÃO entram no
 * mapa — passam intactas. Idempotente: rodar de novo sobre chaves já novas não
 * muda nada (chaves novas não são gatilho).
 */

import { expandirLegadoAgenda } from "./setoresAgenda";

/**
 * chave ANTIGA → chaves NOVAS. Lista vazia = a chave morre sem equivalente
 * (não perde acesso porque a operação que ela habilitava virou admin-only, ou
 * porque a capacidade está embutida em outra chave que o vínculo já ganha).
 */
const MAPA_LEGADO_EQUIPE: Record<string, readonly string[]> = {
  // ---------------- VENDAS ----------------
  // Ver tudo → ver o dos outros. (Ver o próprio está embutido em `vendas.criar`.)
  "vendas.ver": ["vendas.ver_outros"],
  "vendas.ver_orcamentos": ["vendas.ver_outros"],
  // Ver só os próprios: sem `criar` o usuário nunca criou nada → nada a ver.
  // Some sem perda (implícito no criar, que ele não tem).
  "vendas.ver_proprios": [],
  // Criar (orçamento/venda) e converter os PRÓPRIOS → a chave única `vendas.criar`.
  "vendas.criar_orcamento": ["vendas.criar"],
  "vendas.criar_venda": ["vendas.criar"],
  "vendas.converter": ["vendas.criar"],
  // Editar os próprios (venda/orçamento) → editar_proprios.
  "vendas.editar_orcamento": ["vendas.editar_proprios"],
  "vendas.editar_venda": ["vendas.editar_proprios"],
  // Escopo total de edição → editar_outros.
  "vendas.editar_todos": ["vendas.editar_outros"],
  // Cancelar a própria venda → cancelar_proprios.
  "vendas.cancelar_venda": ["vendas.cancelar_proprios"],
  // Excluir venda/orçamento virou ADMIN-ONLY (contrato) → não delega a ninguém.
  "vendas.excluir_venda": [],
  "vendas.excluir_orcamento": [],

  // ---------------- FINANCEIRO ----------------
  // Ver o financeiro (chave única antiga) → ver dos dois lados.
  "financeiro.ver": ["financeiro.ver_proprios", "financeiro.ver_outros"],
  // Informar/editar/cancelar pagamento eram globais (sem eixo de autoria). Mapa
  // CONSERVADOR: concede a ação nos dois lados (próprios + outros). "Cancelar"
  // pagamento é "editar o financeiro" na v2 (editar inclui baixar/cancelar parcela).
  "financeiro.registrar_pagamento": ["financeiro.informar_proprios", "financeiro.informar_outros"],
  "financeiro.editar_pagamento": ["financeiro.editar_proprios", "financeiro.editar_outros"],
  "financeiro.cancelar_pagamento": ["financeiro.editar_proprios", "financeiro.editar_outros"],

  // ---------------- CONTRATOS ----------------
  // (`contratos.criar` sobrevive como chave nova — fora do mapa, passa intacta.)
  "contratos.ver": ["contratos.ver_outros"],
  "contratos.editar": ["contratos.criar"],
  "contratos.cancelar": ["contratos.cancelar_proprios"],
  "contratos.editar_todos": ["contratos.cancelar_outros"],

  // ---------------- CONTATOS ----------------
  // (`contatos.criar` e `contatos.ver_proprios` sobrevivem — fora do mapa.)
  "contatos.ver": ["contatos.ver_outros"],
  "contatos.editar": ["contatos.editar_proprios"],
  "contatos.excluir": ["contatos.excluir_proprios"],
};

/**
 * Troca as chaves LEGADAS dos 4 módulos pelas novas equivalentes. Chaves fora
 * do mapa (novas, ou de outros módulos como agenda/anotações) passam intactas.
 * Idempotente.
 */
export function expandirLegadoEquipe(chaves: readonly string[]): string[] {
  const saida = new Set<string>();
  for (const c of chaves) {
    const nova = MAPA_LEGADO_EQUIPE[c];
    if (nova) {
      for (const k of nova) saida.add(k);
    } else {
      saida.add(c);
    }
  }
  return [...saida];
}

/**
 * Expansão COMPLETA de um vínculo na leitura: agenda (setores) + os 4 módulos
 * da equipe. É esta função que `mapaDeVinculos` (servidor) e o auth-context
 * (cliente) devem chamar — se um lado expandir e o outro não, a UI e o servidor
 * discordam sobre o que a pessoa vê. Idempotente.
 */
export function expandirLegadoVinculo(chaves: readonly string[]): string[] {
  return expandirLegadoEquipe(expandirLegadoAgenda(chaves));
}

/** Aplica `expandirLegadoVinculo` em todos os vínculos de uma vez. */
export function expandirLegadoVinculos(
  vinculos: Record<string, string[]>
): Record<string, string[]> {
  const saida: Record<string, string[]> = {};
  for (const [artistaId, chaves] of Object.entries(vinculos)) {
    saida[artistaId] = expandirLegadoVinculo(chaves);
  }
  return saida;
}
