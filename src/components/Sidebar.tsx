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
  FileSignature,
  Building2,
  Music,
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
  selectedDJs: string[];
  setSelectedDJs: (djs: string[]) => void;
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
      { page: "financeiro-pagamentos", label: "Controle de Pagamentos", icon: Wallet },
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
  selectedDJs,
  setSelectedDJs,
  isOpenMobile,
  onCloseMobile,
  configAberta = false,
}: Props) {
  const { aparencia } = useWorkspace();
  const { sessao } = useAuth();
  const DJS = useArtistas();
  const t = useT();

  // Recolher a sidebar no desktop (persiste em localStorage). No mobile ela é
  // um drawer full-width — o "recolhido" só vale no lg+ (classes lg:*).
  const [collapsed, setCollapsed] = useState(false);
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
    if (selectedDJs.includes(id)) {
      setSelectedDJs(selectedDJs.filter((dj) => dj !== id));
    } else {
      setSelectedDJs([...selectedDJs, id]);
    }
  };

  const allSelected = selectedDJs.length === DJS.length && DJS.length > 0;
  const toggleAll = () => {
    setSelectedDJs(allSelected ? [] : DJS.map((d) => d.id));
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
      {/* Logo GC centralizado no topo (tokens.md §3/§4). Recolhido: só o monograma. */}
      <div className="relative flex items-center justify-center h-16 border-b border-border flex-shrink-0 px-3">
        {aparencia.logoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={aparencia.logoUrl}
              alt={aparencia.nomeAgencia}
              style={{ height: 42, maxWidth: 176, width: "auto" }}
              className={`object-contain ${collapsed ? "lg:hidden" : ""}`}
            />
            <LogoGC
              size={30}
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
              size={30}
              variant="gradient"
              className={`flex-shrink-0 ${collapsed ? "hidden lg:inline-flex" : "hidden"}`}
            />
          </>
        )}
        {/* Fechar (mobile) */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden btn-ghost p-1.5 rounded absolute right-3 top-1/2 -translate-y-1/2"
          aria-label={t("Fechar menu")}
        >
          <X size={18} />
        </button>
      </div>

      {/* Toggle recolher (»«) — flechinha discreta logo abaixo do logo, só
          desktop. Um lugar só pros dois estados: « recolhe, » expande. */}
      <div className="hidden lg:block px-3 pt-2.5">
        <button
          onClick={toggleCollapsed}
          title={collapsed ? t("Expandir menu") : t("Recolher menu")}
          aria-label={collapsed ? t("Expandir menu") : t("Recolher menu")}
          className={`flex w-full items-center rounded-md py-1.5 text-muted hover:text-primary hover:bg-elevated transition-colors ${
            collapsed ? "justify-center" : "justify-end px-2"
          }`}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-6">
        {/* Módulos com submenu inline (accordion) */}
        <div>
          <div className={`px-2 mb-2 stat-label ${collapsed ? "lg:invisible" : ""}`}>{t("Módulos")}</div>
          <div className="flex flex-col gap-1">
            {MODULES.map((mod) => {
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

                  {/* Submenu inline: aparece só quando o módulo está ativo */}
                  {isActive && mod.subPages.length > 0 && (
                    <div
                      className={`ml-3 mt-1 mb-2 pl-3 flex flex-col gap-0.5 border-l ${collapsed ? "lg:hidden" : ""}`}
                      style={{ borderColor: `${color}40` }}
                    >
                      {mod.subPages.map((sp) => {
                        const SubIcon = sp.icon;
                        const isPageActive =
                          activePage === sp.page ||
                          (sp.alsoActiveOn?.includes(activePage) ?? false);
                        return (
                          <button
                            key={sp.page}
                            onClick={() => setActivePage(sp.page)}
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
              <span className="stat-label">DJs</span>
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
              {DJS.map((dj) => {
                // No plano Individual, o artista é SEMPRE renderizado
                // como ativo — não é clicável e não tem estado de
                // "esconder" porque só existe 1 artista no workspace.
                const isActiveDj = planoIndividual
                  ? true
                  : selectedDJs.includes(dj.id);
                return (
                  <button
                    key={dj.id}
                    onClick={() => toggleDJ(dj.id)}
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
                        ? dj.name
                        : `${isActiveDj ? t("Esconder") : t("Mostrar")} ${dj.name}`
                    }
                  >
                    <span
                      className="h-7 w-7 rounded-full flex items-center justify-center text-[0.65rem] font-bold flex-shrink-0 transition-all"
                      style={{
                        backgroundColor: isActiveDj ? dj.color : "var(--bg-elevated)",
                        color: isActiveDj ? "#fff" : "var(--text-muted)",
                        boxShadow: isActiveDj ? `0 0 0 2px ${dj.color}33` : "none",
                      }}
                    >
                      {dj.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className={`flex-1 text-left truncate ${collapsed ? "lg:hidden" : ""}`}>{dj.name}</span>
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
            ? t(DJS.length === 1 ? "{n} artista" : "{n} artistas", { n: DJS.length })
            : t("{n} de {m} DJs visíveis", { n: selectedDJs.length, m: DJS.length })}
        </div>
      </div>
    </aside>
  );
}
