import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaxaAgenciaModo } from "@/types";
import { calcularTaxaAgencia } from "@/lib/taxaAgencia";
import { buscarArtista } from "@/lib/repositories/artistas.repo";
import { rowParaArtista } from "@/lib/mappers/artista";

/**
 * Resolve a taxa da agência (comissão) no SERVIDOR — fonte da verdade. O
 * cliente só faz preview e não enxerga o fee de artistas alheios (redigirArtista o
 * esconde). Busca o artista, lê o modo/valor configurado e aplica o cálculo.
 *
 * `preservarVariavelSemInput` (usado em UPDATE/concretização): se o modo é
 * VARIÁVEL e não veio um novo `taxaDigitada`, retorna null para o caller MANTER
 * (ou herdar) a taxa já definida — senão um update de cachê zeraria o valor que
 * o usuário digitou no orçamento.
 *
 * Retorna null quando não dá pra resolver (sem artista/cachê, ou variável
 * preservada) — nesse caso o caller não mexe em taxa_agencia_valor.
 */
export async function resolverTaxaAgencia(
  supabase: SupabaseClient,
  params: {
    artistId: string | null | undefined;
    cache: number | null | undefined;
    taxaDigitada?: number | null;
    preservarVariavelSemInput?: boolean;
  }
): Promise<{ taxa_agencia_valor: number; taxa_modo_aplicado: TaxaAgenciaModo } | null> {
  if (!params.artistId || params.cache == null) return null;
  const row = await buscarArtista(supabase, params.artistId);
  if (!row) return null;
  const artista = rowParaArtista(row);
  const variavel =
    artista.taxaModo === "perc-variavel" || artista.taxaModo === "valor-variavel";
  if (params.preservarVariavelSemInput && variavel && params.taxaDigitada == null) {
    return null;
  }
  const { valor, modoAplicado } = calcularTaxaAgencia({
    modo: artista.taxaModo,
    taxaValorArtista: artista.taxaValor ?? null,
    cache: params.cache,
    entradaVariavel: params.taxaDigitada ?? null,
  });
  return { taxa_agencia_valor: valor, taxa_modo_aplicado: modoAplicado };
}
