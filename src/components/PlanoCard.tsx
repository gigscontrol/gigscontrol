"use client";

import { Check } from "lucide-react";
import {
  formatarPreco,
  formatarPrecoCurto,
  precoPorMes,
  economiaAnual,
  descontoAnualPct,
  totalAnual,
  totalUsuarios,
  valorMensal,
  valorAnual,
  type CicloCobranca,
  type Plano,
} from "@/lib/planos";
import { useT, useMoeda } from "@/lib/i18n";

/**
 * Card de plano reusável — fonte única de preço é `src/lib/planos.ts`
 * (getPlano/valorMensal/precoPorMes/formatarPreco). Usado no onboarding
 * (Etapa 2) e reaproveitável em qualquer outro ponto do funil que precise
 * do mesmo cartão de plano com toggle mensal/anual.
 *
 * NÃO duplica preço: todo número vem dos helpers de planos.ts.
 */
export default function PlanoCard({
  plano,
  ciclo,
  selecionado = false,
  recomendado = false,
  onSelecionar,
}: {
  plano: Plano;
  ciclo: CicloCobranca;
  /** Estado de seleção controlado pelo pai (ex.: wizard do onboarding). */
  selecionado?: boolean;
  /** Destaque visual de "recomendado" — independente de `plano.destaque`. */
  recomendado?: boolean;
  /** Se fornecido, o card vira clicável/selecionável (botão). Senão, é só exibição. */
  onSelecionar?: () => void;
}) {
  const t = useT();
  const moeda = useMoeda();
  const preco = precoPorMes(plano, ciclo, moeda);
  const desconto = descontoAnualPct(plano);
  const economia = economiaAnual(plano, moeda);
  const destacado = recomendado || plano.destaque;

  const Wrapper = onSelecionar ? "button" : "div";

  return (
    <Wrapper
      type={onSelecionar ? "button" : undefined}
      onClick={onSelecionar}
      className={`card flex flex-col relative h-full text-left w-full transition-all ${
        onSelecionar ? "hover:border-border-strong cursor-pointer" : ""
      }`}
      style={{
        // Azul (--brand) é EXCLUSIVO do card SELECIONADO — borda + anel 2px — pra
        // não confundir com o "Mais popular". O recomendado se distingue pelo badge
        // + um anel branco sutil (neutro), nunca a borda azul da seleção.
        borderColor: selecionado ? "var(--brand)" : undefined,
        boxShadow: selecionado
          ? "0 0 0 2px var(--brand)"
          : destacado
            ? "0 0 0 1px var(--border-hover)"
            : undefined,
      }}
    >
      {destacado && (
        <span
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[0.6rem] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white whitespace-nowrap"
          style={{ backgroundColor: "var(--brand)" }}
        >
          {t("Mais popular")}
        </span>
      )}

      {selecionado && (
        <div
          className="absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--brand)" }}
        >
          <Check size={12} className="text-white" />
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-base font-bold">{plano.nome}</h3>
        <p className="text-xs text-muted mt-0.5 min-h-[2.5rem]">{plano.tagline}</p>
      </div>

      {/* Preço */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums">
            {formatarPreco(preco, moeda)}
          </span>
          <span className="text-xs text-muted">{t("/mês")}</span>
        </div>

        {ciclo === "anual" ? (
          <div className="mt-1.5 flex flex-col gap-0.5">
            <span className="text-[0.7rem] text-muted line-through tabular-nums">
              {formatarPreco(valorMensal(plano, moeda), moeda)}{t("/mês no mensal")}
            </span>
            <span className="text-[0.7rem] font-semibold" style={{ color: "var(--brand)" }}>
              {t("Economize")} {formatarPrecoCurto(economia, moeda)} {t("por ano")} ({desconto}%)
            </span>
            <span className="text-[0.7rem] text-muted">
              {formatarPrecoCurto(totalAnual(plano, moeda), moeda)} {t("cobrados no ano")}
            </span>
          </div>
        ) : (
          <div className="mt-1.5">
            <span className="text-[0.7rem] text-muted">
              {t("ou")} {formatarPreco(valorAnual(plano, moeda) / 12, moeda)}{t("/mês no plano anual")}
            </span>
          </div>
        )}
      </div>

      {/* Limites */}
      <div className="flex gap-2 mb-1">
        <div className="flex-1 bg-elevated border border-border rounded-md py-2 text-center">
          <div className="text-base font-bold tabular-nums">{plano.maxArtistas}</div>
          <div className="text-[0.6rem] text-muted uppercase tracking-wide">
            {plano.maxArtistas === 1 ? t("artista") : t("artistas")}
          </div>
        </div>
        <div className="flex-1 bg-elevated border border-border rounded-md py-2 text-center">
          <div className="text-base font-bold tabular-nums">{totalUsuarios(plano)}</div>
          <div className="text-[0.6rem] text-muted uppercase tracking-wide">{t("usuários")}</div>
        </div>
      </div>
      <p className="text-[0.65rem] text-muted mb-4 text-center">
        1 admin + {plano.maxArtistas}{" "}
        {plano.maxArtistas === 1 ? t("artista") : t("artistas")} +{" "}
        {plano.maxUsuariosAdicionais} {t("adicionais")}
      </p>

      {/* Recursos */}
      <ul className="flex flex-col gap-2 flex-1">
        {plano.recursos.map((r) => (
          <li key={r} className="flex items-start gap-2 text-xs text-secondary">
            <Check size={13} className="flex-shrink-0 mt-0.5" style={{ color: "var(--brand)" }} />
            {r}
          </li>
        ))}
      </ul>
    </Wrapper>
  );
}
