import { TEXTO_TRANSLADO, type LogisticaSelecao } from "@/types";
import { formatarQuantidade } from "@/lib/contratos/extenso";

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
 *
 * Quantidades no formato "de contrato" — "02 (duas) …" — em TODAS as
 * superfícies (pedido do dono: nada de "2x"). Passagem/bagagem/logística
 * são femininos → extenso no feminino.
 */
export function linhasLogistica(l: LogisticaSelecao): string[] {
  const q = (n: number): string => formatarQuantidade(n, "pt", "f");
  const linhas: string[] = [];

  const ida = l.aereaIdaQtd ?? 0;
  const volta = l.aereaVoltaQtd ?? 0;
  const temAereaV2 = ida > 0 || volta > 0;
  if (ida > 0)
    linhas.push(`${q(ida)} Passagem aérea ida${rota(l.aereaIdaOrigem, l.aereaIdaDestino)}`);
  if (volta > 0)
    linhas.push(`${q(volta)} Passagem aérea volta${rota(l.aereaVoltaOrigem, l.aereaVoltaDestino)}`);
  if (!temAereaV2 && (l.aereaQtd ?? 0) > 0)
    linhas.push(`${q(l.aereaQtd)} Logística Aérea (Ida e Volta)`);

  const bagD = l.bagagemDespachadaQtd ?? 0;
  const bagE = l.bagagemEspecialQtd ?? 0;
  if (bagD > 0) linhas.push(`${q(bagD)} Bagagem despachada extra`);
  if (bagE > 0) linhas.push(`${q(bagE)} Bagagem especial extra`);

  if (l.transladoTerrestre) linhas.push(TEXTO_TRANSLADO);
  return linhas;
}

/** Há alguma logística selecionada? (senão = já inclusa no cachê). */
export function temLogistica(l: LogisticaSelecao): boolean {
  return linhasLogistica(l).length > 0;
}
