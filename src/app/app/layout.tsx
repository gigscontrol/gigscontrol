"use client";

import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
import ParcelaDetalheModal from "@/components/ParcelaDetalheModal";
import SomenteLeitura from "@/components/SomenteLeitura";
import BannerPagamento from "@/components/BannerPagamento";
import BloqueioModal from "@/components/BloqueioModal";
import PreferenciasApply from "@/components/PreferenciasApply";
import { NavProvider, NavOverlay, useNavegacao } from "@/components/NavOverlay";
import { ContatosProvider, useContatos } from "@/lib/contatos-context";
import { ShowsProvider } from "@/lib/shows-context";
import { AgendaItemsProvider } from "@/lib/agenda-items-context";
import { OrcamentosProvider, useOrcamentos } from "@/lib/orcamentos-context";
import { VendasProvider, useVendas } from "@/lib/vendas-context";
import { ModelosProvider } from "@/lib/modelos-context";
import { ContratosProvider, useContratos } from "@/lib/contratos-context";
import { AnotacoesProvider } from "@/lib/anotacoes-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ctxDaSessao } from "@/lib/permissoes/resolver";
import { podeVerModulo } from "@/lib/permissoes/modulos";
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
import type { ActiveTab, ActivePage } from "@/types";
import type { ContratoStatus } from "@/lib/mappers/contrato";
import {
  resolverRota,
  segmentosDoPath,
  urlDaTela,
  urls,
  migalhasDaRota,
} from "@/lib/navegacao/rotas";

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
      // Link do painel aberto sem sessão (notificação, link compartilhado):
      // depois do login a pessoa cai no MESMO item. O login só aceita
      // caminho interno no ?next= (anti open-redirect).
      const aqui = `${window.location.pathname}${window.location.search}`;
      router.replace(
        aqui.startsWith("/app/") ? `/login?next=${encodeURIComponent(aqui)}` : "/login"
      );
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
// O app inteiro vive sob o catch-all /app/[[...slug]]. A tela ativa, o item
// aberto e os modais com endereço (?show= / ?parcela=) são DERIVADOS da URL
// (lib/navegacao/rotas.ts) — F5, voltar do navegador e link compartilhado
// caem sempre no mesmo lugar. Nada de "onde estou" guardado só em memória.

const STATUS_CONTRATO: ContratoStatus[] = ["rascunho", "enviado", "assinado", "cancelado"];

