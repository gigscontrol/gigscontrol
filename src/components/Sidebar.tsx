"use client";

import { useState, useEffect } from "react";
import {
  CalendarDays,
  ShoppingBag,
  Banknote,
  LayoutDashboard,
  CalendarRange,
  X,
  Check,
  Users,
  FilePlus,
  History,
  CalendarCheck2,
  ShoppingCart,
  Wallet,
  Pin,
  FileSignature,
  Building2,
  Music,
  Map,
  NotebookPen,
  LayoutTemplate,
  FolderOpen,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MODULE_THEMES } from "@/types";
import type { ActiveTab, ActivePage } from "@/types";
import { useWorkspace, useArtistas } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";
import LogoGC from "./LogoGC";

type Props = {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activePage: ActivePage;
  setActivePage: (page: ActivePage) => void;
  selectedArtistas: string[];
  setSelectedArtistas: (artistas: string[]) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  /** true quando a tela de Configurações está aberta — nenhum módulo fica ativo */
  configAberta?: boolean;
};

type SubPage = {
  page: ActivePage;
  label: string;
  icon: LucideIcon;
  /** Páginas que também ativam este item (ex: detalhe abre dentro do histórico) */
  alsoActiveOn?: ActivePage[];
};

type ModuleDef = {
  tab: ActiveTab;
  label: string;
  icon: LucideIcon;
  /** Sub-páginas do módulo. Vazio = só dashboard implícito. */
  subPages: SubPage[];
};

