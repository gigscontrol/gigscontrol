/**
 * Pilha dos modais abertos, do mais antigo pro mais recente.
 *
 * Com um modal aberto DENTRO de outro (confirmação dentro da ficha, anotações
 * dentro do show), cada um escuta o teclado no `document`. Sem a pilha, o de
 * baixo também tratava o Tab (puxava o foco de volta pro 1º elemento dele) e o
 * Esc (fechava os dois de uma vez). Regra: só o modal do TOPO responde.
 *
 * Também guarda o `overflow` do body: o 1º modal a abrir trava a rolagem e só
 * o último a fechar devolve — fechando os dois juntos (React desmonta de cima
 * pra baixo), a página não fica presa sem rolagem.
 *
 * Módulo puro — coberto por pilhaModais.test.ts.
 */
export function criarPilhaModais() {
  const pilha: symbol[] = [];
  return {
    /** Empilha um modal; devolve o id dele. */
    abrir(): symbol {
      const id = Symbol("modal");
      pilha.push(id);
      return id;
    },
    /** Tira o modal da pilha (esteja onde estiver). */
    fechar(id: symbol): void {
      const i = pilha.indexOf(id);
      if (i >= 0) pilha.splice(i, 1);
    },
    noTopo(id: symbol): boolean {
      return pilha.length > 0 && pilha[pilha.length - 1] === id;
    },
    get tamanho(): number {
      return pilha.length;
    },
  };
}

export const pilhaModais = criarPilhaModais();
