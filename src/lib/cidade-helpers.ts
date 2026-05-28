/**
 * Helpers compartilhados pelos forms que escolhem cidade IBGE
 * (orçamento, venda, casa, contratante).
 *
 * Esses formulários trabalham com `CidadeIBGE` (do autocomplete, com
 * ibgeId/nome/uf), mas o BANCO trabalha com `Cidade.id` (UUID da
 * tabela `cidades`). Esse módulo é o tradutor: dado uma cidade IBGE,
 * resolve (ou cria) a cidade no workspace e devolve o UUID.
 */

import type { Cidade } from "@/types";
import type { CidadeIBGE } from "@/components/CidadeIBGEAutocomplete";

/**
 * Faz lookup-or-create no backend e devolve a cidade do workspace.
 * Use no submit dos forms ANTES de criar o orçamento/venda/casa.
 *
 * Lança erro se a API falhar — o caller deve tratar (mostrar toast).
 */
export async function resolverCidadeIbge(
  ibge: CidadeIBGE
): Promise<Cidade> {
  const res = await fetch("/api/contatos/cidades/lookup-ibge", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ibgeId: ibge.ibgeId,
      nome: ibge.nome,
      uf: ibge.uf,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body.erro as string) ?? `HTTP ${res.status}`);
  }
  return body.cidade as Cidade;
}

/**
 * Converte uma `Cidade` (vinda do contexto/banco) na shape de
 * `CidadeIBGE` esperada pelo autocomplete — usado pra pré-popular
 * o campo em forms de edição.
 *
 * Retorna null se a cidade não tem ibgeId (legada/manual antiga).
 */
export function cidadeParaIbge(cidade: Cidade | null | undefined): CidadeIBGE | null {
  if (!cidade) return null;
  if (!cidade.ibgeId) return null;
  return {
    ibgeId: cidade.ibgeId,
    nome: cidade.nome,
    uf: cidade.estado,
  };
}
