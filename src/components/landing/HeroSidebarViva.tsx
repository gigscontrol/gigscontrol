"use client";

/**
 * Hero da landing (tela 13 · seção "01 · Tudo num só painel").
 *
 * À esquerda, a SIDEBAR VIVA do CRM: abre colapsada (68px) → expande (240px)
 * e percorre os 6 módulos abrindo submenu por submenu, num loop de 24s —
 * tudo com keyframes CSS (gcSbW/gcSbL/gcMa1-6/gcSm1-6 em redesign.css).
 * À direita, a copy com o par de CTAs.
 *
 * Os submenus são os REAIS do app (incluindo Anotações e Fixados).
 */

import LogoGC from "@/components/LogoGC";
import { useT } from "@/lib/i18n";
import { BadgeSecao, ChecksSecao, CtasSecao, Grad } from "./blocos";

/* Ícones em SVG inline (traço 1.8, como no guia) */
const PATHS: Record<string, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </>
  ),
  calendario: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M8 3v4M16 3v4M4 11h16" />
    </>
  ),
  nota: (
    <>
      <path d="M6 4h12v16H6z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  sacola: (
    <>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </>
  ),
  doc: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M10 12h5M10 16h5" />
    </>
  ),
  relogio: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  carrinho: (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
      <path d="M3 4h2l2.5 12h10L20 8H6" />
    </>
  ),
  cartao: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  contrato: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M10 13h5M10 16h5" />
    </>
  ),
  pessoas: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c1.2-3 3.5-4.5 6-4.5s4.8 1.5 6 4.5" />
      <path d="M15.5 5.5a3 3 0 0 1 0 5" />
      <path d="M17 14.6c1.7.7 3 2 4 4.4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z" />
      <circle cx="12" cy="11" r="2" />
    </>
  ),
  predio: (
    <>
      <rect x="5" y="4" width="14" height="17" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" />
    </>
  ),
  musica: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
};

function Ic({
  nome,
  size,
  stroke,
}: {
  nome: keyof typeof PATHS;
  size: number;
  stroke: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="1.8"
      style={{ width: size, height: size, flex: "none" }}
      aria-hidden
    >
      {PATHS[nome]}
    </svg>
  );
}

type Modulo = {
  nome: string;
  icone: keyof typeof PATHS;
  submenu: { icone: keyof typeof PATHS; label: string }[];
};

const MODULOS: Modulo[] = [
  {
    nome: "Agenda",
    icone: "calendario",
    submenu: [
      { icone: "dashboard", label: "Dashboard" },
      { icone: "calendario", label: "Agenda de Shows" },
      { icone: "nota", label: "Anotações" },
    ],
  },
  {
    nome: "Vendas",
    icone: "sacola",
    submenu: [
      { icone: "dashboard", label: "Dashboard" },
      { icone: "doc", label: "Novo Orçamento" },
      { icone: "relogio", label: "Histórico Orçamentos" },
      { icone: "calendario", label: "Nova Venda Direta" },
      { icone: "carrinho", label: "Histórico Vendas" },
    ],
  },
  {
    nome: "Financeiro",
    icone: "cartao",
    submenu: [
      { icone: "dashboard", label: "Dashboard" },
      { icone: "cartao", label: "Controle de Pagamentos" },
      { icone: "nota", label: "Fixados" },
    ],
  },
  {
    nome: "Contratos",
    icone: "contrato",
    submenu: [
      { icone: "dashboard", label: "Dashboard" },
      { icone: "doc", label: "Novo Contrato" },
      { icone: "nota", label: "Modelos" },
      { icone: "relogio", label: "Histórico de Contratos" },
      { icone: "doc", label: "Organizador" },
    ],
  },
  {
    nome: "Contatos",
    icone: "pessoas",
    submenu: [
      { icone: "dashboard", label: "Dashboard" },
      { icone: "pessoas", label: "Gerenciar Contatos" },
      { icone: "pin", label: "Mapa" },
    ],
  },
  {
    nome: "Agência",
    icone: "predio",
    submenu: [
      { icone: "dashboard", label: "Dashboard" },
      { icone: "musica", label: "Artistas" },
      { icone: "pessoas", label: "Equipe" },
    ],
  },
];

/** Rótulo que aparece/some junto com a expansão da sidebar (loop 24s). */
const ANIM_LABEL = { animation: "gcSbL 24s linear infinite" } as const;

