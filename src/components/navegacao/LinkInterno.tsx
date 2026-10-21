"use client";

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useNavegacaoOpcional } from "../NavOverlay";

/**
 * Link de verdade (`<a href>`) pra uma tela do painel. O clique normal segue
 * pelo caminho do app (`navegar`: Voltar inteligente, aviso de alteração não
 * salva) ou pelo `onAbrir` de quem chama; Ctrl/Cmd/Shift + clique, clique do
 * meio e "abrir em nova aba" ficam com o navegador — como em qualquer site.
 * Também dá teclado (Tab + Enter) e "copiar endereço do link" de graça.
 */
export default function LinkInterno({
  href,
  onAbrir,
  children,
  ...resto
}: {
  href: string;
  /** O que o clique normal faz. Sem ele: `navegar(href)`. */
  onAbrir?: () => void;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">) {
  const nav = useNavegacaoOpcional();
  return (
    <a
      {...resto}
      href={href}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        if (abreFora(e)) return;
        e.preventDefault();
        if (onAbrir) onAbrir();
        else nav?.navegar(href);
      }}
    >
      {children}
    </a>
  );
}

/** Clique que o navegador deve tratar sozinho (nova aba / nova janela). */
export function abreFora(e: MouseEvent): boolean {
  return e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}
