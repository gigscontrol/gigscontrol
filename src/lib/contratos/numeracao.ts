import type { SecaoModelo } from "@/lib/mappers/contratoModelo";

/**
 * Numeração automática das cláusulas e sub-cláusulas de um modelo.
 *
 * Uma seção "clausula" é um CONTAINER de cláusulas: cada item do tipo
 * "clausula" ABRE uma cláusula nova, numerada 1, 2, 3… GLOBALMENTE no
 * documento (a contagem atravessa seções, na ordem em que aparecem). Os
 * itens "subclausula" recebem N.M dentro da cláusula corrente; "paragrafo"
 * não recebe número.
 *
 * Sub-cláusula ANTES de qualquer item "clausula" na seção (cláusula anônima,
 * ex.: usuário apagou o título) abre uma cláusula implícita — a numeração
 * nunca quebra.
 *
 * O usuário nunca digita número — reordenar renumera tudo automaticamente.
 */
export type Numeracao = {
  /** itemId (item tipo "clausula") -> número (1, 2, 3…) */
  clausulas: Record<string, number>;
  /** itemId (sub-cláusula) -> rótulo "N.M" */
  itens: Record<string, string>;
  /**
   * itemId (parágrafo) -> rótulo jurídico: "Parágrafo único" quando é o ÚNICO
   * parágrafo da cláusula; "§ 1º", "§ 2º"… quando há mais de um (praxe BR).
   */
  paragrafos: Record<string, string>;
};

export function calcularNumeracao(secoes: SecaoModelo[]): Numeracao {
  const clausulas: Record<string, number> = {};
  const itens: Record<string, string> = {};
  const paragrafos: Record<string, string> = {};
  let n = 0;
  // Parágrafos da cláusula corrente — rotulados no fechamento dela (só aí
  // sabemos se é "único" ou "§ Nº").
  let grupoParagrafos: string[] = [];
  const fecharClausula = () => {
    if (grupoParagrafos.length === 1) {
      paragrafos[grupoParagrafos[0]] = "Parágrafo único";
    } else {
      grupoParagrafos.forEach((id, i) => {
        paragrafos[id] = `§ ${i + 1}º`;
      });
    }
    grupoParagrafos = [];
  };

  for (const s of secoes) {
    if (s.tipo !== "clausula") continue;
    let m = 0;
    let aberta = false;
    for (const it of s.itens) {
      if (it.tipo === "clausula") {
        fecharClausula();
        n++;
        m = 0;
        aberta = true;
        clausulas[it.id] = n;
      } else if (it.tipo === "subclausula") {
        if (!aberta) {
          // cláusula implícita (seção sem item "clausula" antes dos numerados)
          n++;
          m = 0;
          aberta = true;
        }
        m++;
        itens[it.id] = `${n}.${m}`;
      } else {
        grupoParagrafos.push(it.id);
      }
    }
    fecharClausula(); // parágrafos não atravessam seções
  }
  return { clausulas, itens, paragrafos };
}