function SidebarViva() {
  const t = useT();
  return (
    <div
      className="gcanim flex flex-none flex-col overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--mock-window)]"
      style={{
        width: 240,
        height: 430,
        boxShadow: "0 24px 50px -18px var(--shadow-color-strong)",
        animation: "gcSbW 24s linear infinite",
      }}
    >
      {/* topo: logo + wordmark */}
      <div className="flex flex-none items-center gap-[9px] border-b border-[var(--hairline)] p-3.5">
        <LogoGC size={18} variant="gradient" />
        <span
          className="gcanim whitespace-nowrap font-display text-[13.5px] font-bold text-primary"
          style={ANIM_LABEL}
        >
          gigs control
        </span>
        <span
          className="gcanim ml-auto text-xs text-[var(--text-disabled)]"
          style={ANIM_LABEL}
        >
          «
        </span>
      </div>

      {/* módulos */}
      <div className="overflow-hidden px-2.5 py-3">
        {MODULOS.map((mod, i) => (
          <div key={mod.nome}>
            {/* linha do módulo — acende quando é a vez dele */}
            <div
              className="gcanim flex items-center gap-2.5 rounded-lg px-2.5 py-[9px]"
              style={{ animation: `gcMa${i + 1} 24s linear infinite` }}
            >
              <Ic nome={mod.icone} size={15} stroke="var(--text-secondary)" />
              <span
                className="gcanim whitespace-nowrap text-[12.5px] font-semibold text-[var(--text-primary)]"
                style={ANIM_LABEL}
              >
                {t(mod.nome)}
              </span>
              <span
                className="gcanim ml-auto h-1.5 w-1.5 overflow-hidden rounded-full bg-[var(--brand-2)]"
                style={{ animation: `gcSm${i + 1} 24s linear infinite` }}
              />
            </div>
            {/* submenu — expande na vez do módulo */}
            <div
              className="gcanim ml-[17px] overflow-hidden border-l border-[color-mix(in_srgb,var(--brand)_25%,transparent)] pl-2"
              style={{
                maxHeight: 0,
                animation: `gcSm${i + 1} 24s linear infinite`,
              }}
            >
              {mod.submenu.map((item, j) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-chip px-[9px] py-1.5 ${
                    j === 0 ? "bg-[var(--mock-active)]" : ""
                  }`}
                >
                  <Ic
                    nome={item.icone}
                    size={12}
                    stroke={j === 0 ? "var(--text-soft)" : "var(--text-label)"}
                  />
                  <span
                    className={`whitespace-nowrap text-[11px] ${
                      j === 0 ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"
                    }`}
                  >
                    {t(item.label)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HeroSidebarViva() {
  const t = useT();
  return (
    <section
      id="inicio"
      className="grid scroll-mt-[72px] items-center gap-6 px-6 pb-[58px] pt-[54px] sm:px-12 lg:min-h-[calc(100dvh-72px)] lg:grid-cols-[1fr_1.05fr] lg:py-6"
      style={{
        background:
          "radial-gradient(70% 90% at 22% 30%, var(--glow-hero), var(--glow-fade) 60%)",
      }}
    >
      {/* sidebar viva (esquerda no desktop, EM CIMA no mobile) — +10% e
          entrando da esquerda no load */}
      <div
        className="gcrv-l relative order-1 flex min-h-[490px] items-center justify-center lg:order-1"
      >
        <div className="xl:scale-110">
          <SidebarViva />
        </div>
      </div>

      {/* copy — entrada em cascata (badge → título → texto → CTAs → checks) */}
      <div className="order-2 flex flex-col justify-center gap-[22px] lg:order-2">
        <div className="gcrv self-start">
          <BadgeSecao>{t("01 · Tudo num só painel")}</BadgeSecao>
        </div>
        <h1
          className="gcrv font-display text-4xl font-extrabold leading-[1.06] tracking-[-0.03em] md:text-[40px] xl:text-[46px]"
          style={{ transitionDelay: "80ms" }}
        >
          {t("Gestão profissional para")}
          <br />
          <Grad>{t("agências de artistas e DJs")}</Grad>.
        </h1>
        <p
          className="gcrv max-w-[470px] text-[15px] leading-[1.6] text-secondary xl:text-base"
          style={{ transitionDelay: "160ms" }}
        >
          {t(
            "O sistema de gestão completo para agências de artistas e DJs: centralize agenda, orçamentos, vendas, contratos, clientes, artistas e equipe num só CRM e tenha controle total da operação, com decisões muito mais seguras."
          )}
        </p>
        <div className="gcrv" style={{ transitionDelay: "240ms" }}>
          <CtasSecao />
        </div>
        <div className="gcrv" style={{ transitionDelay: "320ms" }}>
          <ChecksSecao
            itens={[
              "Controle total da operação",
              "6 módulos totalmente integrados",
              "Contratos com assinatura digital",
            ]}
          />
        </div>
      </div>
    </section>
  );
}
