"use client";

import { useState } from "react";
import {
  Banknote,
  CalendarDays,
  FileSignature,
  Menu,
  Plus,
  Search,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useNavegacao } from "../NavOverlay";
import { useModulosVisiveis } from "@/lib/navegacao/useModulos";
import { ROTULO_MODULO, urls } from "@/lib/navegacao/rotas";
import { useAcoesNovo } from "./acoesNovo";
import { FolhaNovo } from "./MenuNovo";
import { abrirBusca } from "./BuscaGlobal";
import type { ActiveTab } from "@/types";

const ICONE: Partial<Record<ActiveTab, LucideIcon>> = {
  agenda: CalendarDays,
  vendas: ShoppingBag,
  financeiro: Banknote,
  contratos: FileSignature,
  contatos: Users,
};
/** Ordem de prioridade dos atalhos (os 3 primeiros que a pessoa enxerga). */
const PRIORIDADE: ActiveTab[] = ["agenda", "vendas", "financeiro", "contratos", "contatos"];

/**
 * Barra de navegação de baixo, SÓ no celular (artistas e equipe usam muito
 * pelo celular — pedido do dono). Três módulos que a pessoa enxerga, o "+"
 * no meio (criar) e "Menu" (o menu completo, com o filtro de artistas).
 * Quem não pode criar nada ganha a busca no lugar do "+".
 */
export default function BarraInferior({
  activeTab,
  configAberta,
  onAbrirMenu,
}: {
  activeTab: ActiveTab;
  configAberta: boolean;
  onAbrirMenu: () => void;
}) {
  const t = useT();
  const { navegar } = useNavegacao();
  const podeVer = useModulosVisiveis();
  const acoes = useAcoesNovo();
  const [folhaNovo, setFolhaNovo] = useState(false);

  const modulos = PRIORIDADE.filter((m) => podeVer(m)).slice(0, 3);
  if (modulos.length === 0) return null;

  const atalho = (tab: ActiveTab) => {
    const Icone = ICONE[tab] ?? CalendarDays;
    const ativo = !configAberta && activeTab === tab;
    return (
      <button
        key={tab}
        type="button"
        onClick={() => navegar(urls.modulo(tab))}
        aria-current={ativo ? "page" : undefined}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium"
        style={{ color: ativo ? "var(--brand)" : "var(--text-muted)" }}
      >
        <Icone size={20} />
        {t(ROTULO_MODULO[tab])}
      </button>
    );
  };

  return (
    <>
      <nav
        aria-label={t("Navegação principal")}
        className="flex flex-shrink-0 items-stretch border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="flex h-16 w-full items-stretch">
          {modulos[0] && atalho(modulos[0])}
          {modulos[1] && atalho(modulos[1])}
          <div className="flex flex-1 items-center justify-center">
            {acoes.length > 0 ? (
              <button
                type="button"
                onClick={() => setFolhaNovo(true)}
                aria-label={t("Criar")}
                className="flex h-11 w-11 items-center justify-center rounded-full text-white"
                style={{
                  backgroundColor: "var(--brand)",
                  boxShadow: "0 6px 18px color-mix(in srgb, var(--brand) 40%, transparent)",
                }}
              >
                <Plus size={22} />
              </button>
            ) : (
              <button
                type="button"
                onClick={abrirBusca}
                className="flex flex-col items-center gap-0.5 text-[0.6875rem] font-medium text-muted"
              >
                <Search size={20} />
                {t("Buscar")}
              </button>
            )}
          </div>
          {modulos[2] && atalho(modulos[2])}
          <button
            type="button"
            onClick={onAbrirMenu}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium text-muted"
          >
            <Menu size={20} />
            {t("Menu")}
          </button>
        </div>
      </nav>
      <FolhaNovo aberta={folhaNovo} onFechar={() => setFolhaNovo(false)} />
    </>
  );
}
