"use client";

/**
 * Seção "Um plano para cada operação" (tela 13 do guia).
 *
 * Toggle Mensal/Anual (mensal é o padrão; anual com desconto de até 17%) +
 * carrossel com 3 cards por
 * página, setas laterais e dots: página 1 = Individual/Equipe/Time
 * ("Essenciais"), página 2 = Agência/Agência Plus/Agência Max. Valores REAIS
 * de src/lib/planos.ts, na moeda da região (BRL/USD). Equipe = "Mais
 * popular". Fecha com a faixa "mais de 50 artistas → Fale com a gente".
 *
 * No mobile o carrossel vira scroll nativo com snap (ver redesign.css).
 */

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useMoeda, useT } from "@/lib/i18n";
import {
  PLANOS,
  type CicloCobranca,
  type Plano,
  descontoAnualPct,
  formatarPreco,
  formatarPrecoCurto,
  precoPorMes,
  totalAnual,
  totalUsuarios,
  valorMensal,
} from "@/lib/planos";

/**
 * Na landing global o canal é e-mail — o recurso "Orçamento por WhatsApp"
 * (dado do plano) vira a versão neutra de canal, só aqui.
 */
function rotuloRecurso(r: string): string {
  return r === "Orçamento por WhatsApp" ? "Orçamento pronto pra enviar" : r;
}

