"use client";

import { useEffect, useRef, type RefObject } from "react";
import { pilhaModais } from "./pilhaModais";

/** Elementos que participam do ciclo de Tab dentro do diálogo. */
const FOCAVEIS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** `overflow` do body antes do 1º diálogo abrir (devolvido quando o último fecha). */
let overflowAntes = "";

/**
 * Comportamento de diálogo modal pra qualquer camada (o Modal e os overlays
 * de tela cheia que não usam ele):
 *  - ao abrir, foca o 1º elemento focável (ou fica no campo com autoFocus);
 *  - Tab/Shift+Tab circulam DENTRO; Esc chama `onFechar` (sem `onFechar`, o
 *    Esc não fecha — ex.: tela que exige confirmar antes de sair);
 *  - com diálogo dentro de diálogo, só o do topo responde (lib/pilhaModais);
 *  - trava a rolagem da página e, ao fechar, devolve o foco pra quem abriu.
 *
 * `onFechar` fica num ref: as telas passam função inline, que muda a cada
 * render — com ela nas dependências, cada tecla digitada refazia o efeito e
 * jogava o foco pro 1º botão.
 */
export function useDialogo(
  ref: RefObject<HTMLElement | null>,
  aberto: boolean,
  onFechar?: () => void
): void {
  const onFecharRef = useRef(onFechar);
  useEffect(() => {
    onFecharRef.current = onFechar;
  });

  useEffect(() => {
    if (!aberto) return;
    const eu = pilhaModais.abrir();
    const focoAnterior = document.activeElement as HTMLElement | null;
    const focarPrimeiro = () => {
      const raiz = ref.current;
      if (!raiz) return;
      // Um campo com autoFocus já pegou o foco: fica nele.
      if (raiz.contains(document.activeElement)) return;
      const alvo = raiz.querySelector<HTMLElement>(FOCAVEIS);
      (alvo ?? raiz).focus();
    };
    // Depois do paint — o portal precisa existir no DOM.
    const id = requestAnimationFrame(focarPrimeiro);

    const handler = (e: KeyboardEvent) => {
      // Só o do topo responde; `defaultPrevented` = um seletor aberto dentro
      // do diálogo já tratou o Esc (ele fecha, o diálogo fica).
      if (!pilhaModais.noTopo(eu) || e.defaultPrevented) return;
      if (e.key === "Escape") {
        if (!onFecharRef.current) return;
        e.preventDefault();
        onFecharRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const raiz = ref.current;
      if (!raiz) return;
      const focaveis = Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS));
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const ativo = document.activeElement;
      // Foco fora do dialog (ou nas pontas) → circula pra dentro.
      if (e.shiftKey) {
        if (ativo === primeiro || !raiz.contains(ativo)) {
          e.preventDefault();
          ultimo.focus();
        }
      } else if (ativo === ultimo || !raiz.contains(ativo)) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", handler);
    if (pilhaModais.tamanho === 1) overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", handler);
      pilhaModais.fechar(eu);
      if (pilhaModais.tamanho === 0) document.body.style.overflow = overflowAntes;
      // Restaura o foco pra quem abriu (se ainda está na página).
      if (focoAnterior && document.contains(focoAnterior)) focoAnterior.focus();
    };
  }, [aberto, ref]);
}
