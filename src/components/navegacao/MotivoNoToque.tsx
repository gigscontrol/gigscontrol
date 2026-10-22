"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Balao = { texto: string; x: number; y: number; embaixo: boolean };

const LARGURA = 260;
const ALVO = 44;

/**
 * Botão desabilitado explica o motivo no `title` ("Você não tem permissão
 * para isso.") — no toque o title nunca aparece e o toque não fazia nada:
 * quem tem papel restrito via um botão apagado sem saber por quê.
 *
 * Em aparelho sem hover, tocar num botão desabilitado com title mostra o
 * motivo num balão em cima dele por alguns segundos.
 *
 * Botão desabilitado não recebe clique; no toque o CSS (globals.css) tira os
 * eventos dele, o clique cai no que está por baixo e aqui — na captura, na
 * janela, antes do React — o botão é achado pela posição. O clique para aí:
 * não abre a linha da tabela nem o link que está por baixo.
 */
export default function MotivoNoToque() {
  const [balao, setBalao] = useState<Balao | null>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: none)").matches) return;
    let timer: number | undefined;
    const aoClicar = (e: MouseEvent) => {
      const { clientX: x, clientY: y } = e;
      const alvo = Array.from(document.querySelectorAll<HTMLButtonElement>("button:disabled[title]")).find((b) => {
        const r = b.getBoundingClientRect();
        // A área de toque é de 44 px mesmo em botão menor (globals.css).
        const fx = Math.max(0, (ALVO - r.width) / 2);
        const fy = Math.max(0, (ALVO - r.height) / 2);
        return r.width > 0 && x >= r.left - fx && x <= r.right + fx && y >= r.top - fy && y <= r.bottom + fy;
      });
      if (!alvo) {
        setBalao(null);
        return;
      }
      // Só se o botão está à vista nesse ponto (não coberto por um modal).
      const topo = document.elementFromPoint(x, y);
      if (!topo || !topo.contains(alvo)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const r = alvo.getBoundingClientRect();
      const embaixo = r.top < 64;
      setBalao({ texto: alvo.title, x: r.left + r.width / 2, y: embaixo ? r.bottom + 8 : r.top - 8, embaixo });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setBalao(null), 3000);
    };
    window.addEventListener("click", aoClicar, true);
    return () => {
      window.removeEventListener("click", aoClicar, true);
      window.clearTimeout(timer);
    };
  }, []);

  if (!balao) return null;
  const meia = LARGURA / 2 + 8;
  return createPortal(
    <div
      role="status"
      className="pointer-events-none fixed rounded-md border border-border bg-elevated px-3 py-2 text-xs text-primary animate-fade"
      style={{
        zIndex: 10000,
        maxWidth: LARGURA,
        left: Math.min(Math.max(balao.x, meia), window.innerWidth - meia),
        top: balao.y,
        transform: `translate(-50%, ${balao.embaixo ? "0" : "-100%"})`,
        boxShadow: "0 8px 24px var(--shadow-color)",
      }}
    >
      {balao.texto}
    </div>,
    document.body
  );
}
