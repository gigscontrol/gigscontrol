"use client";

import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Dashboard from "@/components/Dashboard";
import ControlePagamentos from "@/components/ControlePagamentos";
import VendasDashboard from "@/components/VendasDashboard";
import AgendaDashboard from "@/components/AgendaDashboard";
import AgendaEscala from "@/components/AgendaEscala";
import Contatos from "@/components/Contatos";
import ContatosDashboard from "@/components/ContatosDashboard";
import NovoOrcamento from "@/components/NovoOrcamento";
import HistoricoOrcamentos from "@/components/HistoricoOrcamentos";
import OrcamentoDetalhe from "@/components/OrcamentoDetalhe";
import ConcretizarVenda from "@/components/ConcretizarVenda";
import HistoricoVendas from "@/components/HistoricoVendas";
import VendaDetalhe from "@/components/VendaDetalhe";
import ShowDetalheModal from "@/components/ShowDetalheModal";
import SomenteLeitura from "@/components/SomenteLeitura";
import { NavProvider, NavOverlay, useNavegacao } from "@/components/NavOverlay";
import { ContatosProvider } from "@/lib/contatos-context";
import { ShowsProvider } from "@/lib/shows-context";
import { OrcamentosProvider } from "@/lib/orcamentos-context";
import { VendasProvider } from "@/lib/vendas-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { WorkspaceProvider, useArtistas, useWorkspace } from "@/lib/workspace-context";
import Configuracoes from "@/components/configuracoes/Configuracoes";
import AbaArtistas from "@/components/configuracoes/AbaArtistas";
import AbaEquipe from "@/components/configuracoes/AbaEquipe";
import EmConstrucao from "@/components/EmConstrucao";
import { MODULE_THEMES } from "@/types";
import type { ActiveTab, ActivePage, ContatoCategoria } from "@/types";

/**
 * Layout do app logado.
 *
 * Os providers + o AuthGuard + o AppRoot vivem AQUI (no layout), não na
 * page. O Next preserva o layout entre navegações do mesmo segmento, então
 * tudo isso monta UMA vez: o AuthGuard não re-dispara o loader a cada troca
 * de tela (fim da "tela preta carregando"), os contexts não refazem fetch,
 * e o estado de UI (filtro de DJs, sidebar) persiste. A page do catch-all
 * fica vazia — o AppRoot deriva a tela ativa da URL via usePathname.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <ContatosProvider>
          <ShowsProvider>
            <OrcamentosProvider>
              <VendasProvider>
                <AuthGuard>
                  <NavProvider>
                    <AppRoot />
                    {children}
                  </NavProvider>
                </AuthGuard>
              </VendasProvider>
            </OrcamentosProvider>
          </ShowsProvider>
        </ContatosProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}

/**
 * Loader de tela cheia, on-brand. Aparece só no cold load (primeiro
 * carregamento) e na transição de redirecionamento — nunca na navegação
 * entre telas (o layout não remonta).
 */
function LoaderTelaCheia({ texto }: { texto: string }) {
  const { aparencia } = useWorkspace();
  return (
    <div className="flex h-screen w-full items-center justify-center bg-main">
      <div className="flex flex-col items-center gap-5">
        {aparencia.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={aparencia.logoUrl}
            alt={aparencia.nomeAgencia}
            className="loader-breathe h-11 w-auto max-w-[180px] object-contain"
          />
        )}
        <div className="spinner spinner-lg" style={{ color: "var(--brand)" }} />
        <span className="loader-breathe text-sm font-medium text-secondary">{texto}</span>
      </div>
    </div>
  );
}

/**
 * Protege a dashboard — sem sessão, manda para /login.
 *
 * Também verifica o status do onboarding pra admins novos: se a
 * subscription ainda está em "trial" → /pagamento; se já pagou mas
 * não terminou o checklist → /onboarding. Quem já está rodando o
 * app normal (Bruno) tem `onboarding_completo=true` no backfill da
 * migração 25 e passa direto.
 */
