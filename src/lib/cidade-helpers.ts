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
import type { CidadeEscolhida } from "@/components/CidadeGlobalAutocomplete";

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

/**
 * Versão GLOBAL do resolver: lookup-or-create unificado (Brasil via IBGE
 * OU mundo via GeoNames). Devolve a cidade do workspace (com UUID).
 * Use no submit dos forms que usam o `CidadeGlobalAutocomplete`.
 */
export async function resolverCidade(c: CidadeEscolhida): Promise<Cidade> {
  const res = await fetch("/api/contatos/cidades/lookup", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ibgeId: c.ibgeId,
      geonameId: c.geonameId,
      nome: c.nome,
      uf: c.uf,
      pais: c.pais,
      latitude: c.latitude,
      longitude: c.longitude,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body.erro as string) ?? `HTTP ${res.status}`);
  }
  return body.cidade as Cidade;
}

/**
 * Converte uma `Cidade` do banco na shape do `CidadeGlobalAutocomplete`
 * pra pré-popular forms de edição. null se for cidade legada (sem
 * ibgeId nem geonameId).
 */
export function cidadeParaEscolhida(
  cidade: Cidade | null | undefined
): CidadeEscolhida | null {
  if (!cidade) return null;
  if (!cidade.ibgeId && !cidade.geonameId) return null;
  const out: CidadeEscolhida = {
    nome: cidade.nome,
    uf: cidade.estado,
    pais: cidade.pais ?? "BR",
  };
  if (cidade.ibgeId) out.ibgeId = cidade.ibgeId;
  if (cidade.geonameId) out.geonameId = cidade.geonameId;
  if (cidade.latitude !== undefined) out.latitude = cidade.latitude;
  if (cidade.longitude !== undefined) out.longitude = cidade.longitude;
  return out;
}
