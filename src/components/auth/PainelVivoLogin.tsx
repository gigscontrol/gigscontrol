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
      className="gcanim absolute z-[2] flex items-center gap-[9px] rounded-[11px] border border-[rgba(255,255,255,.12)] bg-surface px-3 py-[9px]"
      style={{
        boxShadow: "0 16px 34px -12px rgba(0,0,0,.8)",
        animation: anim,
        ...estilo,
      }}
    >
      <span
        className="flex h-6 w-6 flex-none items-center justify-center rounded-[7px]"
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
      className="overflow-hidden rounded-[14px] border border-[rgba(255,255,255,.09)] bg-[#0E121A]"
      style={{ boxShadow: "0 24px 55px -22px rgba(0,0,0,.8)" }}
    >
      {/* barra da janela */}
      <div className="flex h-[26px] items-center gap-[5px] border-b border-[rgba(255,255,255,.06)] bg-[#0B0F16] px-3">
        <span className="h-2 w-2 rounded-full bg-[#F5455C]" />
        <span className="h-2 w-2 rounded-full bg-[#F5A623]" />
        <span className="h-2 w-2 rounded-full bg-[#1F9E5A]" />
      </div>

      <div className="flex">
        {/* sidebar mini */}
        <div className="flex w-[104px] flex-none flex-col gap-[3px] border-r border-[rgba(255,255,255,.06)] px-2 py-2.5">
          {menu.map((item, i) => (
            <div
              key={item}
              className={`flex items-center gap-[7px] rounded-md px-[9px] py-1.5 ${
                i === 0 ? "bg-[#141A26]" : ""
              }`}
            >
              <span
                className={`rounded-full ${
                  i === 0 ? "h-[5px] w-[5px] bg-[#3D7BFF]" : "h-1 w-1 bg-[#3A4254]"
                }`}
                style={i === 0 ? { boxShadow: "0 0 6px #3D7BFF" } : undefined}
              />
              <span
                className={
                  i === 0
                    ? "text-[10px] font-semibold text-primary"
                    : "text-[10px] text-[#7A8296]"
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
            <span className="whitespace-nowrap rounded-md bg-[#3D7BFF] px-2.5 py-[5px] text-[9px] font-bold text-white">
              {t("+ Novo")}
            </span>
          </div>

          {/* métricas */}
          <div className="mb-2.5 flex gap-1.5">
            {metricas.map((m) => (
              <div
                key={m.rotulo}
                className="min-w-0 flex-1 rounded-lg border border-[rgba(255,255,255,.07)] bg-main px-2 py-2"
              >
                <div className="whitespace-nowrap font-mono text-[6.5px] font-semibold tracking-[.1em] text-[#5E6674]">
                  {t(m.rotulo)}
                </div>
                <div className="mt-1 font-display text-[15px] font-extrabold text-[#7DB0FF]">
                  {m.valor}
                </div>
              </div>
            ))}
          </div>

          {/* faturamento por mês */}
          <div className="mb-2 rounded-lg border border-[rgba(255,255,255,.06)] bg-main px-2.5 pb-2 pt-[9px]">
            <div className="mb-2 font-mono text-[6.5px] font-semibold tracking-[.1em] text-[#5E6674]">
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
                      ? "#3D7BFF"
                      : "rgba(61,123,255,.45)",
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
                  className="flex items-center gap-2 rounded-[7px] border border-[rgba(255,255,255,.06)] bg-main px-2.5 py-[7px]"
                >
                  <span className="h-2 w-2 flex-none rounded-full bg-[#3D7BFF]" />
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[9.5px] text-[#C6CCD8]">
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

export default function PainelVivoLogin() {
  const t = useT();
  return (
    <div
      className="flex h-full flex-col justify-between p-12 xl:p-[52px]"
      style={{
        background:
          "radial-gradient(130% 90% at 10% 0%, rgba(61,123,255,.12), rgba(11,13,18,0) 55%)",
      }}
    >
      <Link href="/" className="w-fit">
        <LogoGC size={24} variant="gradient" withWordmark />
      </Link>

      <div>
        <h2 className="font-display text-3xl font-extrabold leading-[1.08] tracking-[-0.03em]">
          {t("A operação da sua")}{" "}
          <span className="bg-grad-signal bg-clip-text text-transparent">
            {t("agência musical")}
          </span>
          <br />
          {t("em um só lugar")}
        </h2>
        <p className="mt-2.5 max-w-[400px] text-[13.5px] leading-[1.55] text-secondary">
          {t(
            "Entre e acompanhe shows, orçamentos, contratos e cachês em tempo real."
          )}
        </p>

        {/* mini-dashboard + notificações flutuando */}
        <div className="relative mt-[30px] max-w-[460px]">
          <MiniDashboard />

          <Notificacao
            estilo={{ top: -16, left: -20 }}
            anim="gcFloat 6s ease-in-out infinite"
            corIcone="#1F9E5A"
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
            estilo={{ top: "26%", right: -24 }}
            anim="gcFloat 7s ease-in-out -2.5s infinite"
            corIcone="#3D7BFF"
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
            estilo={{ bottom: "16%", left: -26 }}
            anim="gcFloat 7.5s ease-in-out -1.2s infinite"
            corIcone="#1F9E5A"
            icone={<path d="M5 12l5 5L20 6" />}
            titulo={t("Parcela recebida")}
            detalhe={t("cachê em dia")}
          />
          <Notificacao
            estilo={{ bottom: -16, right: -14 }}
            anim="gcFloat 8s ease-in-out -4s infinite"
            corIcone="#3D7BFF"
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

      <div className="mt-[26px] font-mono text-[10px] text-[#4E545E]">
        © {new Date().getFullYear()} GIGS CONTROL — {t("GESTÃO PARA A MÚSICA")}
      </div>
    </div>
  );
}
