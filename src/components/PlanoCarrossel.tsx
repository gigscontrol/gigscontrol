"use client";

import { useEffect, useState } from "react";
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
}: {
  plano: Plano;
  ciclo: CicloCobranca;
  selecionado: boolean;
  onSelecionar: () => void;
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
          ? "linear-gradient(180deg, rgba(61,123,255,.12), #0E121A 44%)"
          : "#0E121A",
        border: selecionado
          ? "1px solid rgba(61,123,255,.6)"
          : "1px solid rgba(255,255,255,.08)",
        boxShadow: selecionado
          ? "rgba(61,123,255,.55) 0px 18px 50px -20px"
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

      {/* CTA selecionar */}
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
            : { backgroundColor: "transparent", border: "1px solid rgba(255,255,255,.14)", color: "var(--text-primary)" }
        }
      >
        {selecionado && <Check size={14} strokeWidth={3} />}
        {selecionado ? t("Selecionado") : t("Selecionar")}
      </button>

      {/* Admin / Artistas / Equipe */}
      <div className="grid grid-cols-3 gap-2">
        {stats.map((b, i) => (
          <div
            key={i}
            className="rounded-[9px] px-2 py-2.5 text-center"
            style={{ background: "#0B0D12", border: "1px solid rgba(255,255,255,.07)" }}
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

      <div className="h-px" style={{ background: "rgba(255,255,255,.06)" }} />

      {/* recursos visíveis */}
      <div className="flex flex-col gap-2.5">
        {recursosVisiveis(plano).map((r) => (
          <LinhaRecurso key={r} texto={r} />
        ))}
      </div>

      {/* Ver mais recursos (acordeão) */}
      <div className="border-t pt-3" style={{ borderColor: "rgba(255,255,255,.06)" }}>
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
}: {
  ciclo: CicloCobranca;
  selecionadoIndex: number;
  onSelecionar: (i: number) => void;
}) {
  const t = useT();
  // Páginas de 3 (essenciais / agências). Cada página ocupa 100% do viewport;
  // o track translada -pagina*100% (viewport-relativo — não track-relativo).
  const paginas: Plano[][] = [];
  for (let i = 0; i < PLANOS.length; i += 3) paginas.push(PLANOS.slice(i, i + 3));
  const numPaginas = paginas.length;
  const [pagina, setPagina] = useState(Math.floor(selecionadoIndex / 3));

  // Selecionar um plano de outra página traz a página dele.
  useEffect(() => {
    setPagina(Math.floor(selecionadoIndex / 3));
  }, [selecionadoIndex]);

  return (
    <div className="relative mx-auto max-w-[1044px] px-1 sm:px-2">
      {/* setas */}
      <button
        type="button"
        onClick={() => setPagina((p) => Math.max(0, p - 1))}
        disabled={pagina === 0}
        aria-label={t("Plano anterior")}
        className="absolute -left-3 top-1/2 z-40 flex h-[46px] w-[46px] -translate-y-1/2 items-center justify-center rounded-full disabled:opacity-[.35]"
        style={{ border: "1px solid rgba(255,255,255,.14)", background: "var(--surface)", boxShadow: "rgba(0,0,0,.6) 0px 10px 24px -8px" }}
      >
        <ChevronLeft size={18} className="text-secondary" />
      </button>
      <button
        type="button"
        onClick={() => setPagina((p) => Math.min(numPaginas - 1, p + 1))}
        disabled={pagina === numPaginas - 1}
        aria-label={t("Próximo plano")}
        className="absolute -right-3 top-1/2 z-40 flex h-[46px] w-[46px] -translate-y-1/2 items-center justify-center rounded-full disabled:opacity-[.35]"
        style={{ border: "1px solid rgba(255,255,255,.14)", background: "var(--surface)", boxShadow: "rgba(0,0,0,.6) 0px 10px 24px -8px" }}
      >
        <ChevronRight size={18} className="text-secondary" />
      </button>

      {/* viewport */}
      <div className="overflow-hidden px-1 pb-2 pt-5">
        <div
          className="flex motion-safe:transition-transform motion-safe:duration-[350ms]"
          style={{ transform: `translateX(-${pagina * 100}%)` }}
        >
          {paginas.map((cards, pi) => (
            <div
              key={pi}
              className="grid grid-cols-3 items-start gap-4"
              style={{ flex: "0 0 100%" }}
            >
              {cards.map((plano) => {
                const gi = PLANOS.indexOf(plano);
                const sel = gi === selecionadoIndex;
                return (
                  <div
                    key={plano.id}
                    className="motion-safe:transition-[transform,opacity] motion-safe:duration-300"
                    style={{
                      transform: sel ? "scale(1)" : "scale(0.93)",
                      opacity: sel ? 1 : 0.55,
                      zIndex: sel ? 2 : 1,
                    }}
                  >
                    <CardPlano
                      plano={plano}
                      ciclo={ciclo}
                      selecionado={sel}
                      onSelecionar={() => onSelecionar(gi)}
                    />
                  </div>
                );
              })}
            </div>
          ))}
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
              background: i === selecionadoIndex ? "var(--brand)" : "rgba(255,255,255,.18)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
