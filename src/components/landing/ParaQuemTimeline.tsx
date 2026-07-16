"use client";

/**
 * Seção "Para quem é a Gigs Control?" (tela 13 do guia): timeline vertical
 * central. Os dots dão scale-bounce (gcrv-s) e os cards deslizam do SEU lado
 * (gcrv-r direita / gcrv-l esquerda) ao entrar no viewport; o nó final é
 * centralizado, com o fechamento embaixo.
 */

import { useT } from "@/lib/i18n";

const PERFIS = [
  {
    emoji: "🎧",
    titulo: "Artistas e DJs independentes",
    texto:
      "Gerencie sua carreira como um verdadeiro escritório. Organize agenda, orçamentos, contratos, logística, financeiro e clientes em uma única plataforma.",
  },
  {
    emoji: "💼",
    titulo: "Managers e empresários",
    texto:
      "Centralize negociações, vendas, contratos, cachês e comissões. Tenha controle total da operação e acompanhe cada etapa do fechamento do show.",
  },
  {
    emoji: "🏢",
    titulo: "Agências e escritórios artísticos",
    texto:
      "Gerencie todo o seu roster com segurança. Controle artistas, equipe, permissões, agenda, financeiro e desempenho da operação em um só lugar.",
  },
  {
    emoji: "🌎",
    titulo: "Operações internacionais",
    texto:
      "Negocie em diferentes países com suporte a múltiplos idiomas, moedas e documentos. Uma plataforma preparada para quem vende shows para o mundo.",
  },
];

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="gcrv-s h-[15px] w-[15px] flex-none rounded-full border-[3px] border-main bg-[var(--brand)]"
      style={{
        boxShadow:
          "0 0 0 2px color-mix(in srgb, var(--brand) 35%, transparent), 0 0 14px color-mix(in srgb, var(--brand) 60%, transparent)",
        transitionDelay: `${delay}ms`,
      }}
    />
  );
}

function CardPerfil({ perfil }: { perfil: (typeof PERFIS)[number] }) {
  const t = useT();
  return (
    <div className="flex-1 rounded-[14px] border border-[var(--border-color)] bg-[var(--mock-window)] px-5 py-[18px]">
      <div className="mb-[9px] flex items-center gap-[11px]">
        <span
          className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] border border-[color-mix(in_srgb,var(--brand)_28%,transparent)] bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-lg"
          aria-hidden
        >
          {perfil.emoji}
        </span>
        <span className="font-display text-[17px] font-extrabold tracking-[-0.01em] text-primary">
          {t(perfil.titulo)}
        </span>
      </div>
      <div className="text-[13px] leading-[1.6] text-[var(--text-body)]">
        {t(perfil.texto)}
      </div>
    </div>
  );
}

export default function ParaQuemTimeline() {
  const t = useT();
  return (
    <section className="border-t border-[var(--hairline)] px-6 pb-[60px] pt-14 sm:px-12">
      <h2 className="gcrv mb-2 text-center font-display text-[30px] font-extrabold tracking-[-0.02em] text-primary md:text-[34px]">
        {t("Para quem é a Gigs Control?")}
      </h2>
      <p
        className="gcrv mb-11 text-center text-[15px] text-secondary"
        style={{ transitionDelay: "90ms" }}
      >
        {t("Da carreira independente às maiores agências do mercado.")}
      </p>

      <div className="relative mx-auto max-w-[920px]">
        {/* linha central */}
        <div
          className="absolute left-[7px] top-2 w-0.5 md:left-1/2 md:-translate-x-1/2"
          style={{
            bottom: 96,
            background: "linear-gradient(var(--brand), color-mix(in srgb, var(--brand) 12%, transparent))",
          }}
        />

        {PERFIS.map((perfil, i) => {
          const direita = i % 2 === 0; // 1º e 3º cards à direita, como no guia
          return (
            <div
              key={perfil.titulo}
              className="mb-[26px] grid grid-cols-[16px_1fr] items-center gap-3 md:grid-cols-[1fr_56px_1fr] md:gap-0"
            >
              {/* coluna esquerda (desktop) */}
              <div className="hidden md:block">
                {!direita && (
                  <div
                    className="gcrv-l flex items-center"
                    style={{ transitionDelay: `${120 + i * 90}ms` }}
                  >
                    <CardPerfil perfil={perfil} />
                    <span
                      className="h-0.5 w-[26px] flex-none"
                      style={{
                        background:
                          "linear-gradient(270deg, color-mix(in srgb, var(--brand) 60%, transparent), color-mix(in srgb, var(--brand) 10%, transparent))",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* dot central */}
              <div className="flex justify-center">
                <Dot delay={i * 90} />
              </div>

              {/* coluna direita (desktop) / única (mobile) */}
              <div className="md:block">
                <div className="md:hidden">
                  <div
                    className="gcrv-r"
                    style={{ transitionDelay: `${120 + i * 90}ms` }}
                  >
                    <CardPerfil perfil={perfil} />
                  </div>
                </div>
                <div className="hidden md:block">
                  {direita && (
                    <div
                      className="gcrv-r flex items-center"
                      style={{ transitionDelay: `${120 + i * 90}ms` }}
                    >
                      <span
                        className="h-0.5 w-[26px] flex-none"
                        style={{
                          background:
                            "linear-gradient(90deg, color-mix(in srgb, var(--brand) 60%, transparent), color-mix(in srgb, var(--brand) 10%, transparent))",
                        }}
                      />
                      <CardPerfil perfil={perfil} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* nó final + fechamento */}
        <div className="mb-5 flex justify-center">
          <Dot delay={420} />
        </div>
        <div
          className="gcrv mx-auto max-w-[600px] text-center"
          style={{ transitionDelay: "520ms" }}
        >
          <div className="mb-2.5 font-display text-xl font-extrabold tracking-[-0.02em] text-primary">
            {t("Feita para quem vive de fechar shows.")}
          </div>
          <div className="text-[13.5px] leading-[1.65] text-[var(--text-body)]">
            {t(
              "Se você faz agenciamento de artistas, vende shows e precisa organizar todo o booking em um único sistema, a Gigs Control foi criada para você. Ela acompanha o crescimento da operação, do artista independente às produtoras e maiores agências do mercado."
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
