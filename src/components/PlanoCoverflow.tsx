"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useT, useMoeda } from "@/lib/i18n";
import {
  PLANOS,
  type CicloCobranca,
  type Plano,
  descontoAnualPct,
  formatarPreco,
  formatarPrecoCurto,
  precoPorMes,
  totalAnual,
} from "@/lib/planos";

/**
 * Coverflow de planos (passo Plano do onboarding).
 *
 * O card CENTRAL é o SELECIONADO — borda azul + glow. As setas, os cliques nos
 * cards vizinhos e os dots deslizam a seleção pelos 6 planos, recentralizando o
 * escolhido. Os cards laterais aparecem menores e esmaecidos (profundidade de
 * coverflow). O card central abre um acordeão "Ver mais recursos".
 *
 * Só transform/opacity nas transições, atrás de `motion-safe:` (respeita
 * prefers-reduced-motion). Nada de imagens — números em JetBrains (font-mono).
 * Preços vêm 100% de src/lib/planos.ts.
 */

/** Escala do card pela distância ao centro (0 = central). */
function escala(off: number): number {
  const a = Math.abs(off);
  return a === 0 ? 1 : a === 1 ? 0.86 : a === 2 ? 0.72 : 0.6;
}
/** Opacidade do card pela distância ao centro. */
function opacidade(off: number): number {
  const a = Math.abs(off);
  return a === 0 ? 1 : a === 1 ? 0.68 : a === 2 ? 0.3 : 0;
}

