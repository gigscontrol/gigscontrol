"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";
import ConfirmarSaidaModal from "./ConfirmarSaidaModal";

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

/**
 * Guarda de "alterações não salvas". Uma tela editável (ex.: editar artista /
 * editar equipe) registra uma função que reporta, no momento da navegação, se
 * há mudanças pendentes (`sujo`) e como persistir (`salvar`, devolve true no
 * sucesso). Enquanto NÃO houver guarda registrada — 99% das telas —, a
 * navegação continua idêntica ao de antes (router.push direto).
 */
/**
 * `salvar: null` = tela sem "salvar e sair" (ex.: wizards de orçamento/venda,
 * onde não existe rascunho persistível) — o popup oferece só Descartar/ficar.
 */
type Guarda = () => { sujo: boolean; salvar: (() => Promise<boolean>) | null };

type NavCtx = {
  /** true quando uma navegação está "lenta" (> limiar) e ainda em andamento. */
  navegando: boolean;
  /** Navega para `href` de forma não-bloqueante. Ignora se já está na rota. */
  navegar: (href: string) => void;
  /** Registra a guarda de saída da tela atual (chamada no mount da tela). */
  registrarGuarda: (g: Guarda) => void;
  /** Remove a guarda registrada (chamada no unmount / após salvar). */
  limparGuarda: () => void;
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

  // ---- Guarda de "alterações não salvas" ----
  // guardaRef guarda a função registrada pela tela editável atual (ou null).
  // `saida` = destino pendente + salvar, quando interceptamos uma navegação
  // com mudanças pendentes (dispara o popup). Só existe UMA guarda por vez
  // (só uma tela de edição fica montada por vez).
  const guardaRef = useRef<Guarda | null>(null);
  const [saida, setSaida] = useState<{ href: string; salvar: (() => Promise<boolean>) | null } | null>(null);
  const [salvandoSaida, setSalvandoSaida] = useState(false);

  const registrarGuarda = useCallback((g: Guarda) => {
    guardaRef.current = g;
  }, []);
  const limparGuarda = useCallback(() => {
    guardaRef.current = null;
  }, []);

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

  // Empurra a rota de fato (sem passar pela guarda). Reusado pelo caminho
  // normal e pelos botões do popup de saída.
  const empurrar = useCallback(
    (href: string) => {
      alvoRef.current = href;
      startTransition(() => {
        router.push(href);
      });
    },
    [router]
  );

  const navegar = (href: string) => {
    if (href === pathname) return; // mesma rota: no-op
    // Sem guarda registrada (99% das telas) → comporta EXATAMENTE como antes.
    const guarda = guardaRef.current;
    if (guarda) {
      const { sujo, salvar } = guarda();
      if (sujo) {
        // Há mudanças pendentes: NÃO navega — segura o destino e abre o popup.
        setSaida({ href, salvar });
        return;
      }
    }
    empurrar(href);
  };

  // Popup: "Descartar" — sai perdendo as alterações.
  const descartarESair = () => {
    if (!saida) return;
    const href = saida.href;
    guardaRef.current = null;
    setSaida(null);
    empurrar(href);
  };

  // Popup: "Salvar e sair" — salva; só sai se o salvar reportar sucesso.
  const salvarESair = async () => {
    if (!saida?.salvar || salvandoSaida) return;
    setSalvandoSaida(true);
    let ok = false;
    try {
      ok = await saida.salvar();
    } catch {
      ok = false;
    }
    setSalvandoSaida(false);
    if (ok) {
      const href = saida.href;
      guardaRef.current = null;
      setSaida(null);
      empurrar(href);
    } else {
      // Falha (ex.: validação) — fecha o popup pro usuário ver o erro na tela.
      setSaida(null);
    }
  };

  return (
    <Ctx.Provider value={{ navegando, navegar, registrarGuarda, limparGuarda }}>
      {children}
      {saida && (
        <ConfirmarSaidaModal
          salvando={salvandoSaida}
          podeSalvar={!!saida.salvar}
          onCancelar={() => setSaida(null)}
          onDescartar={descartarESair}
          onSalvarESair={salvarESair}
        />
      )}
    </Ctx.Provider>
  );
}

export function useNavegacao(): NavCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNavegacao deve ser usado dentro de <NavProvider>");
  return v;
}

/**
 * Igual ao `useNavegacao`, mas devolve `null` fora do provider em vez de
 * lançar. Para telas que também são usadas fora da dashboard (ex.: o form de
 * equipe reaproveitado no onboarding), onde a guarda simplesmente não existe.
 */
export function useNavegacaoOpcional(): NavCtx | null {
  return useContext(Ctx);
}

/**
 * Overlay de carregamento da navegação. Cobre SÓ a área de conteúdo
 * (deve ser filho de um container `relative`, ex.: o <main>). Desfoca o
 * conteúdo atual e mostra um spinner. Aparece só quando `navegando`.
 */
export function NavOverlay() {
  const { navegando } = useNavegacao();
  const t = useT();
  if (!navegando) return null;
  return (
    <div
      className="nav-overlay animate-fade-slow absolute inset-0 z-20 flex items-center justify-center"
      role="status"
      aria-label={t("Carregando")}
    >
      <div className="spinner spinner-sm" style={{ color: "var(--brand)" }} />
    </div>
  );
}
