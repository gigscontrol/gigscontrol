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
import type { CidadeEscolhida } from "@/components/CidadeGlobalAutocomplete";

/**
 * Resolver de cidade: lookup-or-create unificado (Brasil via IBGE lookup-or-create unificado (Brasil via IBGE
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
      // GeoNames pode não ter estado/província — nunca mande undefined
      // (o JSON dropa a chave e o zod do lookup rejeitava a cidade inteira).
      uf: c.uf ?? "",
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
 * pra pré-popular forms de edição. null só quando não há cidade (ou nome).
 *
 * ANTES devolvia null pra cidade LEGADA (sem ibgeId nem geonameId), forçando
 * o usuário a re-escolher pra "promover" o cadastro. Na prática isso apagava a
 * cidade toda vez que se abria a venda/artista pra EDITAR — o campo nascia
 * vazio mesmo com a cidade salva, e era preciso preencher de novo (e o
 * `validate` ainda barrava o salvar com "Cidade obrigatória").
 *
 * Exibir é seguro: o autocomplete mostra `value.nome` (não exige id externo) e
 * `lookupOuCriarCidade` ADOTA a cidade legada por nome+UF ao salvar — devolve a
 * MESMA cidade (não duplica) e ainda grava o id externo quando ele existir.
 */
export function cidadeParaEscolhida(
  cidade: Cidade | null | undefined
): CidadeEscolhida | null {
  if (!cidade || !cidade.nome) return null;
  const out: CidadeEscolhida = {
    nome: cidade.nome,
    uf: cidade.estado ?? "",
    pais: cidade.pais ?? "BR",
  };
  if (cidade.ibgeId) out.ibgeId = cidade.ibgeId;
  if (cidade.geonameId) out.geonameId = cidade.geonameId;
  if (cidade.latitude !== undefined) out.latitude = cidade.latitude;
  if (cidade.longitude !== undefined) out.longitude = cidade.longitude;
  return out;
}