function AuthGuard({ children }: { children: ReactNode }) {
  const { sessao, carregando, isSuperAdmin, modoVisitante } = useAuth();
  const router = useRouter();
  const [verificandoOnboarding, setVerificandoOnboarding] = useState(true);

  useEffect(() => {
    if (carregando) return;
    if (!sessao) {
      router.replace("/login");
      return;
    }
    // Super-admin só acessa /app em modo visitante (visualizando um cliente)
    if (isSuperAdmin && !modoVisitante) {
      router.replace("/admin");
      return;
    }
    // Verifica onboarding só pra admin não-visitante
    if (modoVisitante || sessao.usuario.papel !== "admin") {
      setVerificandoOnboarding(false);
      return;
    }
    let ativo = true;
    fetch("/api/workspace/onboarding", { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
      })
      .then((d: { subscriptionStatus?: string; onboardingCompleto?: boolean }) => {
        if (!ativo) return;
        // Onboarding incompleto → manda pro wizard. O wizard cuida de
        // ativar o trial na etapa 2 — não precisa mais bloquear em
        // /pagamento (cobrança real só vai ser pedida quando o trial
        // expirar de fato).
        if (!d.onboardingCompleto) {
          router.replace("/onboarding");
        } else {
          setVerificandoOnboarding(false);
        }
      })
      .catch(() => {
        // Em caso de falha, deixa entrar pra não bloquear pelo erro
        if (ativo) setVerificandoOnboarding(false);
      });
    return () => {
      ativo = false;
    };
  }, [carregando, sessao, isSuperAdmin, modoVisitante, router]);

  if (carregando || verificandoOnboarding) {
    return <LoaderTelaCheia texto="Preparando seu painel" />;
  }

  if (!sessao || (isSuperAdmin && !modoVisitante)) {
    return <LoaderTelaCheia texto="Redirecionando…" />;
  }

  return <>{children}</>;
}

// ----------------- Roteamento por URL -----------------
//
// O app inteiro vive sob o catch-all /app/[[...slug]]. A aba/tela ativa
// é DERIVADA da URL (não mais de useState), então o botão "voltar" do
// navegador anda entre as telas internas e o refresh mantém a tela.

const BASE = "/app";