function AppRoot() {
  const t = useT();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    navegar: irPara,
    voltar,
    voltarPara,
    abrirSobreposicao,
    fecharSobreposicao,
  } = useNavegacao();
  const { sessao, isSuperAdmin } = useAuth();
  // Aba/tela/ids derivados da URL — fonte única da navegação.
  const rota = useMemo(() => resolverRota(segmentosDoPath(pathname)), [pathname]);
  const {
    activeTab,
    activePage,
    configAberta,
    orcamentoId,
    vendaId,
    contratoId,
    contatoAba,
    contatoId,
  } = rota;

  // Contexto que vem na QUERY (sobrevive a F5 / link):
  const showAberto = searchParams.get("show");
  const parcelaAberta = searchParams.get("parcela");
  const orcamentoOrigem = activePage === "vendas-nova-venda" ? searchParams.get("orcamento") : null;
  const dataNovaVenda = activePage === "vendas-nova-venda" ? searchParams.get("data") : null;
  const vendaParaContrato = activePage === "contratos-novo" ? searchParams.get("venda") : null;
  const statusParam = searchParams.get("status");
  const statusContratos = (STATUS_CONTRATO as string[]).includes(statusParam ?? "")
    ? (statusParam as ContratoStatus)
    : null;
  const buscaCobrancas = activePage === "financeiro-cobrancas" ? searchParams.get("busca") : null;

  // Defesa em profundidade contra a URL DIRETA (link antigo, bookmark, histórico
  // do navegador, aba aberta antes do deploy). A Sidebar esconde o módulo, mas
  // a rota continuava montável: o usuário caía numa tela cujos fetches tomam
  // 403 e, sem o item no menu, sem nada que explicasse onde ele está. Vale pra
  // TODO módulo, não só "agencia" — mesma regra (`podeVerModulo`) do menu.
  const podeAgencia = isSuperAdmin || sessao?.usuario?.papel === "admin";
  const ctxModulos = useMemo(
    () =>
      sessao
        ? ctxDaSessao({
            isSuperAdmin,
            papel: sessao.usuario.papel,
            artistaId:
              (sessao.usuario.artistaId as unknown as string | undefined) ?? null,
            privacidade: sessao.privacidade,
            vinculos: sessao.vinculos,
            podeCriarAnotacoes: sessao.podeCriarAnotacoes,
            temPastaCompartilhada: sessao.temPastaCompartilhada,
          })
        : null,
    [sessao, isSuperAdmin]
  );
  useEffect(() => {
    if (configAberta || !sessao || !ctxModulos) return;
    // Vínculos que falharam ao carregar = UI falha ABERTO (o servidor barra).
    if (sessao.vinculosErro) {
      if (activeTab === "agencia" && !podeAgencia) irPara(urls.modulo("agenda"), { substituir: true });
      return;
    }
    if (podeVerModulo(ctxModulos, activeTab)) return;
    // Manda pro primeiro módulo ALCANÇÁVEL — mandar pra agenda cegamente
    // criaria um loop de redirect pra quem não alcança nem a agenda.
    const destino = (["agenda", "vendas", "financeiro", "contratos", "contatos", "agencia"] as ActiveTab[]).find(
      (t) => podeVerModulo(ctxModulos, t)
    );
    if (destino && destino !== activeTab) irPara(urls.modulo(destino), { substituir: true });
  }, [activeTab, configAberta, sessao, ctxModulos, podeAgencia, irPara]);

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

  // D5 — a edição salvou sem recalcular as parcelas (alguma tem histórico
  // financeiro). Mora aqui porque o form desmonta ao navegar pro detalhe: o
  // aviso precisa sobreviver e aparecer onde dá pra agir (o detalhe da venda).
  // É um aviso de UMA passagem (não é "onde estou"), por isso fica em memória.
  const [avisoParcelasPreservadas, setAvisoParcelasPreservadas] = useState(false);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  // ---- Navegação ----

  /** Menu / dashboards: vai pra uma tela (sem item). */
  const irParaTela = (tab: ActiveTab, page: ActivePage) => {
    setSidebarOpen(false);
    irPara(page === "dashboard" ? urls.modulo(tab) : urlDaTela(tab, page));
  };
  const irParaHref = (href: string) => {
    setSidebarOpen(false);
    irPara(href);
  };

  const abrirOrcamento = (id: string) => irPara(urls.orcamento(id));
  const abrirVenda = (id: string) => {
    // Limpa o aviso da edição anterior: ele é de UMA passagem pelo form, não do
    // detalhe da venda (quem precisa reafirmá-lo re-seta DEPOIS desta chamada).
    setAvisoParcelasPreservadas(false);
    irPara(urls.venda(id));
  };
  const editarVenda = (id: string) => irPara(urls.editarVenda(id));
  const transformarOrcamentoEmVenda = (id: string) => irPara(urls.novaVenda({ orcamento: id }));
  const novaVendaNoDia = (dataISO: string) => irPara(urls.novaVenda({ data: dataISO }));
  const abrirContrato = (id: string) => irPara(urls.contrato(id));
  const abrirShow = (id: string) => abrirSobreposicao("show", id);

  // ---- Caminho no topo ----
  const { vendas } = useVendas();
  const { orcamentos } = useOrcamentos();
  const { contratos } = useContratos();
  const { contratantes, casas, cidades } = useContatos();
  const abaConfig = configAberta ? searchParams.get("aba") ?? "perfil" : null;
  const ehAdminSessao = isSuperAdmin || sessao?.usuario?.papel === "admin";
  const migalhas = useMemo(() => {
    const nomeContato = (() => {
      if (!contatoId) return null;
      if (contatoAba === "contratantes") return contratantes.find((c) => c.id === contatoId)?.nome ?? null;
      if (contatoAba === "casas") return casas.find((c) => c.id === contatoId)?.nome ?? null;
      if (contatoAba === "cidades") return cidades.find((c) => c.id === contatoId)?.nome ?? null;
      return null;
    })();
    return migalhasDaRota(rota, {
      nomes: {
        orcamento: orcamentoId ? orcamentos.find((o) => o.id === orcamentoId)?.numero : null,
        venda: vendaId ? vendas.find((v) => v.id === vendaId)?.numero : null,
        contrato: contratoId ? contratos.find((c) => c.id === contratoId)?.numero : null,
        contato: nomeContato,
        orcamentoOrigem: orcamentoOrigem
          ? orcamentos.find((o) => o.id === orcamentoOrigem)?.numero ?? null
          : null,
      },
      abaConfig,
      ehAdmin: ehAdminSessao,
    });
  }, [
    rota,
    orcamentoId,
    vendaId,
    contratoId,
    contatoId,
    contatoAba,
    orcamentoOrigem,
    abaConfig,
    ehAdminSessao,
    orcamentos,
    vendas,
    contratos,
    contratantes,
    casas,
    cidades,
  ]);

  // Parcela aberta no modal global: a venda dona é achada pela própria parcela.
  const vendaDaParcela = parcelaAberta
    ? vendas.find((v) => v.parcelas.some((p) => p.id === parcelaAberta))?.id ?? null
    : null;

  // Lista + ficha do MESMO componente (contratos, contatos) dividem a chave:
  // abrir/fechar o item não remonta a lista (filtros e período ficam).
  // Formulários com origem na query remontam quando a origem muda.
  const chaveMain =
    activePage === "contratos-historico"
      ? "contratos-historico"
      : activePage === "contatos-lista"
        ? "contatos-lista"
        : activePage === "vendas-nova-venda"
          ? `${pathname}?${orcamentoOrigem ?? ""}|${dataNovaVenda ?? ""}`
          : activePage === "contratos-novo"
            ? `${pathname}?${vendaParaContrato ?? ""}`
            : pathname;
  // Nova tela (ou item) → começa do topo, inclusive quando a chave não muda.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

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
        setActiveTab={(tab) => irParaTela(tab, "dashboard")}
        activePage={activePage}
        setActivePage={(page) => irParaTela(activeTab, page)}
        selectedArtistas={selectedArtistas}
        setSelectedArtistas={setSelectedArtistas}
        isOpenMobile={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        configAberta={configAberta}
      />

      <div
        className="flex flex-1 flex-col overflow-hidden"
        style={{
          // Glow na ZONA da topbar, no nível da coluna — atrás do header
          // transparente. Alinhado e contínuo com a "bola" do PageHeader
          // (que vive dentro do main e é cortada): a bola parece subir pra topbar.
          background: `radial-gradient(380px 160px at 145px -10px, color-mix(in srgb, var(--brand) 15%, transparent), transparent 66%)`,
        }}
      >
        <Topbar
          onOpenSidebar={() => setSidebarOpen(true)}
          migalhas={migalhas}
          onNavegar={irParaHref}
          onAbrirConfiguracoes={() => irPara(urls.configuracoes())}
          onVerNotificacoes={() => irPara(urls.configuracoes("notificacoes"))}
        />

        {configAberta ? (
          <main ref={mainRef} className="relative flex-1 overflow-y-auto overflow-x-hidden animate-in">
            <NavOverlay />
            <Configuracoes onSair={() => voltar(urls.modulo("agenda"))} />
          </main>
        ) : (
        <main
          key={chaveMain}
          ref={mainRef}
          className="relative flex-1 overflow-y-auto overflow-x-hidden animate-in"
        >
          <NavOverlay />
          <SomenteLeitura>
          {/* Financeiro */}
          {activeTab === "financeiro" && activePage === "dashboard" && (
            <Dashboard
              selectedArtistas={selectedArtistas}
              onNavigate={irParaTela}
              onAbrirVenda={abrirVenda}
            />
          )}
          {activeTab === "financeiro" && activePage === "financeiro-pagamentos" && (
            <ControlePagamentos />
          )}
          {activeTab === "financeiro" && activePage === "financeiro-cobrancas" && (
            <ControlePagamentos modo="cobrancas" buscaInicial={buscaCobrancas} />
          )}

          {/* Vendas */}
          {activeTab === "vendas" && activePage === "dashboard" && (
            <VendasDashboard
              selectedArtistas={selectedArtistas}
              onNavigate={irParaTela}
              onAbrirOrcamento={abrirOrcamento}
              onAbrirVenda={abrirVenda}
            />
          )}
          {activeTab === "vendas" && activePage === "vendas-novo-orcamento" && (
            <NovoOrcamento
              onSaved={() => {}}
              onCancel={() => voltar(urls.modulo("vendas"))}
              onDone={() => voltarPara(urls.orcamentos())}
            />
          )}
          {activeTab === "vendas" && activePage === "vendas-historico" && (
            <HistoricoOrcamentos
              selectedArtistas={selectedArtistas}
              onNovo={() => irPara(urls.novoOrcamento())}
              onAbrir={abrirOrcamento}
              onTransformarEmVenda={transformarOrcamentoEmVenda}
            />
          )}
          {activeTab === "vendas" &&
            activePage === "vendas-orcamento-detalhe" &&
            orcamentoId !== null && (
              <OrcamentoDetalhe
                orcamentoId={orcamentoId}
                onBack={() => voltar(urls.orcamentos())}
                onTransformarEmVenda={transformarOrcamentoEmVenda}
                onAbrir={abrirOrcamento}
              />
            )}
          {activeTab === "vendas" && activePage === "vendas-nova-venda" && (
            <ConcretizarVenda
              orcamentoId={orcamentoOrigem ?? undefined}
              dataInicial={dataNovaVenda ?? undefined}
              onSaved={(id) => {
                setAvisoParcelasPreservadas(false);
                // SUBSTITUI o formulário: o Voltar da venda criada não deve
                // reabrir um formulário já enviado.
                irPara(urls.venda(id), { substituir: true });
              }}
              onCancel={() =>
                voltar(orcamentoOrigem ? urls.orcamento(orcamentoOrigem) : urls.vendas())
              }
            />
          )}
          {activeTab === "vendas" && activePage === "vendas-historico-vendas" && (
            <HistoricoVendas
              selectedArtistas={selectedArtistas}
              onNovaVenda={() => irPara(urls.novaVenda())}
              onAbrir={abrirVenda}
              onEditar={editarVenda}
            />
          )}
          {activeTab === "vendas" &&
            activePage === "vendas-venda-detalhe" &&
            vendaId !== null && (
              <VendaDetalhe
                vendaId={vendaId}
                onBack={() => voltar(urls.vendas())}
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
                onSalvou={(id, resultado) => {
                  // Ordem importa: limpa e só então reafirma (o último set vence).
                  setAvisoParcelasPreservadas(false);
                  if (resultado?.parcelasPreservadas) setAvisoParcelasPreservadas(true);
                  voltarPara(urls.venda(id));
                }}
                onCancelar={(id) => voltar(urls.venda(id))}
              />
            )}

          {/* Agenda */}
          {activeTab === "agenda" && activePage === "dashboard" && (
            <AgendaDashboard
              selectedArtistas={selectedArtistas}
              onNavigate={irParaTela}
              onAbrirShow={abrirShow}
            />
          )}
          {activeTab === "agenda" && activePage === "agenda-completa" && (
            <AgendaEscala
              selectedArtistas={selectedArtistas}
              onNovaVendaNoDia={novaVendaNoDia}
            />
          )}
          {activeTab === "agenda" && activePage === "agenda-anotacoes" && (
            <AnotacoesPage />
          )}

          {/* Contatos */}
          {activeTab === "contatos" && activePage === "dashboard" && (
            <ContatosDashboard onAbrirCategoria={(cat) => irPara(urls.contatos(cat))} />
          )}
          {activeTab === "contatos" && activePage === "contatos-lista" && (
            <Contatos
              aba={contatoAba}
              contatoId={contatoId}
              abrirNovo={searchParams.get("novo") === "1"}
              // Trocar de aba não empilha histórico (é filtro da mesma lista).
              onAbrirAba={(aba) => irPara(urls.contatos(aba), { substituir: true })}
              onAbrirContato={(cat, id) => irPara(urls.contato(cat, id))}
              onVoltarDaFicha={() => voltar(urls.contatos(contatoAba))}
              selectedArtistas={selectedArtistas}
              onAbrirShow={abrirShow}
            />
          )}
          {activeTab === "contatos" && activePage === "contatos-mapa" && <MapaPage />}

          {/* Contratos */}
          {activeTab === "contratos" && activePage === "dashboard" && (
            <DashboardContratos
              onNavigate={irParaTela}
              onVerStatus={(status) => irPara(urls.contratos({ status }))}
              onAbrirContrato={abrirContrato}
            />
          )}
          {activeTab === "contratos" && activePage === "contratos-novo" && (
            <NovoContratoPage
              vendaInicialId={vendaParaContrato}
              selectedArtistas={selectedArtistas}
            />
          )}
          {activeTab === "contratos" && activePage === "contratos-modelos" && (
            <ModelosPage />
          )}
          {activeTab === "contratos" && activePage === "contratos-historico" && (
            <HistoricoPage
              contratoId={contratoId}
              statusInicial={statusContratos}
              focarAssinatura={searchParams.get("assinar") === "1"}
              onAbrirContrato={abrirContrato}
              onVoltar={() => voltar(urls.contratos())}
            />
          )}
          {activeTab === "contratos" && activePage === "contratos-pastas" && (
            <MeusContratosPage onAbrirContrato={abrirContrato} onNavigate={irParaTela} />
          )}

          {/* Agência — admin-only (podeAgencia); URL direta de não-admin é
              redirecionada pelo useEffect acima e nunca monta estas telas. */}
          {podeAgencia && activeTab === "agencia" && activePage === "dashboard" && (
            <AgenciaDashboard
              onFazerContratoDaVenda={(id) => irPara(urls.novoContrato({ venda: id }))}
              onVerCobrancaDaVenda={(termo) => irPara(urls.cobrancas({ busca: termo }))}
              onAbrirContrato={abrirContrato}
            />
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

      {/* Modais com ENDEREÇO (?show= / ?parcela=): valem por cima de qualquer
          tela, o F5 reabre e o voltar do navegador fecha. */}
      <ShowDetalheModal
        showId={showAberto}
        onClose={() => fecharSobreposicao("show")}
        onAbrirOrcamento={abrirOrcamento}
        onEditarVenda={editarVenda}
      />
      <ParcelaDetalheModal
        vendaId={vendaDaParcela}
        parcelaId={parcelaAberta}
        onClose={() => fecharSobreposicao("parcela")}
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
  onSalvou,
  onCancelar,
}: {
  vendaId: string;
  onSalvou: (id: string, resultado?: { parcelasPreservadas?: boolean }) => void;
  onCancelar: (id: string) => void;
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
      onSaved={(_id, resultado) => onSalvou(venda.id, resultado)}
      onCancel={() => onCancelar(venda.id)}
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
