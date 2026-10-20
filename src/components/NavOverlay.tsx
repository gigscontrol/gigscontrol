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
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n";
import ConfirmarSaidaModal from "./ConfirmarSaidaModal";
import {
  registrarVisita,
  restaurarPilha,
  temAnterior,
  anterior,
} from "@/lib/navegacao/pilha";
import type { Sobreposicao } from "@/lib/navegacao/rotas";

const CHAVE_PILHA = "gc-pilha-nav";

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
  /**
   * Navega para `href` de forma não-bloqueante. Ignora se já está na URL.
   * `substituir`: troca a entrada atual do histórico em vez de criar outra —
   * use depois de SALVAR um formulário (o Voltar da tela seguinte não deve
   * cair de novo no formulário).
   */
  navegar: (href: string, opts?: { substituir?: boolean }) => void;
  /**
   * "Voltar" de verdade: volta pra tela de onde a pessoa veio. Sem tela
   * anterior no app (chegou por link/notificação) → vai pro `padrao`.
   */
  voltar: (padrao: string) => void;
  /**
   * Depois de SALVAR: leva até `href`. Se `href` é a tela anterior (abriu o
   * formulário a partir dela), volta no histórico — sem duplicar a entrada;
   * senão vai até ela substituindo o formulário.
   */
  voltarPara: (href: string) => void;
  /** Abre um modal com endereço (`?show=<id>` / `?parcela=<id>`) por cima da tela atual. */
  abrirSobreposicao: (tipo: Sobreposicao, id: string) => void;
  /** Fecha o modal com endereço (volta no histórico se foi aberto pelo app). */
  fecharSobreposicao: (tipo: Sobreposicao) => void;
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
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  // URL completa (caminho + query): modais com endereço vivem na query, então
  // "já estou aqui?" e a pilha do Voltar precisam olhar os dois.
  const urlAtual = query ? `${pathname}?${query}` : pathname;
  const urlAtualRef = useRef(urlAtual);
  urlAtualRef.current = urlAtual;

  const [isPending, startTransition] = useTransition();
  const [navegando, setNavegando] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alvoRef = useRef<string | null>(null);

  // ---- Pilha do Voltar (ver lib/navegacao/pilha.ts) ----
  const pilhaRef = useRef<string[] | null>(null);
  const proximaSubstituiRef = useRef(false);
  const persistirPilha = (p: string[]) => {
    try {
      sessionStorage.setItem(CHAVE_PILHA, JSON.stringify(p));
    } catch {
      /* modo privado / quota — a pilha segue em memória */
    }
  };
  useEffect(() => {
    if (pilhaRef.current === null) {
      // 1ª montagem (carga da página / F5): restaura só se a pilha salva
      // termina AQUI — senão recomeça (link novo, pós-login, outra aba).
      let salva: unknown = null;
      try {
        salva = JSON.parse(sessionStorage.getItem(CHAVE_PILHA) ?? "null");
      } catch {
        salva = null;
      }
      pilhaRef.current = restaurarPilha(salva, urlAtual);
    } else {
      pilhaRef.current = registrarVisita(
        pilhaRef.current,
        urlAtual,
        proximaSubstituiRef.current
      );
    }
    proximaSubstituiRef.current = false;
    persistirPilha(pilhaRef.current);
  }, [urlAtual]);

  // ---- Guarda de "alterações não salvas" ----
  // guardaRef guarda a função registrada pela tela editável atual (ou null).
  // `saida` = a ação pendente (ir pra um destino OU voltar) + salvar, quando
  // interceptamos uma saída com mudanças pendentes (dispara o popup). Só
  // existe UMA guarda por vez (só uma tela de edição fica montada por vez).
  const guardaRef = useRef<Guarda | null>(null);
  const [saida, setSaida] = useState<{ ir: () => void; salvar: (() => Promise<boolean>) | null } | null>(null);
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
    (href: string, substituir = false) => {
      alvoRef.current = href;
      proximaSubstituiRef.current = substituir;
      startTransition(() => {
        if (substituir) router.replace(href);
        else router.push(href);
      });
    },
    [router]
  );

  /** Executa `ir` — ou segura e pergunta, se a tela atual tem edição pendente. */
  const comGuarda = useCallback((ir: () => void) => {
    // Sem guarda registrada (99% das telas) → segue direto.
    const guarda = guardaRef.current;
    if (guarda) {
      const { sujo, salvar } = guarda();
      if (sujo) {
        setSaida({ ir, salvar });
        return;
      }
    }
    ir();
  }, []);

  // Fechar um modal com endereço é ADIADO um instante: botões como "Abrir
  // venda" dentro do modal do show fecham e navegam no mesmo clique — sem o
  // adiamento, o "voltar" do fechar disputava com a ida pra venda e a pessoa
  // caía de volta no modal. Qualquer navegação logo em seguida cancela o
  // fechar (a entrada do modal fica no histórico: o Voltar da venda reabre o
  // show de onde a pessoa veio).
  const fecharPendenteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelarFecharPendente = () => {
    if (fecharPendenteRef.current) {
      clearTimeout(fecharPendenteRef.current);
      fecharPendenteRef.current = null;
    }
  };

  const navegar = useCallback(
    (href: string, opts?: { substituir?: boolean }) => {
      cancelarFecharPendente();
      if (href === urlAtualRef.current) return; // mesma URL: no-op
      comGuarda(() => empurrar(href, !!opts?.substituir));
    },
    [comGuarda, empurrar]
  );

  const voltar = useCallback(
    (padrao: string) => {
      cancelarFecharPendente();
      const pilha = pilhaRef.current ?? [];
      comGuarda(() => {
        if (temAnterior(pilha)) {
          alvoRef.current = anterior(pilha);
          router.back();
        } else {
          // Sem tela anterior do app: "sobe" pro destino-padrão SUBSTITUINDO
          // (o voltar do navegador não deve reabrir a ficha de onde saiu).
          empurrar(padrao, true);
        }
      });
    },
    [comGuarda, empurrar, router]
  );

  const voltarPara = useCallback(
    (href: string) => {
      cancelarFecharPendente();
      const pilha = pilhaRef.current ?? [];
      comGuarda(() => {
        if (anterior(pilha) === href) {
          alvoRef.current = href;
          router.back();
        } else {
          empurrar(href, true);
        }
      });
    },
    [comGuarda, empurrar, router]
  );

  const abrirSobreposicao = useCallback(
    (tipo: Sobreposicao, id: string) => {
      cancelarFecharPendente();
      const sp = new URLSearchParams(searchParams.toString());
      sp.set(tipo, id);
      empurrar(`${pathname}?${sp.toString()}`);
    },
    [empurrar, pathname, searchParams]
  );

  const fecharSobreposicao = useCallback(
    (tipo: Sobreposicao) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (!sp.has(tipo)) return;
      sp.delete(tipo);
      const destino = sp.toString() ? `${pathname}?${sp.toString()}` : pathname;
      cancelarFecharPendente();
      fecharPendenteRef.current = setTimeout(() => {
        fecharPendenteRef.current = null;
        const pilha = pilhaRef.current ?? [];
        // Aberto pelo app → volta no histórico (o voltar do navegador fica
        // coerente). Aberto por link → só tira o parâmetro.
        if (anterior(pilha) === destino) router.back();
        else empurrar(destino, true);
      }, 0);
    },
    [empurrar, pathname, router, searchParams]
  );

  // Popup: "Descartar" — sai perdendo as alterações.
  const descartarESair = () => {
    if (!saida) return;
    const { ir } = saida;
    guardaRef.current = null;
    setSaida(null);
    ir();
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
      const { ir } = saida;
      guardaRef.current = null;
      setSaida(null);
      ir();
    } else {
      // Falha (ex.: validação) — fecha o popup pro usuário ver o erro na tela.
      setSaida(null);
    }
  };

  return (
    <Ctx.Provider
      value={{
        navegando,
        navegar,
        voltar,
        voltarPara,
        abrirSobreposicao,
        fecharSobreposicao,
        registrarGuarda,
        limparGuarda,
      }}
    >
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
