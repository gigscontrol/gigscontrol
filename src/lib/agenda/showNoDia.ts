/**
 * Um show pertence a esta célula do calendário?
 *
 * Lógica PURA, extraída de `AgendaEscala.tsx` pra poder ser provada por
 * execução (`scripts/test-show-no-dia.ts`). Este casamento já quebrou duas
 * vezes de formas silenciosas — o show simplesmente some da tela, sem erro
 * nenhum — então ele merece bateria própria em vez de leitura de código.
 *
 * Casa pela DATA ISO completa (fonte da verdade). Isso consertou o bug em
 * que um show de 03/jun aparecia também no dia 3 de nov, dez etc. — o match
 * antigo era só por dia-do-mês (`dayId`), ignorando mês/ano.
 */

/** O mínimo que o casamento precisa saber de um show. */
export type ShowNoDiaEntrada = {
  /** "YYYY-MM-DD". Ausente em shows legados. */
  data?: string | null;
  /** Dia-do-mês legado, usado só quando não há `data`. */
  dayId?: number | string;
};

/** O mínimo que o casamento precisa saber de uma célula da grade. */
export type CelulaNoDia = {
  id: number | string;
  /** "YYYY-MM-DD" desta célula. */
  dataISO: string;
  /** Célula de padding: dia de mês vizinho, exibido em tom apagado. */
  isOtherMonth: boolean;
};

/**
 * @param mesesNaGrade meses ("YYYY-MM") que a grade renderiza com células
 *   PRÓPRIAS. Só isso decide se uma célula de padding cede o lugar.
 */
export function showNoDia(
  s: ShowNoDiaEntrada,
  day: CelulaNoDia,
  mesesNaGrade?: Set<string>
): boolean {
  if (s.data && day.dataISO) {
    if (s.data !== day.dataISO) return false;
    // Célula de PADDING (dia de outro mês, ex.: 31/jul na 1ª fileira de
    // agosto): EXIBE o show, em tom apagado. Antes era `return false` cego, e
    // um show de 31/jul sumia da tela de agosto — sem nenhum lugar onde
    // aparecesse, já que a grade renderiza só o mês corrente. Os ITENS da
    // agenda (voo, transporte, evento) sempre apareceram aqui; só o show
    // estava de fora, o que já denunciava o descuido.
    //
    // A trava contra DUPLICAR continua, agora estrutural: se o mês do show
    // também estiver renderizado nesta mesma grade, o padding cede o lugar
    // pra célula real. Hoje a grade é sempre de UM mês, então o padding
    // sempre mostra; a regra mantém isso correto se surgir visão multi-mês.
    if (day.isOtherMonth && mesesNaGrade?.has(s.data.slice(0, 7))) return false;
    return true;
  }
  // Show legado sem `data`: casa por dia-do-mês, válido só dentro do mês
  // exibido (o `id` do padding é "prev-31"/"next-1", que nunca casa com um
  // dayId numérico — o guarda abaixo é explícito por segurança).
  if (day.isOtherMonth) return false;
  return s.dayId === day.id;
}
