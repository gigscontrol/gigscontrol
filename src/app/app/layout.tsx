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
import AnotacoesPage from "@/components/anotacoes/AnotacoesPage";
import Contatos from "@/components/Contatos";
import ContatosDashboard from "@/components/ContatosDashboard";
import MapaPage from "@/components/contatos/MapaPage";
import NovoOrcamento from "@/components/NovoOrcamento";
import HistoricoOrcamentos from "@/components/HistoricoOrcamentos";
import OrcamentoDetalhe from "@/components/OrcamentoDetalhe";
import ConcretizarVenda from "@/components/ConcretizarVenda";
import HistoricoVendas from "@/components/HistoricoVendas";
import VendaDetalhe from "@/components/VendaDetalhe";
import ShowDetalheModal from "@/components/ShowDetalheModal";
import SomenteLeitura from "@/components/SomenteLeitura";
import BannerPagamento from "@/components/BannerPagamento";
import BloqueioModal from "@/components/BloqueioModal";
import PreferenciasApply from "@/components/PreferenciasApply";
import { NavProvider, NavOverlay, useNavegacao } from "@/components/NavOverlay";
import { ContatosProvider } from "@/lib/contatos-context";
import { ShowsProvider } from "@/lib/shows-context";
import { AgendaItemsProvider } from "@/lib/agenda-items-context";
import { OrcamentosProvider } from "@/lib/orcamentos-context";
import { VendasProvider, useVendas } from "@/lib/vendas-context";
import { ModelosProvider } from "@/lib/modelos-context";
import { ContratosProvider } from "@/lib/contratos-context";
import { AnotacoesProvider } from "@/lib/anotacoes-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";
import { WorkspaceProvider, useArtistas, useWorkspace } from "@/lib/workspace-context";
import Configuracoes from "@/components/configuracoes/Configuracoes";
import AbaArtistas from "@/components/configuracoes/AbaArtistas";
import AbaEquipe from "@/components/configuracoes/AbaEquipe";
import ModelosPage from "@/components/contratos/ModelosPage";
import NovoContratoPage from "@/components/contratos/NovoContratoPage";
import HistoricoPage from "@/components/contratos/HistoricoPage";
import MeusContratosPage from "@/components/contratos/MeusContratosPage";
import DashboardContratos from "@/components/contratos/DashboardContratos";
import AgenciaDashboard from "@/components/agencia/AgenciaDashboard";
import { MODULE_THEMES } from "@/types";
import type { ActiveTab, ActivePage, ContatoCategoria } from "@/types";
import type { ContratoStatus } from "@/lib/mappers/contrato";

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
            <AgendaItemsProvider>
              <OrcamentosProvider>
                <VendasProvider>
                  <ModelosProvider>
                    <ContratosProvider>
                      <AnotacoesProvider>
                        <AuthGuard>
                          <NavProvider>
                            <PreferenciasApply />
                            <AppRoot />
                            {children}
                          </NavProvider>
                        </AuthGuard>
                      </AnotacoesProvider>
                    </ContratosProvider>
                  </ModelosProvider>
                </VendasProvider>
              </OrcamentosProvider>
            </AgendaItemsProvider>
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
  const [acesso, setAcesso] = useState<{
    estado: "ok" | "graca" | "bloqueado";
    adminContato: string | null;
    plano: { id: string; nome: string } | null;
    ciclo: string;
  } | null>(null);

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
    // Modo visitante (super-admin vendo cliente) não checa pagamento.
    if (modoVisitante) {
      setVerificandoOnboarding(false);
      return;
    }
    // TODO usuário busca o estado de acesso (graça/bloqueio); admin também
    // confere o onboarding.
    let ativo = true;
    fetch("/api/workspace/onboarding", { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
      })
      .then(
        (d: {
          onboardingCompleto?: boolean;
          estadoAcesso?: "ok" | "graca" | "bloqueado";
          adminContato?: string | null;
          plano?: { id: string; nome: string } | null;
          ciclo?: string;
        }) => {
          if (!ativo) return;
          // Admin com onboarding incompleto → wizard (cobrança real só no
          // fim do trial; o wizard ativa o trial na etapa 2).
          if (sessao.usuario.papel === "admin" && d.onboardingCompleto === false) {
            router.replace("/onboarding");
            return;
          }
          setAcesso({
            estado: d.estadoAcesso ?? "ok",
            adminContato: d.adminContato ?? null,
            plano: d.plano ?? null,
            ciclo: d.ciclo ?? "mensal",
          });
          setVerificandoOnboarding(false);
        }
      )
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

  const papel = sessao.usuario.papel;

  // BLOQUEIO DO WORKSPACE (cascata da cobrança): quando o admin não pagou/venceu,
  // o estado vem "bloqueado" pra TODOS os papéis. Não renderiza o app por baixo —
  // só o modal, que trava a tela pra qualquer usuário (admin vê o caminho de
  // pagar; artista/equipe veem o aviso pra falar com o administrador). O gate
  // server-side (`exigirAcesso`) barra as mutações em paralelo (402).
  if (acesso?.estado === "bloqueado") {
    return (
      <BloqueioModal
        papel={papel}
        adminContato={acesso.adminContato}
        plano={acesso.plano}
        ciclo={acesso.ciclo}
      />
    );
  }

  return (
    <>
      {acesso?.estado === "graca" && (
        <BannerPagamento
          papel={papel}
          adminContato={acesso.adminContato}
          plano={acesso.plano}
          ciclo={acesso.ciclo}
        />
      )}
      {children}
    </>
  );
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
      if (seg[3] === "editar")
        return { ...rotaBase("vendas", "vendas-editar-venda"), vendaId: c };
      return { ...rotaBase("vendas", "vendas-venda-detalhe"), vendaId: c };
    }
    return rotaBase("vendas", "dashboard");
  }
  if (a === "financeiro") {
    if (b === "pagamentos") return rotaBase("financeiro", "financeiro-pagamentos");
    if (b === "cobrancas") return rotaBase("financeiro", "financeiro-cobrancas");
    return rotaBase("financeiro", "dashboard");
  }
  if (a === "contratos") {
    if (b === "novo") return rotaBase("contratos", "contratos-novo");
    if (b === "modelos") return rotaBase("contratos", "contratos-modelos");
    if (b === "historico") return rotaBase("contratos", "contratos-historico");
    if (b === "pastas") return rotaBase("contratos", "contratos-pastas");
    return rotaBase("contratos", "dashboard");
  }
  if (a === "contatos") {
    if (b === "lista") return rotaBase("contatos", "contatos-lista");
    if (b === "mapa") return rotaBase("contatos", "contatos-mapa");
    return rotaBase("contatos", "dashboard");
  }
  if (a === "agencia") {
    if (b === "artistas") return rotaBase("agencia", "agencia-artistas");
    if (b === "equipe") return rotaBase("agencia", "agencia-equipe");
    return rotaBase("agencia", "dashboard");
  }
  // agenda é o default (inclui "/app" puro)
  if (a === "agenda" && b === "shows") return rotaBase("agenda", "agenda-completa");
  if (a === "agenda" && b === "anotacoes") return rotaBase("agenda", "agenda-anotacoes");
  return rotaBase("agenda", "dashboard");
}

