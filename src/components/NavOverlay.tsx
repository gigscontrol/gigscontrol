"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Navegação não-bloqueante do app.
 *
 * `navegar(href)` envolve o router.push num useTransition. Enquanto a
 * transição está pendente, o conteúdo ATUAL continua montado e visível
 * (App Router mantém a tela antiga até a nova ficar pronta). Só mostramos
 * o overlay (blur + spinner) se a transição passar de ~150ms — assim
 * navegações instantâneas (dados já em cache nos contexts) não piscam
 * nada, e telas que dependem de fetch ganham um feedback bonito.
 */

type NavCtx = {
  /** true quando uma navegação está "lenta" (> limiar) e ainda em andamento. */
  navegando: boolean;
  /** Navega para `href` de forma não-bloqueante. Ignora se já está na rota. */
  navegar: (href: string) => void;
};

const Ctx = createContext<NavCtx | null>(null);

/** Limiar pra exibir o overlay — abaixo disso a navegação é "instantânea". */
const LIMIAR_MS = 150;

export function NavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [navegando, setNavegando] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alvoRef = useRef<string | null>(null);

  // Mostra o overlay só se a transição pendente passar do limiar (anti-flash).
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isPending && alvoRef.current) {
      timerRef.current = setTimeout(() => setNavegando(true), LIMIAR_MS);
    } else {
      setNavegando(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPending]);

  // Chegou na rota nova → limpa o overlay.
  useEffect(() => {
    alvoRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    setNavegando(false);
  }, [pathname]);

  const navegar = (href: string) => {
    if (href === pathname) return; // mesma rota: no-op
    alvoRef.current = href;
    startTransition(() => {
      router.push(href);
    });
  };

  return <Ctx.Provider value={{ navegando, navegar }}>{children}</Ctx.Provider>;
}

export function useNavegacao(): NavCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNavegacao deve ser usado dentro de <NavProvider>");
  return v;
}

/**
 * Overlay de carregamento da navegação. Cobre SÓ a área de conteúdo
 * (deve ser filho de um container `relative`, ex.: o <main>). Desfoca o
 * conteúdo atual e mostra um spinner. Aparece só quando `navegando`.
 */
export function NavOverlay() {
  const { navegando } = useNavegacao();
  if (!navegando) return null;
  return (
    <div
      className="nav-overlay animate-fade-slow absolute inset-0 z-20 flex items-center justify-center"
      role="status"
      aria-label="Carregando"
    >
      <div className="spinner spinner-sm" style={{ color: "var(--brand)" }} />
    </div>
  );
}