function CardConteudo({
  plano,
  ciclo,
  center,
  aberto,
  onToggle,
}: {
  plano: Plano;
  ciclo: CicloCobranca;
  center: boolean;
  aberto: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const moeda = useMoeda();
  const preco = precoPorMes(plano, ciclo, moeda);
  const desconto = descontoAnualPct(plano);
  // recursos[0..3] = artistas/usuários/modelos/contratos (já viram os boxes +
  // as linhas de limite); o acordeão mostra o que DIFERENCIA o plano.
  const extras = plano.recursos.slice(4);

  const stats = [
    { n: 1, l: t("Admin") },
    {
      n: plano.maxArtistas,
      l: plano.maxArtistas === 1 ? t("Artista") : t("Artistas"),
    },
    { n: plano.maxUsuariosAdicionais, l: t("Equipe") },
  ];

  return (
    <div
      className="flex flex-col gap-4 rounded-[16px] p-5 text-left"
      style={{
        background: center
          ? "linear-gradient(180deg, rgba(61,123,255,.10), var(--surface) 46%)"
          : "var(--surface)",
        border: center
          ? "1px solid var(--brand)"
          : "1px solid var(--border-color)",
        boxShadow: center
          ? "0 0 0 1px var(--brand), 0 24px 60px -26px rgba(61,123,255,.7)"
          : "none",
      }}
    >
      {/* faixa: MAIS POPULAR + Selecionado */}
      <div className="flex min-h-[20px] items-center justify-between gap-2">
        {plano.destaque ? (
          <span
            className="rounded-md px-2 py-[3px] font-mono text-[9px] font-bold tracking-[.12em] text-white"
            style={{ backgroundColor: "var(--brand)" }}
          >
            {t("MAIS POPULAR")}
          </span>
        ) : (
          <span />
        )}
        {center && (
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold"
            style={{ color: "var(--brand-2)" }}
          >
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--brand)" }}
            >
              <Check size={11} className="text-white" />
            </span>
            {t("Selecionado")}
          </span>
        )}
      </div>

      {/* nome + tagline */}
      <div>
        <div className="font-display text-lg font-extrabold tracking-[-.01em] text-primary">
          {t(plano.nome)}
        </div>
        <div className="mt-1 min-h-[34px] text-[12.5px] leading-[1.35] text-muted">
          {t(plano.tagline)}
        </div>
      </div>

      {/* preço */}
      <div>
        <div className="flex items-end gap-1.5">
          <span className="font-mono text-[30px] font-bold leading-none tracking-[-.02em] text-primary tabular-nums">
            {formatarPreco(preco, moeda)}
          </span>
          <span className="mb-0.5 font-mono text-[11px] font-semibold text-muted">
            {t("/mês")}
          </span>
        </div>
        {ciclo === "anual" ? (
          <div className="mt-1.5 text-[11.5px]" style={{ color: "var(--success)" }}>
            {t("Economize {pct}%", { pct: desconto })}{" "}
            <span className="text-muted">
              · {formatarPrecoCurto(totalAnual(plano, moeda), moeda)}{" "}
              {t("cobrados no ano")}
            </span>
          </div>
        ) : (
          <div className="mt-1.5 text-[11.5px] text-muted">
            {t("ou")}{" "}
            <span className="tabular-nums">
              {formatarPreco(precoPorMes(plano, "anual", moeda), moeda)}
            </span>
            {t("/mês no plano anual")}
          </div>
        )}
      </div>

      {/* Admin / Artistas / Equipe */}
      <div className="grid grid-cols-3 gap-2">
        {stats.map((b, i) => (
          <div
            key={i}
            className="rounded-[10px] border border-border bg-elevated px-2 py-2.5 text-center"
          >
            <div className="font-mono text-[18px] font-bold leading-none text-primary tabular-nums">
              {b.n}
            </div>
            <div className="mt-1 font-mono text-[8px] font-semibold uppercase tracking-[.1em] text-muted">
              {b.l}
            </div>
          </div>
        ))}
      </div>

      {/* limites de modelos/contratos */}
      <div className="flex flex-col gap-2">
        {[
          t("{n} modelos de contrato", { n: plano.maxModelos }),
          t("{n} contratos por mês", { n: plano.maxContratosMes }),
        ].map((r) => (
          <div
            key={r}
            className="flex items-start gap-2 text-[12.5px] leading-[1.4]"
            style={{ color: "var(--text-secondary)" }}
          >
            <Check
              size={14}
              strokeWidth={2.4}
              className="mt-px flex-none"
              style={{ color: "var(--brand-2)" }}
            />
            <span>{r}</span>
          </div>
        ))}
      </div>

      {/* Ver mais recursos (acordeão) — só no card central */}
      {center && extras.length > 0 && (
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="flex w-full items-center justify-between text-[12px] font-semibold text-secondary hover:text-primary"
            aria-expanded={aberto}
          >
            {aberto ? t("Ver menos recursos") : t("Ver mais recursos")}
            <ChevronDown
              size={15}
              className={`motion-safe:transition-transform motion-safe:duration-200 ${
                aberto ? "rotate-180" : ""
              }`}
            />
          </button>
          {aberto && (
            <div className="mt-3 flex flex-col gap-2">
              {extras.map((r) => (
                <div
                  key={r}
                  className="flex items-start gap-2 text-[12.5px] leading-[1.4]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <Check
                    size={14}
                    strokeWidth={2.4}
                    className="mt-px flex-none"
                    style={{ color: "var(--brand-2)" }}
                  />
                  <span>{t(r)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlanoCoverflow({
  ciclo,
  centralIndex,
  onCentralChange,
}: {
  ciclo: CicloCobranca;
  centralIndex: number;
  onCentralChange: (i: number) => void;
}) {
  const t = useT();
  const vpRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const [vw, setVw] = useState(0);
  const [centerH, setCenterH] = useState(0);
  const [aberto, setAberto] = useState(false);

  // Largura do viewport → dimensiona a largura do card e o passo horizontal.
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setVw(el.clientWidth));
    ro.observe(el);
    setVw(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Altura do card CENTRAL → altura do viewport (os cards são absolutos, então
  // não empurram altura; medimos o central e reservamos espaço + folga).
  useEffect(() => {
    const el = centerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCenterH(el.offsetHeight));
    ro.observe(el);
    setCenterH(el.offsetHeight);
    return () => ro.disconnect();
  }, [centralIndex, aberto, ciclo, vw]);

  // Fecha o acordeão ao trocar de plano.
  useEffect(() => {
    setAberto(false);
  }, [centralIndex]);

  const CARD_W = Math.min(360, Math.max(248, vw * 0.82));
  const STEP = CARD_W * 0.7;
  const PAD = 52; // folga vertical pro badge + glow não serem cortados

  const irPara = (i: number) =>
    onCentralChange(Math.max(0, Math.min(PLANOS.length - 1, i)));

  return (
    <div className="relative mx-auto max-w-[1120px] px-2 sm:px-10">
      {/* setas */}
      <button
        type="button"
        onClick={() => irPara(centralIndex - 1)}
        disabled={centralIndex === 0}
        aria-label={t("Plano anterior")}
        className="absolute left-0 top-1/2 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface disabled:opacity-30"
        style={{ boxShadow: "0 10px 24px -8px rgba(0,0,0,.6)" }}
      >
        <ChevronLeft size={18} className="text-secondary" />
      </button>
      <button
        type="button"
        onClick={() => irPara(centralIndex + 1)}
        disabled={centralIndex === PLANOS.length - 1}
        aria-label={t("Próximo plano")}
        className="absolute right-0 top-1/2 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface disabled:opacity-30"
        style={{ boxShadow: "0 10px 24px -8px rgba(0,0,0,.6)" }}
      >
        <ChevronRight size={18} className="text-secondary" />
      </button>

      {/* viewport */}
      <div
        ref={vpRef}
        className="relative overflow-hidden"
        style={{ height: (centerH || 440) + PAD }}
      >
        {PLANOS.map((plano, i) => {
          const off = i - centralIndex;
          if (Math.abs(off) > 2) return null;
          const center = off === 0;
          return (
            <div
              key={plano.id}
              ref={center ? centerRef : undefined}
              onClick={() => {
                if (!center && Math.abs(off) <= 1) irPara(i);
              }}
              className="absolute left-1/2 top-1/2 motion-safe:transition-[transform,opacity] motion-safe:duration-300"
              style={{
                width: CARD_W,
                transform: `translate(-50%, -50%) translateX(${
                  off * STEP
                }px) scale(${escala(off)})`,
                opacity: opacidade(off),
                zIndex: 30 - Math.abs(off) * 10,
                pointerEvents: Math.abs(off) <= 1 ? "auto" : "none",
                cursor: center ? "default" : "pointer",
              }}
            >
              <CardConteudo
                plano={plano}
                ciclo={ciclo}
                center={center}
                aberto={aberto}
                onToggle={() => setAberto((v) => !v)}
              />
            </div>
          );
        })}
      </div>

      {/* dots */}
      <div className="mt-4 flex items-center justify-center gap-1.5">
        {PLANOS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => irPara(i)}
            aria-label={t(p.nome)}
            className="h-1.5 rounded-full motion-safe:transition-all"
            style={{
              width: i === centralIndex ? 22 : 8,
              background:
                i === centralIndex ? "var(--brand)" : "rgba(255,255,255,.18)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