const MODULES: ModuleDef[] = [
  {
    tab: "agenda",
    label: "Agenda",
    icon: CalendarDays,
    subPages: [
      { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { page: "agenda-completa", label: "Agenda de Shows", icon: CalendarRange },
      { page: "agenda-anotacoes", label: "Anotações", icon: NotebookPen },
    ],
  },
  {
    tab: "vendas",
    label: "Vendas",
    icon: ShoppingBag,
    subPages: [
      { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { page: "vendas-novo-orcamento", label: "Novo Orçamento", icon: FilePlus },
      {
        page: "vendas-historico",
        label: "Histórico Orçamentos",
        icon: History,
        alsoActiveOn: ["vendas-orcamento-detalhe"],
      },
      { page: "vendas-nova-venda", label: "Nova Venda Direta", icon: CalendarCheck2 },
      {
        page: "vendas-historico-vendas",
        label: "Histórico Vendas",
        icon: ShoppingCart,
        alsoActiveOn: ["vendas-venda-detalhe"],
      },
    ],
  },
  {
    tab: "financeiro",
    label: "Financeiro",
    icon: Banknote,
    subPages: [
      { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { page: "financeiro-pagamentos", label: "Controle", icon: Wallet },
      { page: "financeiro-cobrancas", label: "Fixados", icon: Pin },
    ],
  },
  {
    tab: "contratos",
    label: "Contratos",
    icon: FileSignature,
    subPages: [
      { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { page: "contratos-novo", label: "Novo Contrato", icon: FilePlus },
      { page: "contratos-modelos", label: "Modelos", icon: LayoutTemplate },
      { page: "contratos-historico", label: "Histórico de Contratos", icon: History },
      { page: "contratos-pastas", label: "Organizador", icon: FolderOpen },
    ],
  },
  {
    tab: "contatos",
    label: "Contatos",
    icon: Users,
    subPages: [
      { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { page: "contatos-lista", label: "Gerenciar Contatos", icon: Users },
      { page: "contatos-mapa", label: "Mapa", icon: Map },
    ],
  },
  {
    tab: "agencia",
    label: "Agência",
    icon: Building2,
    subPages: [
      { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { page: "agencia-artistas", label: "Artistas", icon: Music },
      { page: "agencia-equipe", label: "Equipe", icon: Users },
    ],
  },
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  activePage,
  setActivePage,
  selectedArtistas,
  setSelectedArtistas,
  isOpenMobile,
  onCloseMobile,
  configAberta = false,
}: Props) {
  const { aparencia } = useWorkspace();
  const { sessao, isSuperAdmin } = useAuth();
  const ARTISTAS = useArtistas();
  const t = useT();

  // Módulo "Agência" (roster de Artistas/Equipe, com o login de cada um) é
  // administrativo: só admin (e super-admin em modo visitante) enxerga. Para
  // artista/equipe ele nem aparece no menu. O servidor barra as mutações em
  // paralelo (403) e o layout redireciona a URL direta (defesa em profundidade).
  const podeAgencia = isSuperAdmin || sessao?.usuario?.papel === "admin";
  const modulosVisiveis = podeAgencia
    ? MODULES
    : MODULES.filter((mod) => mod.tab !== "agencia");

  // Recolher a sidebar no desktop (persiste em localStorage). No mobile ela é
  // um drawer de 260px (w-[260px]) — o "recolhido" só vale no lg+ (classes lg:*).
  const [collapsed, setCollapsed] = useState(false);
  // Mobile (D4): accordion 1-por-vez. `mobileExpandedTab` é a ÚNICA fonte da
  // verdade do submenu no mobile — o módulo ativo não força mais o submenu
  // aberto, senão dava pra ter 2+ abertos ao mesmo tempo.
  const [mobileExpandedTab, setMobileExpandedTab] = useState<ActiveTab | null>(null);
  // Detecção de mobile em estado (não no render) pra não quebrar a hidratação:
  // no servidor não existe matchMedia, então o primeiro paint é sempre desktop
  // e o efeito corrige logo em seguida.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sincronizar = () => setIsMobile(mq.matches);
    sincronizar();
    // `addEventListener` em MediaQueryList só existe a partir do Safari 14 e
    // falta em WebViews Android antigas. Um TypeError aqui sobe de dentro do
    // useEffect e o React desmonta a árvore — a Sidebar é layout, então o app
    // ficaria EM BRANCO. Fallback pra API legada; o sincronizar() acima já
    // cobre o caso estático se nem isso existir.
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", sincronizar);
      return () => mq.removeEventListener("change", sincronizar);
    }
    const legado = mq as MediaQueryList & {
      addListener?: (cb: () => void) => void;
      removeListener?: (cb: () => void) => void;
    };
    legado.addListener?.(sincronizar);
    return () => legado.removeListener?.(sincronizar);
  }, []);
  // Ao abrir o drawer, já vem expandido o módulo ativo (comportamento de antes,
  // agora via mobileExpandedTab). Com as Configurações abertas nenhum módulo
  // está ativo — abre fechado.
  useEffect(() => {
    if (isOpenMobile) setMobileExpandedTab(configAberta ? null : activeTab);
    else setMobileExpandedTab(null);
  }, [isOpenMobile, activeTab, configAberta]);
  useEffect(() => {
    if (localStorage.getItem("gc-sidebar-collapsed") === "1") setCollapsed(true);
  }, []);
  const setColapsado = (next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem("gc-sidebar-collapsed", next ? "1" : "0");
    } catch {}
  };
  const toggleCollapsed = () => setColapsado(!collapsed);

  // Plano Individual: só tem 1 artista, então o toggle de
  // mostrar/esconder não faz sentido — o usuário SEMPRE quer ver as
  // métricas dele. Bloqueia toggle e renderiza sempre como ativo.
  const planoIndividual = sessao?.workspace?.plano === "individual";

  const toggleDJ = (id: string) => {
    if (planoIndividual) return; // no-op no Individual
    if (selectedArtistas.includes(id)) {
      setSelectedArtistas(selectedArtistas.filter((a) => a !== id));
    } else {
      setSelectedArtistas([...selectedArtistas, id]);
    }
  };

  const allSelected = selectedArtistas.length === ARTISTAS.length && ARTISTAS.length > 0;
  const toggleAll = () => {
    setSelectedArtistas(allSelected ? [] : ARTISTAS.map((d) => d.id));
  };

  return (
    <aside
      className={`
        fixed lg:static inset-y-0 left-0 z-40
        flex flex-col flex-shrink-0
        w-[260px] ${collapsed ? "lg:w-[72px]" : "lg:w-[260px]"}
        bg-surface border-r border-border
        transition-[width,transform] duration-300 ease-smooth
        ${isOpenMobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
    >
      {/* Logo GC + flechinha ao lado (direita) — um só controle: « recolhe,
          » expande. Recolhido no desktop: só o monograma + ». */}
      <div
        className={`relative flex items-center justify-center h-16 border-b border-border flex-shrink-0 ${
          collapsed ? "gap-2 px-3 lg:gap-1 lg:px-2" : "gap-2 px-3"
        }`}
      >
        {aparencia.logoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={aparencia.logoUrl}
              alt={aparencia.nomeAgencia}
              style={{ height: 42, maxWidth: 168, width: "auto" }}
              className={`object-contain ${collapsed ? "lg:hidden" : ""}`}
            />
            <LogoGC
              size={26}
              variant="gradient"
              className={`flex-shrink-0 ${collapsed ? "hidden lg:inline-flex" : "hidden"}`}
            />
          </>
        ) : (
          <>
            {/* Lockup completo (mark + "gigs control") — some no desktop recolhido */}
            <LogoGC
              size={27}
              variant="gradient"
              withWordmark
              className={`flex-shrink-0 ${collapsed ? "lg:hidden" : ""}`}
            />
            {/* Só o monograma — desktop recolhido */}
            <LogoGC
              size={26}
              variant="gradient"
              className={`flex-shrink-0 ${collapsed ? "hidden lg:inline-flex" : "hidden"}`}
            />
          </>
        )}
        {/* Flechinha de recolher/expandir. Expandida: encostada na direita da
            sidebar (logo fica centralizado). Recolhida: ao lado do monograma
            (rail estreito). Só desktop. */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? t("Expandir menu") : t("Recolher menu")}
          aria-label={collapsed ? t("Expandir menu") : t("Recolher menu")}
          className={`hidden lg:flex flex-shrink-0 items-center justify-center h-5 w-5 rounded text-muted hover:text-primary hover:bg-elevated transition-colors ${
            collapsed ? "" : "lg:absolute lg:right-2.5 lg:top-1/2 lg:-translate-y-1/2"
          }`}
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>
        {/* Fechar (mobile) */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden btn-ghost p-2.5 rounded absolute right-3 top-1/2 -translate-y-1/2"
          aria-label={t("Fechar menu")}
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-6">
        {/* Módulos com submenu inline (accordion) */}
        <div>
          <div className={`px-2 mb-2 stat-label ${collapsed ? "lg:invisible" : ""}`}>{t("Módulos")}</div>
          <div className="flex flex-col gap-1">
            {modulosVisiveis.map((mod) => {
              // Com as Configurações abertas, nenhum módulo fica ativo
              // (logo, nenhum submenu aparece).
              const isActive = !configAberta && activeTab === mod.tab;
              const color = MODULE_THEMES[mod.tab].color;
              const Icon = mod.icon;
              return (
                <div key={mod.tab} className="flex flex-col">
                  {/* Botão do módulo */}
                  <button
                    onClick={() => {
                      // Recolhida: clicar num módulo expande de volta pra
                      // mostrar o submenu (pra escolher a subpágina).
                      if (collapsed) setColapsado(false);
                      const mobile = window.matchMedia("(max-width: 1023px)").matches;
                      if (mobile && mod.subPages.length > 0) {
                        // D4: no mobile, tocar no módulo só abre/fecha o submenu —
                        // não navega e não fecha o drawer. Accordion de verdade:
                        // como só cabe um valor no estado, abrir um fecha o
                        // anterior; tocar no já-expandido (inclusive o ativo)
                        // fecha. Por isso NÃO há mais `if (isActive) return`.
                        setMobileExpandedTab((prev) => (prev === mod.tab ? null : mod.tab));
                        return;
                      }
                      // Desktop — ou módulo (hipotético) sem submenu no mobile: navega
                      // pro dashboard e (no mobile) fecha o drawer, como hoje.
                      setActiveTab(mod.tab);
                    }}
                    title={t(mod.label)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium
                      transition-all duration-150 ease-smooth
                      ${collapsed ? "lg:justify-center" : ""}
                      ${isActive
                        ? "text-primary"
                        : "text-secondary hover:bg-elevated hover:text-primary"
                      }
                    `}
                    style={
                      isActive
                        ? {
                            backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
                            boxShadow: `inset 2px 0 0 ${color}`,
                          }
                        : undefined
                    }
                  >
                    <Icon size={16} className="flex-shrink-0" style={{ color: isActive ? color : undefined }} />
                    <span className={collapsed ? "lg:hidden" : ""}>{t(mod.label)}</span>
                    {isActive && (
                      <span
                        className={`ml-auto h-1.5 w-1.5 rounded-full ${collapsed ? "lg:hidden" : ""}`}
                        style={{ backgroundColor: color }}
                      />
                    )}
                  </button>

                  {/* Submenu inline. DESKTOP: inalterado — segue o módulo ativo.
                      MOBILE (D4): só o expandido, um por vez. */}
                  {(isMobile ? mobileExpandedTab === mod.tab : isActive) &&
                    mod.subPages.length > 0 && (
                    <div
                      className={`ml-3 mt-1 mb-2 pl-3 flex flex-col gap-0.5 border-l ${collapsed ? "lg:hidden" : ""}`}
                      style={{ borderColor: `${color}40` }}
                    >
                      {mod.subPages.map((sp) => {
                        const SubIcon = sp.icon;
                        const isPageActive =
                          isActive &&
                          (activePage === sp.page ||
                            (sp.alsoActiveOn?.includes(activePage) ?? false));
                        return (
                          <button
                            key={sp.page}
                            onClick={() =>
                              sp.page === "dashboard"
                                ? setActiveTab(mod.tab)
                                : setActivePage(sp.page)
                            }
                            className={`
                              flex items-center gap-2.5 px-3 py-2 rounded-md text-sm
                              transition-colors duration-150
                              ${isPageActive
                                ? "bg-elevated text-primary font-medium"
                                : "text-muted hover:bg-elevated hover:text-secondary"
                              }
                            `}
                            style={
                              isPageActive
                                ? { boxShadow: `inset 2px 0 0 ${color}` }
                                : undefined
                            }
                          >
                            <SubIcon size={14} />
                            <span>{t(sp.label)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* DJs — aparece em todos os módulos. Em Contatos, os checks
            filtram quais contatos aparecem na lista (regra: contato fica
            visível se pelo menos 1 DJ marcado tem show/orçamento/venda
            com ele; contatos manuais sem histórico aparecem sempre). */}
        {(
          <div>
            <div className={`flex items-center justify-between px-2 mb-2 ${collapsed ? "lg:invisible" : ""}`}>
              <span className="stat-label">Artistas</span>
              {/* "Todos/Limpar" só faz sentido com 2+ artistas (planos
                  Equipe/Agência/etc). Individual = 1 artista = sem toggle. */}
              {!planoIndividual && (
                <button
                  onClick={toggleAll}
                  className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted hover:text-primary transition-colors"
                >
                  {allSelected ? t("Limpar") : t("Todos")}
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {ARTISTAS.map((artista) => {
                // No plano Individual, o artista é SEMPRE renderizado
                // como ativo — não é clicável e não tem estado de
                // "esconder" porque só existe 1 artista no workspace.
                const isActiveDj = planoIndividual
                  ? true
                  : selectedArtistas.includes(artista.id);
                return (
                  <button
                    key={artista.id}
                    onClick={() => toggleDJ(artista.id)}
                    disabled={planoIndividual}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium
                      transition-all duration-150 ease-smooth
                      ${collapsed ? "lg:justify-center" : ""}
                      ${isActiveDj
                        ? "text-primary"
                        : "text-muted hover:text-secondary hover:bg-elevated"
                      }
                      ${planoIndividual ? "cursor-default" : ""}
                    `}
                    title={
                      planoIndividual
                        ? artista.name
                        : `${isActiveDj ? t("Esconder") : t("Mostrar")} ${artista.name}`
                    }
                  >
                    <span
                      className="h-7 w-7 rounded-full flex items-center justify-center text-[0.65rem] font-bold flex-shrink-0 transition-all"
                      style={{
                        backgroundColor: isActiveDj ? artista.color : "var(--bg-elevated)",
                        color: isActiveDj ? "#fff" : "var(--text-muted)",
                        boxShadow: isActiveDj ? `0 0 0 2px ${artista.color}33` : "none",
                      }}
                    >
                      {artista.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className={`flex-1 text-left truncate ${collapsed ? "lg:hidden" : ""}`}>{artista.name}</span>
                    {isActiveDj && !planoIndividual && (
                      <Check size={14} className={`text-secondary ${collapsed ? "lg:hidden" : ""}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className={`border-t border-border p-4 flex-shrink-0 ${collapsed ? "lg:hidden" : ""}`}>
        <div className="text-[0.7rem] text-muted">
          {planoIndividual
            ? t(ARTISTAS.length === 1 ? "{n} artista" : "{n} artistas", { n: ARTISTAS.length })
            : t("{n} de {m} artistas visíveis", { n: selectedArtistas.length, m: ARTISTAS.length })}
        </div>
      </div>
    </aside>
  );
}
