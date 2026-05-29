"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
import { ContatosProvider } from "@/lib/contatos-context";
import { ShowsProvider } from "@/lib/shows-context";
import { OrcamentosProvider } from "@/lib/orcamentos-context";
import { VendasProvider } from "@/lib/vendas-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { WorkspaceProvider, useArtistas } from "@/lib/workspace-context";
import Configuracoes from "@/components/configuracoes/Configuracoes";
import type { ActiveTab, ActivePage, ContatoCategoria } from "@/types";

export default function AppPage() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <ContatosProvider>
          <ShowsProvider>
            <OrcamentosProvider>
              <VendasProvider>
                <AuthGuard>
                  <AppRoot />
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
 * Protege a dashboard — sem sessão, manda para /login.
 *
 * Também verifica o status do onboarding pra admins novos: se a
 * subscription ainda está em "trial" → /pagamento; se já pagou mas
 * não terminou o checklist → /onboarding. Quem já está rodando o
 * app normal (Bruno) tem `onboarding_completo=true` no backfill da
 * migração 25 e passa direto.
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
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
    return (
      <div className="flex h-screen items-center justify-center bg-main">
        <div className="text-sm text-muted">Carregando…</div>
      </div>
    );
  }

  if (!sessao || (isSuperAdmin && !modoVisitante)) {
    return (
      <div className="flex h-screen items-center justify-center bg-main">
        <div className="text-sm text-muted">Redirecionando…</div>
      </div>
    );
  }

  return <>{children}</>;
}

function AppRoot() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("agenda");
  const [activePage, setActivePage] = useState<ActivePage>("dashboard");
  // Filtro de DJs visíveis na sidebar. Inicializa vazio — o efeito
  // abaixo sincroniza com a lista real de artistas do workspace assim
  // que ela carrega.
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

  const [orcamentoSelecionado, setOrcamentoSelecionado] = useState<string | null>(null);
  const [vendaSelecionada, setVendaSelecionada] = useState<string | null>(null);
  const [orcamentoSendoTransformado, setOrcamentoSendoTransformado] = useState<string | null>(null);
  // Categoria inicial ao abrir a lista de Contatos
  const [contatoCategoria, setContatoCategoria] = useState<ContatoCategoria>("contratantes");
  // Show aberto no modal (a partir de qualquer tela)
  const [showModalId, setShowModalId] = useState<string | null>(null);

  // Tela de Configurações (só admin) — quando true, ocupa a área de conteúdo
  const [configAberta, setConfigAberta] = useState(false);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  const handleTabChange = (tab: ActiveTab) => {
    setConfigAberta(false);
    setActiveTab(tab);
    setActivePage("dashboard");
    setSidebarOpen(false);
    setOrcamentoSelecionado(null);
    setVendaSelecionada(null);
    setOrcamentoSendoTransformado(null);
  };

  const handlePageChange = (page: ActivePage) => {
    setConfigAberta(false);
    setActivePage(page);
    setSidebarOpen(false);
    if (page !== "vendas-orcamento-detalhe") setOrcamentoSelecionado(null);
    if (page !== "vendas-venda-detalhe") setVendaSelecionada(null);
    if (page !== "vendas-nova-venda") setOrcamentoSendoTransformado(null);
  };

  /** Navegação genérica usada pelos dashboards (cards e botões clicáveis) */
  const navegar = (tab: ActiveTab, page: ActivePage) => {
    setConfigAberta(false);
    setActiveTab(tab);
    setActivePage(page);
    setSidebarOpen(false);
    if (page !== "vendas-orcamento-detalhe") setOrcamentoSelecionado(null);
    if (page !== "vendas-venda-detalhe") setVendaSelecionada(null);
    if (page !== "vendas-nova-venda") setOrcamentoSendoTransformado(null);
  };

  const abrirOrcamento = (id: string) => {
    setActiveTab("vendas");
    setOrcamentoSelecionado(id);
    setActivePage("vendas-orcamento-detalhe");
  };

  const abrirVenda = (id: string) => {
    setActiveTab("vendas");
    setVendaSelecionada(id);
    setActivePage("vendas-venda-detalhe");
  };

  const transformarOrcamentoEmVenda = (orcamentoId: string) => {
    setActiveTab("vendas");
    setOrcamentoSendoTransformado(orcamentoId);
    setActivePage("vendas-nova-venda");
  };

  const abrirContatos = (cat: ContatoCategoria) => {
    setContatoCategoria(cat);
    setActiveTab("contatos");
    setActivePage("contatos-lista");
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
          onAbrirConfiguracoes={() => setConfigAberta(true)}
        />

        {configAberta ? (
          <main className="flex-1 overflow-y-auto animate-in">
            <Configuracoes onSair={() => setConfigAberta(false)} />
          </main>
        ) : (
        <main
          key={`${activeTab}-${activePage}-${orcamentoSelecionado ?? ""}-${vendaSelecionada ?? ""}-${orcamentoSendoTransformado ?? ""}`}
          className="flex-1 overflow-y-auto animate-in"
        >
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
            orcamentoSelecionado !== null && (
              <OrcamentoDetalhe
                orcamentoId={orcamentoSelecionado}
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
            vendaSelecionada !== null && (
              <VendaDetalhe
                vendaId={vendaSelecionada}
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