/** Constrói a URL de uma aba/tela (+ id opcional pros detalhes). */
function urlDaTela(tab: ActiveTab, page: ActivePage, id?: string): string {
  switch (page) {
    case "agenda-completa":
      return `${BASE}/agenda/shows`;
    case "agenda-anotacoes":
      return `${BASE}/agenda/anotacoes`;
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
    case "vendas-editar-venda":
      return `${BASE}/vendas/vendas/${id ?? ""}/editar`;
    case "financeiro-pagamentos":
      return `${BASE}/financeiro/pagamentos`;
    case "financeiro-cobrancas":
      return `${BASE}/financeiro/cobrancas`;
    case "contratos-novo":
      return `${BASE}/contratos/novo`;
    case "contratos-modelos":
      return `${BASE}/contratos/modelos`;
    case "contratos-historico":
      return `${BASE}/contratos/historico`;
    case "contratos-pastas":
      return `${BASE}/contratos/pastas`;
    case "contatos-lista":
      return `${BASE}/contatos/lista`;
    case "contatos-mapa":
      return `${BASE}/contatos/mapa`;
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
  const t = useT();
  const pathname = usePathname();
  const { navegar: irPara } = useNavegacao();
  const { sessao, isSuperAdmin } = useAuth();
  // Aba/tela/ids derivados da URL — fonte única da navegação.
  const { activeTab, activePage, configAberta, orcamentoId, vendaId } = useMemo(
    () => resolverRota(segmentosDoPath(pathname)),
    [pathname]
  );

  // Módulo "Agência" (roster de Artistas/Equipe) é admin-only. Defesa em
  // profundidade contra a URL direta (/app/agencia/…): quem não é admin nem
  // super-admin não monta as telas e é mandado de volta pra Agenda. O menu já
  // esconde o módulo (Sidebar) e o servidor barra as mutações (403).
  const podeAgencia = isSuperAdmin || sessao?.usuario?.papel === "admin";
  useEffect(() => {
    if (!configAberta && activeTab === "agencia" && sessao && !podeAgencia) {
      irPara(urlDaTela("agenda", "dashboard"));
    }
  }, [activeTab, configAberta, sessao, podeAgencia, irPara]);

  // Filtro de DJs visíveis na sidebar. Inicializa vazio — o efeito
  // abaixo sincroniza com a lista real de artistas do workspace assim
  // que ela carrega. (Estado de UI — preservado entre navegações porque
  // este componente vive no layout, que o Next não remonta.)
  const [selectedArtistas, setSelectedArtistas] = useState<string[]>([]);
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
        setSelectedArtistas(Array.from(idsAtuais));
        artistasIdsPrevRef.current = idsAtuais;
        jaInicializouRef.current = true;
      }
      return;
    }

    // Diffs depois do primeiro load
    const novos = [...idsAtuais].filter((id) => !artistasIdsPrevRef.current.has(id));
    const removidos = [...artistasIdsPrevRef.current].filter((id) => !idsAtuais.has(id));
    if (novos.length > 0 || removidos.length > 0) {
      setSelectedArtistas((prev) => {
        const semRemovidos = prev.filter((id) => !removidos.includes(id));
        return Array.from(new Set([...semRemovidos, ...novos]));
      });
    }
    artistasIdsPrevRef.current = idsAtuais;
  }, [artistasReal]);

  // Orçamento de origem ao concretizar uma venda (não vai pra URL —
  // é preenchido só no fluxo "transformar em venda").
  const [orcamentoSendoTransformado, setOrcamentoSendoTransformado] = useState<string | null>(null);
  // Data pré-selecionada ao abrir "Nova Venda Direta" pelo "+" de um dia da agenda.
  const [dataShowInicial, setDataShowInicial] = useState<string | null>(null);
  // D5 — a edição salvou sem recalcular as parcelas (alguma tem histórico
  // financeiro). Mora aqui porque o form desmonta ao navegar pro detalhe: o
  // aviso precisa sobreviver e aparecer onde dá pra agir (o detalhe da venda).
  const [avisoParcelasPreservadas, setAvisoParcelasPreservadas] = useState(false);
  // Categoria inicial ao abrir a lista de Contatos
  const [contatoCategoria, setContatoCategoria] = useState<ContatoCategoria>("contratantes");
  // Passados à dashboard de Contratos → Histórico (filtro por status / abrir um contrato).
  const [contratoStatusFiltro, setContratoStatusFiltro] = useState<ContratoStatus | null>(null);
  const [contratoAbrirId, setContratoAbrirId] = useState<string | null>(null);
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
    setDataShowInicial(null);
    setContratoStatusFiltro(null);
    setContratoAbrirId(null);
    irPara(urlDaTela(tab, "dashboard"));
  };

  const handlePageChange = (page: ActivePage) => {
    setSidebarOpen(false);
    if (page !== "vendas-nova-venda") setOrcamentoSendoTransformado(null);
    setDataShowInicial(null);
    setContratoStatusFiltro(null);
    setContratoAbrirId(null);
    irPara(urlDaTela(activeTab, page));
  };

  /** Navegação genérica usada pelos dashboards (cards e botões clicáveis) */
  const navegar = (tab: ActiveTab, page: ActivePage) => {
    setSidebarOpen(false);
    if (page !== "vendas-nova-venda") setOrcamentoSendoTransformado(null);
    setDataShowInicial(null);
    setContratoStatusFiltro(null);
    setContratoAbrirId(null);
    irPara(urlDaTela(tab, page));
  };

  /** Card de status da dashboard de Contratos → Histórico filtrado. */
  const verContratosStatus = (status: ContratoStatus | null) => {
    setContratoAbrirId(null);
    setContratoStatusFiltro(status);
    irPara(urlDaTela("contratos", "contratos-historico"));
  };

  /** Linha de contrato recente → abre o contrato no Histórico. */
  const abrirContrato = (id: string) => {
    setContratoStatusFiltro(null);
    setContratoAbrirId(id);
    irPara(urlDaTela("contratos", "contratos-historico"));
  };

  const abrirOrcamento = (id: string) => {
    irPara(urlDaTela("vendas", "vendas-orcamento-detalhe", id));
  };

  const abrirVenda = (id: string) => {
    // Limpa o aviso da edição anterior: ele é de UMA passagem pelo form, não do
    // detalhe da venda (quem precisa reafirmá-lo re-seta DEPOIS desta chamada).
    setAvisoParcelasPreservadas(false);
    irPara(urlDaTela("vendas", "vendas-venda-detalhe", id));
  };

  /** Lápis do Histórico / botão "Editar venda" → form de criação em modo edição. */
  const editarVenda = (id: string) => {
    irPara(urlDaTela("vendas", "vendas-editar-venda", id));
  };

  const transformarOrcamentoEmVenda = (id: string) => {
    setOrcamentoSendoTransformado(id);
    setDataShowInicial(null);
    irPara(urlDaTela("vendas", "vendas-nova-venda"));
  };

  /** "Novo Show" no "+" de um dia da agenda → Nova Venda Direta com a data pré-selecionada. */
  const novaVendaNoDia = (dataISO: string) => {
    setOrcamentoSendoTransformado(null);
    setDataShowInicial(dataISO);
    irPara(urlDaTela("vendas", "vendas-nova-venda"));
  };

  const abrirContatos = (cat: ContatoCategoria) => {
    setContatoCategoria(cat);
    irPara(urlDaTela("contatos", "contatos-lista"));
  };

  const corModulo = MODULE_THEMES[activeTab]?.color ?? "#3D7BFF";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-main">
      {/* Faixa — super-admin visualizando a dashboard de um cliente */}
      <VisitanteBanner />
      <div className="flex flex-1 overflow-hidden">
      {sidebarOpen && (
        <button
          aria-label={t("Fechar menu")}
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden animate-fade"
        />
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        activePage={activePage}
        setActivePage={handlePageChange}
        selectedArtistas={selectedArtistas}
        setSelectedArtistas={setSelectedArtistas}
        isOpenMobile={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        configAberta={configAberta}
      />

      <div
        className="flex flex-1 flex-col overflow-hidden"
        style={{
          // Glow na ZONA da topbar (cor do módulo), no nível da coluna — atrás do
          // header transparente. Alinhado e contínuo com a "bola" do PageHeader
          // (que vive dentro do main e é cortada): a bola parece subir pra topbar.
          background: `radial-gradient(380px 160px at 145px -10px, ${corModulo}26, transparent 66%)`,
        }}
      >
        <Topbar
          onOpenSidebar={() => setSidebarOpen(true)}
          activeTab={activeTab}
          onAbrirConfiguracoes={() => irPara(`${BASE}/configuracoes`)}
        />

        {configAberta ? (
          <main className="relative flex-1 overflow-y-auto overflow-x-hidden animate-in">
            <NavOverlay />
            <Configuracoes onSair={() => irPara(`${BASE}/agenda`)} />
          </main>
        ) : (
        <main
          key={pathname}
          className="relative flex-1 overflow-y-auto overflow-x-hidden animate-in"
        >
          <NavOverlay />
          <SomenteLeitura>
          {/* Financeiro */}
          {activeTab === "financeiro" && activePage === "dashboard" && (
            <Dashboard
              selectedArtistas={selectedArtistas}
              onNavigate={navegar}
              onAbrirVenda={abrirVenda}
            />
          )}
          {activeTab === "financeiro" && activePage === "financeiro-pagamentos" && (
            <ControlePagamentos />
          )}
          {activeTab === "financeiro" && activePage === "financeiro-cobrancas" && (
            <ControlePagamentos modo="cobrancas" />
          )}

          {/* Vendas */}
          {activeTab === "vendas" && activePage === "dashboard" && (
            <VendasDashboard
              selectedArtistas={selectedArtistas}
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
              selectedArtistas={selectedArtistas}
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
              dataInicial={dataShowInicial ?? undefined}
              onSaved={(vendaId) => {
                setDataShowInicial(null);
                abrirVenda(vendaId);
              }}
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
              selectedArtistas={selectedArtistas}
              onNovaVenda={() => {
                setOrcamentoSendoTransformado(null);
                handlePageChange("vendas-nova-venda");
              }}
              onAbrir={abrirVenda}
              onEditar={editarVenda}
            />
          )}
          {activeTab === "vendas" &&
            activePage === "vendas-venda-detalhe" &&
            vendaId !== null && (
              <VendaDetalhe
                vendaId={vendaId}
                onBack={() => handlePageChange("vendas-historico-vendas")}
                onEditar={editarVenda}
                avisoParcelasPreservadas={avisoParcelasPreservadas}
                onDispensarAvisoParcelas={() => setAvisoParcelasPreservadas(false)}
              />
            )}
          {activeTab === "vendas" &&
            activePage === "vendas-editar-venda" &&
            vendaId !== null && (
              <EditarVendaLoader
                vendaId={vendaId}
                onFechar={(id, resultado) => {
                  // Ordem importa: `abrirVenda` limpa o aviso, então a
                  // reafirmação vem DEPOIS (o último set do batch vence).
                  abrirVenda(id);
                  if (resultado?.parcelasPreservadas) setAvisoParcelasPreservadas(true);
                }}
              />
            )}

          {/* Agenda */}
          {activeTab === "agenda" && activePage === "dashboard" && (
            <AgendaDashboard
              selectedArtistas={selectedArtistas}
              onNavigate={navegar}
              onAbrirShow={(id) => setShowModalId(id)}
            />
          )}
          {activeTab === "agenda" && activePage === "agenda-completa" && (
            <AgendaEscala
              selectedArtistas={selectedArtistas}
              onAbrirOrcamento={abrirOrcamento}
              onAbrirVenda={abrirVenda}
              onNovaVendaNoDia={novaVendaNoDia}
            />
          )}
          {activeTab === "agenda" && activePage === "agenda-anotacoes" && (
            <AnotacoesPage />
          )}

          {/* Contatos */}
          {activeTab === "contatos" && activePage === "dashboard" && (
            <ContatosDashboard onAbrirCategoria={abrirContatos} />
          )}
          {activeTab === "contatos" && activePage === "contatos-lista" && (
            <Contatos
              categoriaInicial={contatoCategoria}
              selectedArtistas={selectedArtistas}
              onAbrirShow={(id) => setShowModalId(id)}
            />
          )}
          {activeTab === "contatos" && activePage === "contatos-mapa" && <MapaPage />}

          {/* Contratos */}
          {activeTab === "contratos" && activePage === "dashboard" && (
            <DashboardContratos
              onNavigate={navegar}
              onVerStatus={verContratosStatus}
              onAbrirContrato={abrirContrato}
            />
          )}
          {activeTab === "contratos" && activePage === "contratos-novo" && (
            <NovoContratoPage />
          )}
          {activeTab === "contratos" && activePage === "contratos-modelos" && (
            <ModelosPage />
          )}
          {activeTab === "contratos" && activePage === "contratos-historico" && (
            <HistoricoPage
              abrirId={contratoAbrirId}
              statusInicial={contratoStatusFiltro}
            />
          )}
          {activeTab === "contratos" && activePage === "contratos-pastas" && (
            <MeusContratosPage onAbrirContrato={abrirContrato} onNavigate={navegar} />
          )}

          {/* Agência — admin-only (podeAgencia); URL direta de não-admin é
              redirecionada pelo useEffect acima e nunca monta estas telas. */}
          {podeAgencia && activeTab === "agencia" && activePage === "dashboard" && (
            <AgenciaDashboard />
          )}
          {podeAgencia && activeTab === "agencia" && activePage === "agencia-artistas" && (
            <div className="p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
              <AbaArtistas />
            </div>
          )}
          {podeAgencia && activeTab === "agencia" && activePage === "agencia-equipe" && (
            <div className="p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
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
        onEditarVenda={editarVenda}
      />
      </div>
    </div>
  );
}

/**
 * Carrega a venda do contexto e monta o form de criação em MODO EDIÇÃO.
 * Fica aqui (e não dentro do ConcretizarVenda) pra manter o form agnóstico de
 * navegação: ele só recebe a venda pronta.
 */
function EditarVendaLoader({
  vendaId,
  onFechar,
}: {
  vendaId: string;
  onFechar: (id: string, resultado?: { parcelasPreservadas?: boolean }) => void;
}) {
  const t = useT();
  const { vendas, carregando } = useVendas();
  const venda = vendas.find((v) => v.id === vendaId);

  if (!venda) {
    if (carregando) {
      return (
        <div className="max-w-[800px] mx-auto w-full p-6 lg:p-8">
          <div className="card text-center py-12">
            <div className="section-subtitle">{t("Carregando...")}</div>
          </div>
        </div>
      );
    }
    return (
      <div className="max-w-[800px] mx-auto w-full p-6 lg:p-8">
        <div className="card text-center py-12">
          <div className="section-title">{t("Venda não encontrada")}</div>
        </div>
      </div>
    );
  }

  // `key` obrigatória: os inicializadores lazy do form só rodam na montagem —
  // trocar de venda sem remontar deixaria os campos da venda anterior.
  return (
    <ConcretizarVenda
      key={venda.id}
      vendaParaEditar={venda}
      onSaved={(_id, resultado) => onFechar(venda.id, resultado)}
      onCancel={() => onFechar(venda.id)}
    />
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
      style={{ backgroundColor: "var(--brand)", color: "#fff" }}
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
