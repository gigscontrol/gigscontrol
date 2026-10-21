"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { useT } from "@/lib/i18n";

export type ItemMenuLinha = {
  chave: string;
  rotulo: string;
  icone: ReactNode;
  onClick: () => void;
  desabilitado?: boolean;
  /** Por que está desabilitado — aparece escrito no item (title some no toque). */
  motivo?: string;
  /** Ação destrutiva (vermelho). */
  perigo?: boolean;
  /** Linha separadora antes deste item. */
  separar?: boolean;
};

const LARGURA = 224;
const MARGEM = 8;

/**
 * Menu "⋯" das ações secundárias de uma linha de lista (padrão das listas:
 * no máximo 2 ações à vista, o resto aqui). Vai num portal com posição fixa
 * porque a tabela rola na horizontal e cortaria um menu absoluto. Teclado:
 * abre focando o 1º item, setas/Home/End andam, Esc fecha e devolve o foco.
 */
export default function MenuLinha({ itens, rotulo }: { itens: ItemMenuLinha[]; rotulo?: string }) {
  const t = useT();
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  function fechar(devolverFoco: boolean) {
    setAberto(false);
    setPos(null);
    if (devolverFoco) gatilho.current?.focus();
  }

  // Posiciona depois de montar (precisa da altura real do menu): alinhado à
  // direita do botão, embaixo — ou em cima, se não couber até o fim da tela.
  useLayoutEffect(() => {
    if (!aberto || !gatilho.current || !menu.current) return;
    const r = gatilho.current.getBoundingClientRect();
    const altura = menu.current.offsetHeight;
    const cabeEmbaixo = r.bottom + 4 + altura <= window.innerHeight - MARGEM;
    const top = cabeEmbaixo ? r.bottom + 4 : Math.max(MARGEM, r.top - 4 - altura);
    const left = Math.min(
      Math.max(MARGEM, r.right - LARGURA),
      window.innerWidth - LARGURA - MARGEM
    );
    setPos({ top, left });
  }, [aberto]);

  // Foco no 1º item só depois de visível (elemento escondido não recebe foco).
  useEffect(() => {
    if (!aberto || !pos) return;
    menu.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not([aria-disabled=true])")?.focus();
  }, [aberto, pos]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (menu.current?.contains(alvo) || gatilho.current?.contains(alvo)) return;
      fechar(false);
    };
    // Rolar a página ou redimensionar descola o menu do botão: fecha.
    const sair = (e: Event) => {
      // No resize o alvo é a janela (não é Node).
      if (e.target instanceof Node && menu.current?.contains(e.target)) return;
      fechar(false);
    };
    document.addEventListener("mousedown", fora);
    window.addEventListener("scroll", sair, true);
    window.addEventListener("resize", sair);
    return () => {
      document.removeEventListener("mousedown", fora);
      window.removeEventListener("scroll", sair, true);
      window.removeEventListener("resize", sair);
    };
  }, [aberto]);

  function teclado(e: React.KeyboardEvent<HTMLDivElement>) {
    const botoes = Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not([aria-disabled=true])") ?? []
    );
    const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
    const focar = (i: number) => botoes[(i + botoes.length) % botoes.length]?.focus();
    if (e.key === "Escape") {
      e.preventDefault();
      fechar(true);
    } else if (e.key === "Tab") {
      fechar(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focar(atual + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focar(atual - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focar(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focar(botoes.length - 1);
    }
  }

  if (itens.length === 0) return null;

  return (
    <>
      <button
        ref={gatilho}
        type="button"
        onClick={() => (aberto ? fechar(false) : setAberto(true))}
        aria-label={rotulo ?? t("Mais ações")}
        title={rotulo ?? t("Mais ações")}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        className="btn-ghost inline-flex h-9 w-9 items-center justify-center rounded-md max-md:h-10 max-md:w-10"
      >
        <MoreHorizontal size={16} />
      </button>
      {aberto &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="menu"
            onKeyDown={teclado}
            className="fixed z-[60] overflow-hidden rounded-lg border border-border bg-surface p-1.5 animate-in"
            style={{
              width: LARGURA,
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              // Invisível até medir, pra não piscar no canto da tela.
              visibility: pos ? "visible" : "hidden",
              boxShadow: "0 12px 30px var(--shadow-color)",
            }}
          >
            {itens.map((item) => (
              <div key={item.chave}>
                {item.separar && <div role="separator" className="my-1 border-t border-border" />}
                <button
                  type="button"
                  role="menuitem"
                  aria-disabled={item.desabilitado || undefined}
                  onClick={() => {
                    if (item.desabilitado) return;
                    fechar(false);
                    item.onClick();
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors max-md:min-h-[44px] ${
                    item.desabilitado
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-elevated focus-visible:bg-elevated"
                  }`}
                  style={{ color: item.perigo ? "var(--danger)" : "var(--text-primary)" }}
                >
                  <span className="flex flex-shrink-0 items-center">{item.icone}</span>
                  <span className="min-w-0">
                    <span className="block">{item.rotulo}</span>
                    {item.desabilitado && item.motivo && (
                      <span className="block text-xs text-muted">{item.motivo}</span>
                    )}
                  </span>
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
