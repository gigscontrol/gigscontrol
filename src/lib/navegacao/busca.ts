/**
 * Motor da busca geral (Ctrl+K). Puro — testado em busca.test.ts.
 *
 * Regras: ignora maiúsculas e acentos; TODAS as palavras digitadas precisam
 * aparecer (em qualquer ordem); número só com dígitos casa com telefone/
 * documento formatado; resultado ordenado por relevância (começo de palavra
 * e número exato pesam mais) e limitado por tipo.
 */

export type TipoBusca =
  | "acao"
  | "pagina"
  | "venda"
  | "orcamento"
  | "contrato"
  | "contratante"
  | "casa";

export type ItemBusca = {
  id: string;
  tipo: TipoBusca;
  titulo: string;
  subtitulo?: string;
  /** Destino ao escolher. */
  href: string;
  /** Texto onde a busca procura (título + o que mais fizer sentido). */
  texto: string;
  /** Identificador forte (VND-0063, CTR-0012…): casar exato sobe pro topo. */
  codigo?: string;
};

export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const soDigitos = (s: string) => s.replace(/\D/g, "");

/** Pontuação do item pra consulta (0 = não casa). */
export function pontuar(item: ItemBusca, consulta: string): number {
  const q = normalizar(consulta);
  if (!q) return 0;
  const texto = normalizar(item.texto);
  const digitosTexto = soDigitos(item.texto);
  const palavras = q.split(" ");
  let pontos = 0;
  for (const p of palavras) {
    const dig = soDigitos(p);
    // Palavra só de dígitos (3+): casa com telefone/documento formatado.
    const casaDigitos = dig.length >= 3 && dig === p.replace(/[\s().-]/g, "") && digitosTexto.includes(dig);
    const idx = texto.indexOf(p);
    if (idx < 0 && !casaDigitos) return 0;
    if (idx === 0) pontos += 6;
    else if (idx > 0 && texto[idx - 1] === " ") pontos += 4;
    else pontos += 1;
  }
  if (item.codigo) {
    const c = normalizar(item.codigo);
    if (c === q) pontos += 50;
    else if (c.endsWith(q) || c.includes(q)) pontos += 10;
  }
  if (normalizar(item.titulo).startsWith(q)) pontos += 8;
  return pontos;
}

/** Resultados ordenados, no máximo `porTipo` de cada tipo. */
export function buscar(itens: readonly ItemBusca[], consulta: string, porTipo = 5): ItemBusca[] {
  const comNota = itens
    .map((item) => ({ item, nota: pontuar(item, consulta) }))
    .filter((x) => x.nota > 0)
    .sort((a, b) => b.nota - a.nota);
  const contagem = new Map<TipoBusca, number>();
  const out: ItemBusca[] = [];
  for (const { item } of comNota) {
    const n = contagem.get(item.tipo) ?? 0;
    if (n >= porTipo) continue;
    contagem.set(item.tipo, n + 1);
    out.push(item);
  }
  return out;
}
