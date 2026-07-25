import { TEXTO_TRANSLADO, type LogisticaSelecao } from "@/types";

/** Código IATA normalizado: 3 letras maiúsculas, ou "" se vazio. */
export function iata(v?: string): string {
  return (v ?? "").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3);
}

/** "GRU>CWB" entre parênteses, ou "" se algum aeroporto faltar. */
function rota(origem?: string, destino?: string): string {
  const o = iata(origem);
  const d = iata(destino);
  return o && d ? ` (${o}>${d})` : "";
}

/**
 * Linhas de texto da logística, na ordem de exibição — fonte ÚNICA usada pela
 * mensagem do orçamento (whatsapp.ts), pelo fechamento da venda
 * (fechamentoVenda.ts) e pelos detalhes (Orçamento/Venda).
 *
 * Aéreas SEPARADAS ida/volta, com aeroporto de partida>destino quando os dois
 * códigos existem. Bagagens extras e translado seguem depois. Retorno vazio =
 * "logística já inclusa no cachê" (o chamador decide o cabeçalho).
 *
 * COMPAT: orçamentos antigos só têm `aereaQtd` (ida+volta combinada). Só caímos
 * nessa linha legada quando NÃO há aérea v2 (senão duplicaria).
 */
export function linhasLogistica(l: LogisticaSelecao): string[] {
  const linhas: string[] = [];

  const ida = l.aereaIdaQtd ?? 0;
  const volta = l.aereaVoltaQtd ?? 0;
  const temAereaV2 = ida > 0 || volta > 0;
  if (ida > 0)
    linhas.push(`${ida}x Passagem aérea ida${rota(l.aereaIdaOrigem, l.aereaIdaDestino)}`);
  if (volta > 0)
    linhas.push(`${volta}x Passagem aérea volta${rota(l.aereaVoltaOrigem, l.aereaVoltaDestino)}`);
  if (!temAereaV2 && (l.aereaQtd ?? 0) > 0)
    linhas.push(`${l.aereaQtd}x Logística Aérea (Ida e Volta)`);

  const bagD = l.bagagemDespachadaQtd ?? 0;
  const bagE = l.bagagemEspecialQtd ?? 0;
  if (bagD > 0) linhas.push(`${bagD}x Bagagem despachada extra`);
  if (bagE > 0) linhas.push(`${bagE}x Bagagem especial extra`);

  if (l.transladoTerrestre) linhas.push(TEXTO_TRANSLADO);
  return linhas;
}

/** Há alguma logística selecionada? (senão = já inclusa no cachê). */
export function temLogistica(l: LogisticaSelecao): boolean {
  return linhasLogistica(l).length > 0;
}