function CardPlano({ plano, ciclo }: { plano: Plano; ciclo: CicloCobranca }) {
  const t = useT();
  const moeda = useMoeda();
  const preco = precoPorMes(plano, ciclo, moeda);
  const desconto = descontoAnualPct(plano);

  return (
    <div
      className="relative box-border flex flex-col gap-[15px] rounded-[14px] px-[22px] py-[26px]"
      style={{
        flex: "0 0 calc((100% - 32px) / 3)",
        ...(plano.destaque
          ? {
              background:
                "linear-gradient(180deg, rgba(61,123,255,.12), #0E121A 42%)",
              border: "1px solid rgba(61,123,255,.5)",
              boxShadow: "0 0 46px -18px rgba(61,123,255,.6)",
            }
          : {
              background: "#0E121A",
              border: "1px solid rgba(255,255,255,.08)",
            }),
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

      <div>
        <div className="font-display text-lg font-extrabold tracking-[-0.01em] text-primary">
          {plano.nome}
        </div>
        <div className="mt-1 min-h-[34px] text-[12.5px] leading-[1.35] text-[#8B93A5]">
          {t(plano.tagline)}
        </div>
      </div>

      {/* preço */}
      <div>
        <div className="flex items-end gap-[5px]">
          <span className="font-display text-[33px] font-extrabold leading-none tracking-[-0.03em] text-primary tabular-nums">
            {formatarPreco(preco, moeda)}
          </span>
          <span className="mb-1 font-mono text-[11px] font-semibold text-muted">
            {t("/mês")}
          </span>
        </div>
        {ciclo === "anual" ? (
          <>
            <div className="mt-1.5 text-[11.5px] text-muted">
              {t("no mensal")}{" "}
              <span className="line-through tabular-nums">
                {formatarPreco(valorMensal(plano, moeda), moeda)}
                {t("/mês")}
              </span>
            </div>
            <div className="mt-[3px] text-[11.5px] text-[#3CE08C]">
              {t("Economize {pct}%", { pct: desconto })}{" "}
              <span className="text-[#8B93A5]">
                · {formatarPrecoCurto(totalAnual(plano, moeda), moeda)}{" "}
                {t("cobrados no ano")}
              </span>
            </div>
          </>
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

      <Link
        href={`/signup?plano=${plano.id}&ciclo=${ciclo}`}
        className="rounded-[10px] py-3 text-center text-[13.5px] font-bold"
        style={
          plano.destaque
            ? {
                backgroundColor: "var(--brand)",
                border: "1px solid var(--brand)",
                color: "#fff",
              }
            : {
                backgroundColor: "var(--bg-surface)",
                border: "1px solid rgba(255,255,255,.12)",
                color: "var(--text-primary)",
              }
        }
      >
        {t("Assinar")}
      </Link>

      {/* limites */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-[10px] border border-[rgba(255,255,255,.07)] bg-main px-3 py-2.5 text-center">
          <div className="font-display text-[22px] font-extrabold leading-none text-primary">
            {plano.maxArtistas}
          </div>
          <div className="mt-[5px] font-mono text-[8.5px] font-semibold tracking-[.12em] text-muted">
            {t("ARTISTAS")}
          </div>
        </div>
        <div className="flex-1 rounded-[10px] border border-[rgba(255,255,255,.07)] bg-main px-3 py-2.5 text-center">
          <div className="font-display text-[22px] font-extrabold leading-none text-primary">
            {totalUsuarios(plano)}
          </div>
          <div className="mt-[5px] font-mono text-[8.5px] font-semibold tracking-[.12em] text-muted">
            {t("USUÁRIOS")}
          </div>
        </div>
      </div>
      <div className="-mt-1.5 text-center text-[11px] text-muted">
        1 admin + {plano.maxArtistas}{" "}
        {plano.maxArtistas === 1 ? t("artista") : t("artistas")} +{" "}
        {plano.maxUsuariosAdicionais} {t("adicionais")}
      </div>

      <div className="h-px bg-[rgba(255,255,255,.06)]" />

      {/* recursos (pula os 2 primeiros — já estão nos cartões de limite) */}
      <div className="flex flex-col gap-2.5">
        {plano.recursos.slice(2).map((r) => (
          <div
            key={r}
            className="flex items-start gap-[9px] text-[12.5px] leading-[1.4] text-[#C6CCD8]"
          >
            <Check
              size={14}
              strokeWidth={2.4}
              className="mt-px flex-none"
              style={{ color: "#5B93FF" }}
            />
            <span>{t(rotuloRecurso(r))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlanosCarrossel() {
  const t = useT();
  const [ciclo, setCiclo] = useState<CicloCobranca>("mensal");
  const [pagina, setPagina] = useState(0);

  return (
    <section
      id="planos"
      className="border-t border-[rgba(255,255,255,.06)] px-6 pb-[60px] pt-14 sm:px-12"
    >
      <h2 className="gcrv mb-2 text-center font-display text-[30px] font-extrabold tracking-[-0.02em] text-primary md:text-[34px]">
        {t("Um plano para cada operação")}
      </h2>
      <p
        className="gcrv mx-auto mb-6 max-w-[640px] text-center text-[15px] leading-normal text-secondary"
        style={{ transitionDelay: "90ms" }}
      >
        {t(
          "Do artista que gere a própria carreira à agência com 50 nomes. Todos os planos incluem agenda, vendas, financeiro e contatos."
        )}
      </p>

      {/* toggle mensal/anual */}
      <div className="mb-[26px] flex flex-col items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-[10px] border border-[rgba(255,255,255,.1)] bg-surface p-1">
          <button
            type="button"
            onClick={() => setCiclo("mensal")}
            className="rounded-[7px] px-[18px] py-2 text-[12.5px] font-semibold transition-colors"
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
            className="inline-flex items-center gap-[7px] rounded-[7px] px-[18px] py-2 text-[12.5px] font-bold transition-colors"
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
        <div className="text-[11.5px] text-[#5E6674]">
          {t("Planos anuais são cobrados uma vez ao ano. Preço exibido por mês.")}
        </div>
      </div>

      {/* carrossel */}
      <div className="gcrv relative mx-auto max-w-[1044px]">
        <button
          type="button"
          onClick={() => setPagina(0)}
          disabled={pagina === 0}
          aria-label={t("Planos anteriores")}
          className="gcparr absolute -left-4 top-[290px] z-[3] flex h-[42px] w-[42px] items-center justify-center rounded-full border border-[rgba(255,255,255,.14)] bg-surface disabled:opacity-35"
          style={{ boxShadow: "0 10px 24px -8px rgba(0,0,0,.6)" }}
        >
          <ChevronLeft size={16} strokeWidth={2.4} className="text-[#C6CCD8]" />
        </button>
        <button
          type="button"
          onClick={() => setPagina(1)}
          disabled={pagina === 1}
          aria-label={t("Próximos planos")}
          className="gcparr absolute -right-4 top-[290px] z-[3] flex h-[42px] w-[42px] items-center justify-center rounded-full border border-[rgba(255,255,255,.14)] bg-surface disabled:opacity-35"
          style={{ boxShadow: "0 10px 24px -8px rgba(0,0,0,.6)" }}
        >
          <ChevronRight size={16} strokeWidth={2.4} className="text-[#C6CCD8]" />
        </button>

        <div className="gcpviewport overflow-hidden px-0 pb-2 pt-3.5">
          <div className={`gcptrack ${pagina === 1 ? "gcpg1" : ""}`}>
            {PLANOS.map((plano) => (
              <CardPlano key={plano.id} plano={plano} ciclo={ciclo} />
            ))}
          </div>
        </div>

        {/* dots + legenda das páginas */}
        <div className="gcpdots mt-[18px] flex items-center justify-center gap-2">
          {[0, 1].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPagina(p)}
              aria-label={p === 0 ? t("Planos essenciais") : t("Planos de agência")}
              className="h-1.5 w-[22px] rounded-[3px] transition-colors"
              style={{
                background:
                  pagina === p ? "var(--brand)" : "rgba(255,255,255,.18)",
              }}
            />
          ))}
        </div>
        <div className="gcpdots mt-2.5 text-center font-mono text-[9px] font-semibold tracking-[.14em] text-[#5E6674]">
          {t("ESSENCIAIS · AGÊNCIAS →")}
        </div>
      </div>

      {/* faixa 50+ artistas */}
      <div
        className="gcrv mx-auto mt-[26px] flex max-w-[1044px] flex-wrap items-center gap-5 rounded-[14px] border border-[rgba(61,123,255,.28)] px-[26px] py-[22px]"
        style={{
          background:
            "linear-gradient(120deg, rgba(61,123,255,.1), rgba(20,26,45,.35))",
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
          className="whitespace-nowrap rounded-[10px] px-[22px] py-3 text-[13.5px] font-bold text-white"
          style={{ backgroundColor: "var(--brand)" }}
        >
          {t("Fale com a gente")}
        </a>
      </div>
    </section>
  );
}
