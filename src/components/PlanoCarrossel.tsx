"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useT, useMoeda } from "@/lib/i18n";
import {
  PLANOS,
  type CicloCobranca,
  type Plano,
  formatarPreco,
  formatarPrecoCurto,
  precoPorMes,
  totalAnual,
  totalUsuarios,
  valorMensal,
} from "@/lib/planos";

/**
 * Carrossel de planos do passo Plano (fiel ao design do standalone).
 *
 * 3 cards visíveis por página (2 páginas: essenciais / agências). O card
 * SELECIONADO fica em destaque — borda azul + glow + gradiente, escala 1 e
 * opacity 1 — enquanto os vizinhos ficam em escala 0.93 e opacity 0.55. Setas
 * + 6 dots (um por plano) navegam; clicar num card (ou no botão Selecionar) o
 * seleciona. Só transform/opacity nas transições (motion-safe).
 *
 * As listas de recursos vêm do design do Bruno (marketing), não de planos.ts:
 * 7 visíveis por card + 12 no acordeão "Ver mais recursos".
 */

// 12 recursos do acordeão — iguais em todos os planos (do design).
const RECURSOS_EXTRA = [
  "Sincronização com Google Calendar",
  "Aplicativo para iOS e Android",
  "Ranking de Vendedores",
  "Análise de Receita",
  "Performance por Artista",
  "Conversão de Negócios",
  "Análise de Fechamentos",
  "Ticket Médio",
  "Pipeline de Vendas",
  "Funil Comercial",
  "Histórico Comercial",
  "Relatórios Financeiros Avançados",
];

// 7 recursos visíveis por card (4 fixos + 2 derivados dos limites + 1 fixo).
function recursosVisiveis(p: Plano): string[] {
  return [
    "Dashboard completo",
    "Orçamentos ilimitados",
    "Vendas ilimitadas",
    "Contatos ilimitados",
    `Assinatura digital — ${p.maxContratosMes} contratos/mês`,
    `Modelos de contrato — ${p.maxModelos}`,
    "Agenda de shows ilimitada",
  ];
}

function LinhaRecurso({ texto }: { texto: string }) {
  return (
    <div
      className="flex items-start gap-2 text-[12.5px] leading-[1.4]"
      style={{ color: "var(--text-secondary)" }}
    >
      <Check
        size={14}
        strokeWidth={2.4}
        className="mt-px flex-none"
        style={{ color: "var(--brand-2)" }}
      />
      <span>{texto}</span>
    </div>
  );
}

