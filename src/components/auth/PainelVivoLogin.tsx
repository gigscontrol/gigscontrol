"use client";

/**
 * Painel vivo do login (tela 07 do guia).
 *
 * À esquerda do form: título + copy curta + MINI-DASHBOARD "Visão geral"
 * (janelinha do app com sidebar, 4 métricas, faturamento por mês e 2 linhas
 * de atividade) com 4 NOTIFICAÇÕES flutuando em volta — contrato assinado,
 * voo importado do voucher, parcela recebida e show confirmado — cada uma
 * com float de 6–8s dessincronizado (gcFloat, em redesign.css).
 */

import Link from "next/link";
import LogoGC from "@/components/LogoGC";
import { useMoeda, useT } from "@/lib/i18n";
import "@/components/landing/redesign.css";

/* métricas do mockup */
const BARRAS = [16, 24, 14, 30, 18, 34, 22, 30];
const BARRAS_CHEIAS = new Set([3, 5, 7]); // índices em azul sólido

function Notificacao({
  estilo,
  anim,
  corIcone,
  icone,
  titulo,
  detalhe,
}: {
  estilo: React.CSSProperties;
  anim: string;
  corIcone: string;
  icone: React.ReactNode;
  titulo: string;
  detalhe: string;
}) {
  return (
    <div
      className="gcanim absolute z-[2] flex items-center gap-[9px] rounded border border-[var(--border-strong)] bg-surface px-3 py-[9px]"
      style={{
        boxShadow: "0 16px 34px -12px var(--shadow-color-strong)",
        animation: anim,
        ...estilo,
      }}
    >
      <span
        className="flex h-6 w-6 flex-none items-center justify-center rounded-chip"
        style={{ backgroundColor: corIcone }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          style={{ width: 13, height: 13 }}
          aria-hidden
        >
          {icone}
        </svg>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="whitespace-nowrap text-[10.5px] font-bold text-primary">
          {titulo}
        </span>
        <span className="whitespace-nowrap font-mono text-[8px] font-medium text-muted">
          {detalhe}
        </span>
      </span>
    </div>
  );
}

function MiniDashboard() {
  const t = useT();
  const moeda = useMoeda();

  const metricas = [
    { rotulo: "SHOWS NO MÊS", valor: "24" },
    { rotulo: "ORÇAMENTOS", valor: "18" },
    { rotulo: "A RECEBER", valor: moeda === "usd" ? "$32k" : "R$ 86k" },
    { rotulo: "CONTRATADOS", valor: "42" },
  ];

  const menu = ["Agenda", "Vendas", "Financeiro", "Contratos", "Contatos"];

  return (
    <div
      className="overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--text-primary)_9%,transparent)] bg-[var(--mock-window)]"
      style={{ boxShadow: "0 24px 55px -22px var(--shadow-color-strong)" }}
    >
      {/* barra da janela */}
      <div className="flex h-[26px] items-center gap-[5px] border-b border-[var(--hairline)] bg-[var(--mock-chrome)] px-3">
        <span className="h-2 w-2 rounded-full bg-[var(--danger)]" />
        <span className="h-2 w-2 rounded-full bg-[var(--warning)]" />
        <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
      </div>

      <div className="flex">
        {/* sidebar mini */}
        <div className="flex w-[104px] flex-none flex-col gap-[3px] border-r border-[var(--hairline)] px-2 py-2.5">
          {menu.map((item, i) => (
            <div
              key={item}
              className={`flex items-center gap-[7px] rounded-md px-[9px] py-1.5 ${
                i === 0 ? "bg-[var(--mock-active)]" : ""
              }`}
            >
              <span
                className={`rounded-full ${
                  i === 0 ? "h-[5px] w-[5px] bg-[var(--brand)]" : "h-1 w-1 bg-[var(--mock-dot)]"
                }`}
                style={i === 0 ? { boxShadow: "0 0 6px var(--brand)" } : undefined}
              />
              <span
                className={
                  i === 0
                    ? "text-[10px] font-semibold text-primary"
                    : "text-[10px] text-[var(--text-dim)]"
                }
              >
                {t(item)}
              </span>
            </div>
          ))}
        </div>

        {/* conteúdo */}
        <div className="min-w-0 flex-1 px-3.5 py-3">
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <div className="text-[12.5px] font-bold text-primary">
                {t("Visão geral")}
              </div>
              <div className="mt-0.5 text-[8.5px] text-muted">
                {t("Resumo da operação")}
              </div>
            </div>
            <span className="whitespace-nowrap rounded-md bg-[var(--brand)] px-2.5 py-[5px] text-[9px] font-bold text-white">
              {t("+ Novo")}
            </span>
          </div>

          {/* métricas */}
          <div className="mb-2.5 flex gap-1.5">
            {metricas.map((m) => (
              <div
                key={m.rotulo}
                className="min-w-0 flex-1 rounded-lg border border-[color-mix(in_srgb,var(--text-primary)_7%,transparent)] bg-main px-2 py-2"
              >
                <div className="whitespace-nowrap font-mono text-[6.5px] font-semibold tracking-[.1em] text-[var(--text-label)]">
                  {t(m.rotulo)}
                </div>
                <div className="mt-1 font-display text-[15px] font-extrabold text-[var(--brand-ink)]">
                  {m.valor}
                </div>
              </div>
            ))}
          </div>

          {/* faturamento por mês */}
          <div className="mb-2 rounded-lg border border-[var(--hairline)] bg-main px-2.5 pb-2 pt-[9px]">
            <div className="mb-2 font-mono text-[6.5px] font-semibold tracking-[.1em] text-[var(--text-label)]">
              {t("FATURAMENTO POR MÊS")}
            </div>
            <div className="flex h-[34px] items-end gap-[5px]">
              {BARRAS.map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: h,
                    borderRadius: "4px 4px 2px 2px",
                    background: BARRAS_CHEIAS.has(i)
                      ? "var(--brand)"
                      : "color-mix(in srgb, var(--brand) 45%, transparent)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* atividade */}
          <div className="flex flex-col gap-[5px]">
            {["Show — CZ · São Paulo", "Orçamento — Dudu · Curitiba"].map(
              (linha) => (
                <div
                  key={linha}
                  className="flex items-center gap-2 rounded-chip border border-[var(--hairline)] bg-main px-2.5 py-[7px]"
                >
                  <span className="h-2 w-2 flex-none rounded-full bg-[var(--brand)]" />
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[9.5px] text-[var(--text-soft)]">
                    {linha}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PainelVivoLogin({
  comNavExterna = false,
}: {
  /** Esconde o logo próprio quando a página já tem nav de topo (evita 2 logos). */
  comNavExterna?: boolean;
}) {
  const t = useT();
  return (
    <div
      className="relative flex h-full flex-col px-12 xl:px-[52px]"
      style={{
        background:
          "radial-gradient(130% 90% at 10% 0%, var(--glow-hero), var(--glow-fade) 55%)",
      }}
    >
      {/* barra do logo — espelha a topbar (h-16) do lado do form pra alinhar
          o eixo vertical das duas colunas. logo 30, leva pra página inicial.
          Escondida quando a nav externa já tem o logo. */}
      {!comNavExterna && (
        <div className="flex h-16 items-center">
          <Link href="/" className="w-fit" aria-label="Gigs Control — página inicial">
            <LogoGC size={30} variant="gradient" withWordmark />
          </Link>
        </div>
      )}

      {/* região central — mesma estrutura (flex-1 + py-10) da coluna do form.
          O bloco tem min-height igual à do card de login: copy no topo
          (verde) e o dashboard PREENCHENDO o resto, centralizado, com folga
          igual em cima/embaixo (vermelho). */}
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="flex min-h-[608px] w-full max-w-[560px] flex-col">
          {/* copy — MESMA altura do bloco título+OAuth+divisor do form
              (263px: do "Entrar na conta" até o "OU COM EMAIL"), pra que o
              dashboard abaixo comece exatamente onde começa o card de e-mail */}
          <div className="h-[263px] flex-none">
            <h2 className="font-display text-[34px] font-extrabold leading-[1.08] tracking-[-0.03em] xl:text-[38px]">
              {t("A operação da sua")}{" "}
              <span className="bg-grad-signal bg-clip-text text-transparent">
                {t("agência musical")}
              </span>
              <br />
              {t("em um só lugar")}
            </h2>
            <p className="mt-3 max-w-[460px] text-[15px] leading-[1.55] text-secondary">
              {t(
                "Entre e acompanhe shows, orçamentos, contratos e cachês em tempo real."
              )}
            </p>
          </div>

          {/* dashboard + notificações — preenche EXATAMENTE a faixa do card
              de e-mail do form (do "OU COM EMAIL" ao rodapé do card) */}
          <div className="flex flex-1 items-center justify-center">
          <div
            className="relative w-full"
            style={{ transform: "scale(1.135)", transformOrigin: "center" }}
          >
          <MiniDashboard />

          <Notificacao
            estilo={{ top: -14, left: -8 }}
            anim="gcFloat 6s ease-in-out infinite"
            corIcone="var(--success)"
            icone={
              <>
                <path d="M7 3h7l4 4v14H7z" />
                <path d="M9 13l2 2 4-4" />
              </>
            }
            titulo={t("Contrato assinado")}
            detalhe={t("agora mesmo, pelo celular")}
          />
          <Notificacao
            estilo={{ top: "26%", right: -10 }}
            anim="gcFloat 7s ease-in-out -2.5s infinite"
            corIcone="var(--brand)"
            icone={
              <>
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4z" />
              </>
            }
            titulo={t("Voo importado do voucher")}
            detalhe={t("PDF lido pela IA")}
          />
          <Notificacao
            estilo={{ bottom: "16%", left: -10 }}
            anim="gcFloat 7.5s ease-in-out -1.2s infinite"
            corIcone="var(--success)"
            icone={<path d="M5 12l5 5L20 6" />}
            titulo={t("Parcela recebida")}
            detalhe={t("cachê em dia")}
          />
          <Notificacao
            estilo={{ bottom: -14, right: -6 }}
            anim="gcFloat 8s ease-in-out -4s infinite"
            corIcone="var(--brand)"
            icone={
              <>
                <rect x="4" y="6" width="16" height="14" rx="2" />
                <path d="M8 3v4M16 3v4M4 11h16" />
              </>
            }
            titulo={t("Show confirmado")}
            detalhe={t("sábado · 22h")}
          />
          </div>
          </div>
        </div>
      </div>

      {/* rodapé fixo no canto inferior (fora do fluxo central) */}
      <div className="absolute bottom-8 left-12 font-mono text-[10px] text-[var(--text-disabled)] xl:left-[52px]">
        © {new Date().getFullYear()} GIGS CONTROL — {t("GESTÃO PARA A MÚSICA")}
      </div>
    </div>
  );
}
