"use client";

/**
 * Seção "Um plano para cada operação" (tela 13 do guia).
 *
 * O PRICING é o MESMO da onboarding: reusa o componente <PlanoCarrossel/>
 * (card central em destaque + glow, vizinhos apagados, lista rica de recursos
 * + acordeão "Ver mais recursos"). Aqui o modo é "landing": o CTA vira
 * "Assinar" e leva pro /signup com o plano/ciclo escolhidos. Em volta ficam o
 * título, o toggle Mensal/Anual (anual com até 17% de desconto) e a faixa
 * "mais de 50 artistas → Fale com a gente".
 */

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { PLANOS, type CicloCobranca } from "@/lib/planos";
import PlanoCarrossel from "@/components/PlanoCarrossel";

// Card em destaque por padrão = o plano marcado como "Mais popular" (Equipe).
const DESTAQUE_INICIAL = Math.max(
  0,
  PLANOS.findIndex((p) => p.destaque)
);

export default function PlanosCarrossel() {
  const t = useT();
  const [ciclo, setCiclo] = useState<CicloCobranca>("mensal");
  const [central, setCentral] = useState(DESTAQUE_INICIAL);

  return (
    <section
      id="planos"
      className="scroll-mt-[72px] border-t border-[var(--hairline)] px-6 pb-[60px] pt-10 sm:px-12"
    >
      <h2 className="gcrv mb-5 text-center font-display text-[30px] font-extrabold tracking-[-0.02em] text-primary md:text-[34px]">
        {t("Um plano para cada operação")}
      </h2>

      {/* toggle mensal/anual */}
      <div className="mb-[22px] flex flex-col items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-surface p-1">
          <button
            type="button"
            onClick={() => setCiclo("mensal")}
            className="rounded-control px-[18px] py-2 text-[12.5px] font-semibold transition-colors"
            style={
              ciclo === "mensal"
                ? { backgroundColor: "var(--brand)", color: "#fff" }
                : { color: "var(--text-secondary)" }
            }
          >
            {t("Mensal")}
          </button>
          <button
            type="button"
            onClick={() => setCiclo("anual")}
            className="inline-flex items-center gap-[7px] rounded-control px-[18px] py-2 text-[12.5px] font-bold transition-colors"
            style={
              ciclo === "anual"
                ? { backgroundColor: "var(--brand)", color: "#fff" }
                : { color: "var(--text-secondary)" }
            }
          >
            {t("Anual")}
            {/* fundo verde pulsando (mesmo verde/pulso do ponto das seções
                01/02/03) atrás do texto — chama atenção pra economia já que
                Mensal vem ativo por padrão */}
            <span className="relative inline-flex items-center overflow-hidden rounded-[5px] px-1.5 py-[3px] font-mono text-[8.5px] font-bold tracking-[.1em] text-[#07130B]">
              <span
                aria-hidden
                className="gcanim absolute inset-0 bg-[#3CE08C]"
                style={{ animation: "gcPulse 2.2s ease-in-out infinite" }}
              />
              <span className="relative">
                {t("ECONOMIZE {pct}%", { pct: 17 })}
              </span>
            </span>
          </button>
        </div>
        <div className="text-[11.5px] text-[var(--text-label)]">
          {t("Planos anuais são cobrados uma vez ao ano. Preço exibido por mês.")}
        </div>
      </div>

      {/* carrossel — MESMO da onboarding (modo landing: CTA "Assinar" → signup) */}
      <div className="gcrv">
        <PlanoCarrossel
          ciclo={ciclo}
          selecionadoIndex={central}
          onSelecionar={setCentral}
          modo="landing"
        />
      </div>

      {/* faixa 50+ artistas */}
      <div
        className="gcrv mx-auto mt-[26px] flex max-w-[1044px] flex-wrap items-center gap-5 rounded-lg border border-[color-mix(in_srgb,var(--brand)_28%,transparent)] px-[26px] py-[22px]"
        style={{
          background:
            "linear-gradient(120deg, color-mix(in srgb, var(--brand) 10%, transparent), color-mix(in srgb, var(--mock-window) 35%, transparent))",
        }}
      >
        <div className="min-w-[240px] flex-1">
          <div className="font-display text-lg font-extrabold tracking-[-0.01em] text-primary">
            {t("Precisa de mais de 50 artistas ou condições especiais?")}
          </div>
          <div className="mt-1 text-[13px] leading-[1.55] text-secondary">
            {t(
              "Montamos um plano sob medida para operações de grande porte, com suporte e integrações dedicadas."
            )}
          </div>
        </div>
        <a
          href="mailto:contato@gigscontrol.com.br"
          className="whitespace-nowrap rounded px-[22px] py-3 text-[13.5px] font-bold text-white"
          style={{ backgroundColor: "var(--brand)" }}
        >
          {t("Fale com a gente")}
        </a>
      </div>
    </section>
  );
}