function CardPlano({
  plano,
  ciclo,
  selecionado,
  onSelecionar,
  modo = "selecao",
}: {
  plano: Plano;
  ciclo: CicloCobranca;
  selecionado: boolean;
  onSelecionar: () => void;
  /**
   * "selecao" (onboarding): o CTA seleciona o plano (Selecionar/Selecionado).
   * "landing" (vitrine): o CTA é "Assinar" e leva pro /signup com o plano.
   */
  modo?: "selecao" | "landing";
}) {
  const t = useT();
  const moeda = useMoeda();
  const [verMais, setVerMais] = useState(false);
  const anual = ciclo === "anual";
  const precoMes = anual ? precoPorMes(plano, "anual", moeda) : valorMensal(plano, moeda);

  const stats = [
    { n: 1, l: t("Admin") },
    { n: plano.maxArtistas, l: plano.maxArtistas === 1 ? t("Artista") : t("Artistas") },
    { n: plano.maxUsuariosAdicionais, l: t("Equipe") },
  ];

  return (
    <div
      onClick={onSelecionar}
      className="relative flex cursor-pointer flex-col gap-[15px] rounded-[16px]"
      style={{
        padding: "26px 24px",
        background: selecionado
          ? "linear-gradient(180deg, color-mix(in srgb, var(--brand) 12%, transparent), var(--mock-window) 44%)"
          : "var(--mock-window)",
        border: selecionado
          ? "1px solid color-mix(in srgb, var(--brand) 60%, transparent)"
          : "1px solid var(--border-color)",
        boxShadow: selecionado
          ? "color-mix(in srgb, var(--brand) 55%, transparent) 0px 18px 50px -20px"
          : "none",
      }}
    >
      {plano.destaque && (
        <span
          className="absolute -top-[11px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2.5 py-[5px] font-mono text-[9px] font-bold tracking-[.14em] text-white"
          style={{ backgroundColor: "var(--brand)" }}
        >
          {t("MAIS POPULAR")}
        </span>
      )}

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
          <span className="font-display text-[29px] font-extrabold leading-none tracking-[-.02em] text-primary tabular-nums">
            {formatarPreco(precoMes, moeda)}
          </span>
          <span className="mb-0.5 font-mono text-[11px] font-semibold text-muted">
            {t("/mês")}
          </span>
        </div>
        <div className="mt-1.5 text-[11.5px] text-muted">
          {anual
            ? `${formatarPrecoCurto(totalAnual(plano, moeda), moeda)} ${t("cobrados no ano")}`
            : t("cobrado por mês")}
        </div>
      </div>

      {/* CTA — na onboarding seleciona o plano; na landing leva pro signup */}
      {modo === "landing" ? (
        <Link
          href={`/signup?plano=${plano.id}&ciclo=${ciclo}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[13px] font-bold transition-colors"
          style={
            selecionado
              ? { backgroundColor: "var(--brand)", border: "1px solid var(--brand)", color: "#fff" }
              : { backgroundColor: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-primary)" }
          }
        >
          {t("Assinar")}
        </Link>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelecionar();
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[13px] font-bold transition-colors"
          style={
            selecionado
              ? { backgroundColor: "var(--brand)", border: "1px solid var(--brand)", color: "#fff" }
              : { backgroundColor: "transparent", border: "1px solid var(--border-hover)", color: "var(--text-primary)" }
          }
        >
          {selecionado && <Check size={14} strokeWidth={3} />}
          {selecionado ? t("Selecionado") : t("Selecionar")}
        </button>
      )}

      {/* Admin / Artistas / Equipe */}
      <div className="grid grid-cols-3 gap-2">
        {stats.map((b, i) => (
          <div
            key={i}
            className="rounded-[9px] px-2 py-2.5 text-center"
            style={{
              background: "var(--bg-main)",
              border: "1px solid color-mix(in srgb, var(--text-primary) 7%, transparent)",
            }}
          >
            <div className="font-display text-[20px] font-extrabold leading-none text-primary tabular-nums">
              {b.n}
            </div>
            <div className="mt-1 font-mono text-[8px] font-semibold uppercase tracking-[.1em] text-muted">
              {b.l}
            </div>
          </div>
        ))}
      </div>
      <div className="-mt-1 text-center text-[11px] text-muted">
        {t("{n} usuários no total", { n: totalUsuarios(plano) })}
      </div>

      <div className="h-px" style={{ background: "var(--hairline)" }} />

      {/* recursos visíveis */}
      <div className="flex flex-col gap-2.5">
        {recursosVisiveis(plano).map((r) => (
          <LinhaRecurso key={r} texto={r} />
        ))}
      </div>

      {/* Ver mais recursos (acordeão) */}
      <div className="border-t pt-3" style={{ borderColor: "var(--hairline)" }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setVerMais((v) => !v);
          }}
          className="flex w-full items-center justify-between text-[12px] font-semibold text-secondary hover:text-primary"
          aria-expanded={verMais}
        >
          {verMais ? t("Ver menos recursos") : t("Ver mais recursos")}
          <ChevronDown
            size={15}
            className={`motion-safe:transition-transform motion-safe:duration-200 ${
              verMais ? "rotate-180" : ""
            }`}
          />
        </button>
        {verMais && (
          <div className="mt-3 flex flex-col gap-2.5">
            {RECURSOS_EXTRA.map((r) => (
              <LinhaRecurso key={r} texto={t(r)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlanoCarrossel({
  ciclo,
  selecionadoIndex,
  onSelecionar,
  modo = "selecao",
}: {
  ciclo: CicloCobranca;
  selecionadoIndex: number;
  onSelecionar: (i: number) => void;
  /** "selecao" (onboarding) ou "landing" (vitrine, CTA "Assinar" → signup). */
  modo?: "selecao" | "landing";
}) {
  const t = useT();
  // Cards visíveis por vez: 1 no mobile (<640px), 3 no desktop. Antes era fixo
  // em grid-cols-3 → no celular os 3 cards ficavam espremidos e sobrepostos.
  // Agora o track lista TODOS os planos e desliza por uma janela de N cards.
  const [porTela, setPorTela] = useState(3);
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      setPorTela(w < 640 ? 1 : w < 1024 ? 2 : 3);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const maxInicio = Math.max(0, PLANOS.length - porTela);
  const [inicio, setInicio] = useState(0);

  // Mantém o card selecionado dentro da janela visível (e reclampa quando o
  // breakpoint muda). Selecionar um plano de fora da janela rola até ele.
  useEffect(() => {
    setInicio((s) => {
      const clamp = Math.min(Math.max(0, s), maxInicio);
      if (selecionadoIndex < clamp) return selecionadoIndex;
      if (selecionadoIndex > clamp + porTela - 1)
        return Math.min(selecionadoIndex - porTela + 1, maxInicio);
      return clamp;
    });
  }, [selecionadoIndex, porTela, maxInicio]);

  // Setas paginam por 'porTela'; no mobile (1 por tela) a seta também seleciona
  // o card que entra, pra o destaque acompanhar.
  const mover = (dir: number) => {
    const ns = Math.min(Math.max(0, inicio + dir * porTela), maxInicio);
    setInicio(ns);
    if (porTela === 1) onSelecionar(ns);
  };

  return (
    <div className="relative mx-auto max-w-[1044px] px-1 sm:px-2">
      {/* setas */}
      <button
        type="button"
        onClick={() => mover(-1)}
        disabled={inicio === 0}
        aria-label={t("Plano anterior")}
        className="absolute -left-1 top-1/2 z-40 flex h-[42px] w-[42px] -translate-y-1/2 items-center justify-center rounded-full disabled:opacity-[.35] sm:-left-3 sm:h-[46px] sm:w-[46px]"
        style={{ border: "1px solid var(--border-hover)", background: "var(--surface)", boxShadow: "var(--shadow-color) 0px 10px 24px -8px" }}
      >
        <ChevronLeft size={18} className="text-secondary" />
      </button>
      <button
        type="button"
        onClick={() => mover(1)}
        disabled={inicio >= maxInicio}
        aria-label={t("Próximo plano")}
        className="absolute -right-1 top-1/2 z-40 flex h-[42px] w-[42px] -translate-y-1/2 items-center justify-center rounded-full disabled:opacity-[.35] sm:-right-3 sm:h-[46px] sm:w-[46px]"
        style={{ border: "1px solid var(--border-hover)", background: "var(--surface)", boxShadow: "var(--shadow-color) 0px 10px 24px -8px" }}
      >
        <ChevronRight size={18} className="text-secondary" />
      </button>

      {/* viewport */}
      <div className="overflow-hidden px-1 pb-2 pt-5">
        <div
          className="flex items-start motion-safe:transition-transform motion-safe:duration-[350ms]"
          style={{ transform: `translateX(-${inicio * (100 / porTela)}%)` }}
        >
          {PLANOS.map((plano, gi) => {
            const sel = gi === selecionadoIndex;
            return (
              <div
                key={plano.id}
                className="box-border px-1.5 sm:px-2"
                style={{ flex: `0 0 ${100 / porTela}%` }}
              >
                <div
                  className="motion-safe:transition-[transform,opacity] motion-safe:duration-300"
                  style={{
                    transform: sel ? "scale(1)" : "scale(0.93)",
                    // no mobile só 1 card aparece — nunca apaga o visível
                    opacity: sel || porTela === 1 ? 1 : 0.55,
                    zIndex: sel ? 2 : 1,
                  }}
                >
                  <CardPlano
                    plano={plano}
                    ciclo={ciclo}
                    selecionado={sel}
                    onSelecionar={() => onSelecionar(gi)}
                    modo={modo}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* dots — um por plano */}
      <div className="mt-4 flex items-center justify-center gap-1.5">
        {PLANOS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelecionar(i)}
            aria-label={t(p.nome)}
            className="h-1.5 rounded-full motion-safe:transition-all"
            style={{
              width: i === selecionadoIndex ? 22 : 8,
              background:
                i === selecionadoIndex
                  ? "var(--brand)"
                  : "color-mix(in srgb, var(--text-primary) 18%, transparent)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
