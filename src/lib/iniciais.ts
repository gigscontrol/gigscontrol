/**
 * INICIAIS DE UM NOME — fonte ÚNICA de todos os avatares de texto do app.
 *
 * Antes havia TRÊS regras divergentes na tela: primeira letra de cada palavra
 * (Topbar/AbaEquipe), UMA letra só (`charAt(0)` — cards de artista, lixeira,
 * mini-lixeira) e split/slice manual (AdminClientes). Call-sites migrados:
 * Topbar, AbaEquipe (×3), AbaArtistas (×5), AbaLixeira (×5), MiniLixeira (×3)
 * e AdminClientes. Avatar novo = importar daqui, nunca reimplementar.
 *
 * Regra:
 *   - 2+ palavras → primeira letra das DUAS primeiras ("Bruno Rafael" → "BR");
 *   - 1 palavra   → as DUAS primeiras letras ("Zé" → "ZÉ", "Ana" → "AN").
 *
 * O bug relatado ("Zé" virava "Z") NÃO era acento: a implementação antiga
 * pegava a primeira letra de CADA palavra, e nome de uma palavra só rendia uma
 * letra. Por isso aqui NÃO há `normalize()`/strip de diacrítico — `toUpperCase`
 * preserva o acento ("é" → "É"), que é exatamente o que se quer na tela.
 *
 * Devolve "" para nome vazio/ausente — o call-site escolhe o placeholder.
 */
export function iniciaisDoNome(nome: string | null | undefined): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}