/** "/app/vendas/orcamentos/123" -> ["vendas","orcamentos","123"] */
function segmentosDoPath(pathname: string): string[] {
  return pathname
    .replace(/^\/app\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
}

type Rota = {
  activeTab: ActiveTab;
  activePage: ActivePage;
  configAberta: boolean;
  orcamentoId: string | null;
  vendaId: string | null;
};

function rotaBase(activeTab: ActiveTab, activePage: ActivePage): Rota {
  return { activeTab, activePage, configAberta: false, orcamentoId: null, vendaId: null };
}

/** Mapeia os segmentos da URL para aba / tela / ids. */
function resolverRota(seg: string[]): Rota {
  const [a, b, c] = seg;

  if (a === "configuracoes") {
    return { ...rotaBase("agenda", "dashboard"), configAberta: true };
  }
  if (a === "vendas") {
    if (b === "orcamentos") {
      if (!c) return rotaBase("vendas", "vendas-historico");
      if (c === "novo") return rotaBase("vendas", "vendas-novo-orcamento");
      return { ...rotaBase("vendas", "vendas-orcamento-detalhe"), orcamentoId: c };
    }
    if (b === "vendas") {
      if (!c) return rotaBase("vendas", "vendas-historico-vendas");
      if (c === "nova") return rotaBase("vendas", "vendas-nova-venda");
      return { ...rotaBase("vendas", "vendas-venda-detalhe"), vendaId: c };
    }
    return rotaBase("vendas", "dashboard");
  }
  if (a === "financeiro") {
    if (b === "pagamentos") return rotaBase("financeiro", "financeiro-pagamentos");
    return rotaBase("financeiro", "dashboard");
  }
  if (a === "contratos") {
    if (b === "novo") return rotaBase("contratos", "contratos-novo");
    if (b === "modelos") return rotaBase("contratos", "contratos-modelos");
    if (b === "historico") return rotaBase("contratos", "contratos-historico");
    return rotaBase("contratos", "dashboard");
  }
  if (a === "contatos") {
    if (b === "lista") return rotaBase("contatos", "contatos-lista");
    return rotaBase("contatos", "dashboard");
  }
  if (a === "agencia") {
    if (b === "artistas") return rotaBase("agencia", "agencia-artistas");
    if (b === "equipe") return rotaBase("agencia", "agencia-equipe");
    return rotaBase("agencia", "dashboard");
  }
  // agenda é o default (inclui "/app" puro)
  if (a === "agenda" && b === "shows") return rotaBase("agenda", "agenda-completa");
  return rotaBase("agenda", "dashboard");
}

/** Constrói a URL de uma aba/tela (+ id opcional pros detalhes). */
function urlDaTela(tab: ActiveTab, page: ActivePage, id?: string): string {
  switch (page) {
    case "agenda-completa":
      return `${BASE}/agenda/shows`;
    case "vendas-historico":
      return `${BASE}/vendas/orcamentos`;
    case "vendas-novo-orcamento":
      return `${BASE}/vendas/orcamentos/novo`;
    case "vendas-orcamento-detalhe":
      return `${BASE}/vendas/orcamentos/${id ?? ""}`;
    case "vendas-historico-vendas":
      return `${BASE}/vendas/vendas`;
    case "vendas-nova-venda":
      return `${BASE}/vendas/vendas/nova`;
    case "vendas-venda-detalhe":
      return `${BASE}/vendas/vendas/${id ?? ""}`;
    case "financeiro-pagamentos":
      return `${BASE}/financeiro/pagamentos`;
    case "contratos-novo":
      return `${BASE}/contratos/novo`;
    case "contratos-modelos":
      return `${BASE}/contratos/modelos`;
    case "contratos-historico":
      return `${BASE}/contratos/historico`;
    case "contatos-lista":
      return `${BASE}/contatos/lista`;
    case "agencia-artistas":
      return `${BASE}/agencia/artistas`;
    case "agencia-equipe":
      return `${BASE}/agencia/equipe`;
    case "dashboard":
    default:
      return `${BASE}/${tab}`;
  }
}

function AppRoot() {
  const pathname = usePathname();
  const { navegar: irPara } = useNavegacao();
  // Aba/tela/ids derivados da URL — fonte única da navegação.
  const { activeTab, activePage, configAberta, orcamentoId, vendaId } = useMemo(
    () => resolverRota(segmentosDoPath(pathname)),
    [pathname]
  );

  // Filtro de DJs visíveis na sidebar. Inicializa vazio — o efeito
  // abaixo sincroniza com a lista real de artistas do workspace assim
  // que ela carrega. (Estado de UI — preservado entre navegações porque
  // este componente vive no layout, que o Next não remonta.)
  const [selectedDJs, setSelectedDJs] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sincronização com a lista real de artistas:
  //  - 1º carregamento: todos os artistas vêm pré-selecionados
  //  - Novo artista criado → adicionado à seleção automaticamente
  //  - Artista removido → tirado da seleção
  //  - Artista que o admin deselecionou manualmente continua deselecionado
  // O ref guarda a lista anterior pra detectar diffs.
  const artistasReal = useArtistas();
  const artistasIdsPrevRef = useRef<Set<string>>(new Set());
  const jaInicializouRef = useRef(false);

  useEffect(() => {
    const idsAtuais = new Set(artistasReal.map((a) => a.id));

    // Espera o primeiro carregamento real (lista não-vazia OU já
    // sabemos que tá vazio mesmo). O workspace-context retorna `[]`
    // tanto durante o load quanto quando o workspace genuinamente não
    // tem artistas — pra distinguir, usamos a flag `jaInicializou`.
    if (!jaInicializouRef.current) {
      // No mount, espera 1 ciclo pra dar tempo do fetch — mas se já
      // tem artistas, inicializa imediatamente.
      if (idsAtuais.size > 0) {
        setSelectedDJs(Array.from(idsAtuais));
        artistasIdsPrevRef.current = idsAtuais;
        jaInicializouRef.current = true;
      }
      return;
    }

    // Diffs depois do primeiro load
    const novos = [...idsAtuais].filter((id) => !artistasIdsPrevRef.current.has(id));
    const removidos = [...artistasIdsPrevRef.current].filter((id) => !idsAtuais.has(id));
    if (novos.length > 0 || removidos.length > 0) {
      setSelectedDJs((prev) => {
        const semRemovidos = prev.filter((id) => !removidos.includes(id));
        return Array.from(new Set([...semRemovidos, ...novos]));
      });
    }
    artistasIdsPrevRef.current = idsAtuais;
  }, [artistasReal]);

  // Orçamento de origem ao concretizar uma venda (não vai pra URL —
  // é preenchido só no fluxo "transformar em venda").
  const [orcamentoSendoTransformado, setOrcamentoSendoTransformado] = useState<string | null>(null);
  // Categoria inicial ao abrir a lista de Contatos
  const [contatoCategoria, setContatoCategoria] = useState<ContatoCategoria>("contratantes");
  // Show aberto no modal (a partir de qualquer tela)
  const [showModalId, setShowModalId] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  // ---- Navegação: usa o irPara() (não-bloqueante) do NavProvider ----

  const handleTabChange = (tab: ActiveTab) => {
    setSidebarOpen(false);
    setOrcamentoSendoTransformado(null);
    irPara(urlDaTela(tab, "dashboard"));
  };

  const handlePageChange = (page: ActivePage) => {
    setSidebarOpen(false);
    if (page !== "vendas-nova-venda") setOrcamentoSendoTransformado(null);
    irPara(urlDaTela(activeTab, page));
  };

  /** Navegação genérica usada pelos dashboards (cards e botões clicáveis) */
  const navegar = (tab: ActiveTab, page: ActivePage) => {
    setSidebarOpen(false);
    if (page !== "vendas-nova-venda") setOrcamentoSendoTransformado(null);
    irPara(urlDaTela(tab, page));
  };

  const abrirOrcamento = (id: string) => {
    irPara(urlDaTela("vendas", "vendas-orcamento-detalhe", id));
  };

  const abrirVenda = (id: string) => {
    irPara(urlDaTela("vendas", "vendas-venda-detalhe", id));
  };

  const transformarOrcamentoEmVenda = (id: string) => {
    setOrcamentoSendoTransformado(id);
    irPara(urlDaTela("vendas", "vendas-nova-venda"));
  };

  const abrirContatos = (cat: ContatoCategoria) => {
    setContatoCategoria(cat);
    irPara(urlDaTela("contatos", "contatos-lista"));
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-main">
      {/* Faixa — super-admin visualizando a dashboard de um cliente */}
      <VisitanteBanner />
      <div className="flex flex-1 overflow-hidden">
      {sidebarOpen && (
        <button
          aria-label="Fechar menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden animate-fade"
        />
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        activePage={activePage}
        setActivePage={handlePageChange}
        selectedDJs={selectedDJs}
        setSelectedDJs={setSelectedDJs}
        isOpenMobile={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        configAberta={configAberta}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          onOpenSidebar={() => setSidebarOpen(true)}
          activeTab={activeTab}
          onAbrirConfiguracoes={() => irPara(`${BASE}/configuracoes`)}
        />

        {configAberta ? (
          <main className="relative flex-1 overflow-y-auto animate-in">
            <NavOverlay />
            <Configuracoes onSair={() => irPara(`${BASE}/agenda`)} />
          </main>
        ) : (
        <main
          key={pathname}
          className="relative flex-1 overflow-y-auto animate-in"
        >
          <NavOverlay />
          <SomenteLeitura>
          {/* Financeiro */}
          {activeTab === "financeiro" && activePage === "dashboard" && (
            <Dashboard
              selectedDJs={selectedDJs}
              onNavigate={navegar}
              onAbrirVenda={abrirVenda}
            />
          )}
          {activeTab === "financeiro" && activePage === "financeiro-pagamentos" && (
            <ControlePagamentos />
          )}

          {/* Vendas */}
          {activeTab === "vendas" && activePage === "dashboard" && (
            <VendasDashboard
              selectedDJs={selectedDJs}
              onNavigate={navegar}
              onAbrirOrcamento={abrirOrcamento}
              onAbrirVenda={abrirVenda}
            />
          )}
          {activeTab === "vendas" && activePage === "vendas-novo-orcamento" && (
            <NovoOrcamento
              onSaved={() => {}}
              onCancel={() => handlePageChange("dashboard")}
              onDone={() => handlePageChange("vendas-historico")}
            />
          )}
          {activeTab === "vendas" && activePage === "vendas-historico" && (
            <HistoricoOrcamentos
              onNovo={() => handlePageChange("vendas-novo-orcamento")}
              onAbrir={abrirOrcamento}
              onTransformarEmVenda={transformarOrcamentoEmVenda}
            />
          )}
          {activeTab === "vendas" &&
            activePage === "vendas-orcamento-detalhe" &&
            orcamentoId !== null && (
              <OrcamentoDetalhe
                orcamentoId={orcamentoId}
                onBack={() => handlePageChange("vendas-historico")}
                onTransformarEmVenda={transformarOrcamentoEmVenda}
                onAbrir={abrirOrcamento}
              />
            )}
          {activeTab === "vendas" && activePage === "vendas-nova-venda" && (
            <ConcretizarVenda
              orcamentoId={orcamentoSendoTransformado ?? undefined}
              onSaved={(vendaId) => abrirVenda(vendaId)}
              onCancel={() =>
                handlePageChange(
                  orcamentoSendoTransformado !== null
                    ? "vendas-historico"
                    : "vendas-historico-vendas"
                )
              }
            />
          )}
          {activeTab === "vendas" && activePage === "vendas-historico-vendas" && (
            <HistoricoVendas
              onNovaVenda={() => {
                setOrcamentoSendoTransformado(null);
                handlePageChange("vendas-nova-venda");
              }}
              onAbrir={abrirVenda}
            />
          )}
          {activeTab === "vendas" &&
            activePage === "vendas-venda-detalhe" &&
            vendaId !== null && (
              <VendaDetalhe
                vendaId={vendaId}
                onBack={() => handlePageChange("vendas-historico-vendas")}
              />
            )}

          {/* Agenda */}
          {activeTab === "agenda" && activePage === "dashboard" && (
            <AgendaDashboard
              selectedDJs={selectedDJs}
              onNavigate={navegar}
              onAbrirShow={(id) => setShowModalId(id)}
            />
          )}
          {activeTab === "agenda" && activePage === "agenda-completa" && (
            <AgendaEscala
              selectedDJs={selectedDJs}
              onAbrirOrcamento={abrirOrcamento}
              onAbrirVenda={abrirVenda}
            />
          )}

          {/* Contatos */}
          {activeTab === "contatos" && activePage === "dashboard" && (
            <ContatosDashboard onAbrirCategoria={abrirContatos} />
          )}
          {activeTab === "contatos" && activePage === "contatos-lista" && (
            <Contatos categoriaInicial={contatoCategoria} selectedDJs={selectedDJs} />
          )}

          {/* Contratos */}
          {activeTab === "contratos" && activePage === "dashboard" && (
            <EmConstrucao titulo="Contratos" subtitulo="Dashboard" cor={MODULE_THEMES.contratos.color} />
          )}
          {activeTab === "contratos" && activePage === "contratos-novo" && (
            <EmConstrucao titulo="Novo Contrato" cor={MODULE_THEMES.contratos.color} />
          )}
          {activeTab === "contratos" && activePage === "contratos-modelos" && (
            <EmConstrucao titulo="Modelos de Contrato" cor={MODULE_THEMES.contratos.color} />
          )}
          {activeTab === "contratos" && activePage === "contratos-historico" && (
            <EmConstrucao titulo="Histórico de Contratos" cor={MODULE_THEMES.contratos.color} />
          )}

          {/* Agência */}
          {activeTab === "agencia" && activePage === "dashboard" && (
            <EmConstrucao titulo="Agência" subtitulo="Dashboard" cor={MODULE_THEMES.agencia.color} />
          )}
          {activeTab === "agencia" && activePage === "agencia-artistas" && (
            <div className="p-6 lg:p-8 max-w-[1100px] mx-auto w-full">
              <AbaArtistas />
            </div>
          )}
          {activeTab === "agencia" && activePage === "agencia-equipe" && (
            <div className="p-6 lg:p-8 max-w-[1100px] mx-auto w-full">
              <AbaEquipe />
            </div>
          )}
          </SomenteLeitura>
        </main>
        )}
      </div>

      {/* Modal de show — acessível a partir do dashboard da Agenda */}
      <ShowDetalheModal
        showId={showModalId}
        onClose={() => setShowModalId(null)}
        onAbrirOrcamento={abrirOrcamento}
        onAbrirVenda={abrirVenda}
      />
      </div>
    </div>
  );
}

/** Faixa fixa no topo quando o super-admin está visualizando um cliente */
function VisitanteBanner() {
  const { modoVisitante, sessao, sairDoModoVisitante } = useAuth();
  const router = useRouter();
  if (!modoVisitante) return null;
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 lg:px-6 py-2 text-xs flex-shrink-0"
      style={{ backgroundColor: "var(--module-vendas)", color: "#fff" }}
    >
      <span className="font-medium truncate inline-flex items-center gap-1.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
        Modo visualização — você está vendo o painel de{" "}
        <strong>{sessao?.workspace?.nome ?? "um cliente"}</strong>. Nenhuma
        alteração será salva.
      </span>
      <button
        onClick={() => {
          sairDoModoVisitante();
          router.push("/admin");
        }}
        className="font-semibold underline whitespace-nowrap hover:opacity-80 flex-shrink-0"
      >
        Sair da visualização
      </button>
    </div>
  );
}
