"use client";

/**
 * Seção "02 · Se organiza pra vender" (tela 13 do guia): calendário VIVO.
 *
 * Mês, ano, grade e dia-da-semana vêm do RELÓGIO DO SERVIDOR (props ano/mes,
 * lidas em src/app/page.tsx — server component). Os eventos moram em dias
 * fixos do mês (1, 3, 4, 7, 9, 11, 15, 17, 23, 24, 27, 30) e os popups sobem
 * em sequência num loop de 30s (gcE1-12) enquanto o dia acende junto, na
 * mesma cor (gcD1-12).
 *
 * Posição de cada popup é calculada da CÉLULA real do dia no mês corrente:
 * seg/ter/qua → popup à esquerda do calendário; qui/sex/sáb/dom → à direita;
 * a altura segue a linha da grade (com um degrau de 12px quando dois popups
 * dividem o mesmo lado da mesma linha).
 */

import { useMoeda, useT } from "@/lib/i18n";
import { BadgeSecao, ChecksSecao, CtasSecao, Grad } from "./blocos";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const DIAS_SEMANA = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

const AZUL = "rgba(61,123,255,.5)";
const AMBAR = "rgba(245,166,35,.55)";
const VERDE = "rgba(31,158,90,.55)";

type TipoEvento = "orcamento" | "show" | "alta" | "cache" | "venda" | "contrato";

type Evento = {
  dia: number;
  tipo: TipoEvento;
  /** linhas extras do popup (código, casa, horário, valor…) */
  extra?: string[];
  /** valor em milhar — formatado conforme a moeda da região */
  valor?: number;
};

const EVENTOS: Evento[] = [
  { dia: 1, tipo: "orcamento", extra: ["ORC-0227"] },
  { dia: 3, tipo: "show", extra: ["Formatura Mackenzie", "01:00 – 02:00"] },
  { dia: 4, tipo: "alta" },
  { dia: 7, tipo: "orcamento", extra: ["ORC-0231"] },
  { dia: 9, tipo: "cache", valor: 16500 },
  { dia: 11, tipo: "show", extra: ["D-EDGE", "03:00 – 05:00"] },
  { dia: 15, tipo: "venda", valor: 14000 },
  { dia: 17, tipo: "show", extra: ["Vila JK", "01:30 – 02:30"] },
  { dia: 23, tipo: "contrato", extra: ["CTR-0231"] },
  { dia: 24, tipo: "alta" },
  { dia: 27, tipo: "cache", valor: 12500 },
  { dia: 30, tipo: "venda", valor: 11000 },
];

/** Cor da borda da célula/popup por tipo. */
function corDoTipo(tipo: TipoEvento): string {
  if (tipo === "alta") return AMBAR;
  if (tipo === "cache") return VERDE;
  return AZUL;
}

const TITULOS: Record<TipoEvento, string> = {
  orcamento: "Orçamento enviado",
  show: "Show confirmado",
  alta: "ALTA PROCURA",
  cache: "Cachê recebido",
  venda: "Venda gerada",
  contrato: "Contrato assinado",
};

/** Ícone do popup, no estilo do tipo (caixa suave ou sólida). */
function IconeEvento({ tipo }: { tipo: TipoEvento }) {
  const caixa = "flex h-[19px] w-[19px] flex-none items-center justify-center rounded-[5px]";
  const svg = (stroke: string, sw: number, filhos: React.ReactNode) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      style={{ width: 11, height: 11 }}
      aria-hidden
    >
      {filhos}
    </svg>
  );
  switch (tipo) {
    case "orcamento":
      return (
        <span
          className={caixa}
          style={{
            background: "rgba(61,123,255,.14)",
            border: "1px solid rgba(61,123,255,.3)",
          }}
        >
          {svg("#5B93FF", 2, (
            <>
              <path d="M7 3h7l4 4v14H7z" />
              <path d="M10 12h5M10 16h5" />
            </>
          ))}
        </span>
      );
    case "show":
      return (
        <span className={caixa} style={{ background: "#3D7BFF" }}>
          {svg("#fff", 2, (
            <>
              <path d="M9 18V6l10-2v12" />
              <circle cx="6.5" cy="18" r="2.5" />
              <circle cx="16.5" cy="16" r="2.5" />
            </>
          ))}
        </span>
      );
    case "alta":
      return (
        <span
          className={caixa}
          style={{
            background: "rgba(245,166,35,.14)",
            border: "1px solid rgba(245,166,35,.3)",
          }}
        >
          {svg("#F5A623", 2, (
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
          ))}
        </span>
      );
    case "cache":
      return (
        <span className={caixa} style={{ background: "#1F9E5A" }}>
          {svg("#fff", 2.6, <path d="M5 12l5 5L20 6" />)}
        </span>
      );
    case "venda":
      return (
        <span className={caixa} style={{ background: "#3D7BFF" }}>
          {svg("#fff", 2, (
            <>
              <path d="M20.6 13.4L11 3.8H4v7l9.6 9.6a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8z" />
              <circle cx="7.5" cy="7.3" r="1.3" />
            </>
          ))}
        </span>
      );
    case "contrato":
      return (
        <span className={caixa} style={{ background: "#3D7BFF" }}>
          {svg("#fff", 2, (
            <>
              <path d="M7 3h7l4 4v14H7z" />
              <path d="M9 13l2 2 4-4" />
            </>
          ))}
        </span>
      );
  }
}

/** Offsets horizontais do popup por coluna da grade (colado na célula). */
const MARGEM_ESQUERDA = [138, 95, 52]; // seg · ter · qua  → lado esquerdo
const MARGEM_DIREITA = [48, 91, 133, 176]; // qui · sex · sáb · dom → lado direito

export default function CalendarioVivo({ ano, mes }: { ano: number; mes: number }) {
  const t = useT();
  const moeda = useMoeda();

  // Grade do mês corrente (segunda-feira primeiro, como no app)
  const off = (new Date(ano, mes, 1).getDay() + 6) % 7;
  const dim = new Date(ano, mes + 1, 0).getDate();

  const fmtValor = (v: number) =>
    moeda === "usd"
      ? `$${v.toLocaleString("en-US")}`
      : `R$ ${v.toLocaleString("pt-BR")}`;

  // Posições dos popups no mês corrente + rótulo de dia-da-semana
  const contagemLado: Record<string, number> = {};
  const eventos = EVENTOS.map((ev, i) => {
    const dia = Math.min(ev.dia, dim);
    const idx = off + dia - 1;
    const linha = Math.floor(idx / 7);
    const coluna = idx % 7; // 0 = segunda
    const esquerda = coluna <= 2;
    const chave = `${esquerda ? "e" : "d"}${linha}`;
    const degrau = (contagemLado[chave] ?? 0) * 12;
    contagemLado[chave] = (contagemLado[chave] ?? 0) + 1;
    return {
      ...ev,
      dia,
      seq: i + 1,
      esquerda,
      top: -68 + linha * 28 + degrau,
      margem: esquerda
        ? MARGEM_ESQUERDA[coluna]
        : MARGEM_DIREITA[coluna - 3] ?? 176,
      rotulo: `${t(DIAS_SEMANA[coluna])} ${String(dia).padStart(2, "0")}`,
    };
  });

  const diasComEvento = new Map(eventos.map((e) => [e.dia, e]));

  return (
    <section
      id="recursos"
      className="grid scroll-mt-[72px] items-center gap-6 border-t border-[rgba(255,255,255,.06)] px-6 pb-[54px] pt-12 sm:px-12 lg:min-h-dvh lg:grid-cols-[1.05fr_1fr] lg:py-6"
      style={{
        background:
          "radial-gradient(70% 90% at 78% 30%, rgba(61,123,255,.12), rgba(11,13,18,0) 60%)",
      }}
    >
      {/* copy — desliza da esquerda ao entrar no viewport. Como aqui a copy
          é a coluna ESQUERDA, o bloco encosta no CENTRO (ml-auto), espelhando
          o recuo do 01/03 — e não fica grudado na borda da página. */}
      <div className="gcrv-l flex flex-col justify-center">
        <div className="flex flex-col gap-[22px] lg:ml-auto lg:w-fit">
          <BadgeSecao>{t("02 · Se organiza pra vender")}</BadgeSecao>
          <h2 className="font-display text-4xl font-extrabold leading-[1.06] tracking-[-0.03em] md:text-[40px] xl:text-[46px]">
            {t("Uma agenda")} <Grad>{t("inteligente")}</Grad>
            <br />
            {t("para quem vive de eventos.")}
          </h2>
          <p className="max-w-[470px] text-[15px] leading-[1.6] text-secondary xl:text-base">
            {t(
              "Crie, acompanhe e organize shows, negociações, envios de propostas, contratos e compromissos em um calendário completo. Tudo organizado para que nenhuma oportunidade passe despercebida."
            )}
          </p>
          <CtasSecao />
          <ChecksSecao
            itens={[
              "Agenda inteligente e completa",
              "Orçamentos e vendas em um só lugar",
              "Financeiro detalhado em tempo real",
            ]}
          />
        </div>
      </div>

      {/* calendário + popups — desliza da direita ao entrar no viewport */}
      <div
        className="gcrv-r relative min-h-[480px] overflow-hidden"
        style={{ transitionDelay: "120ms" }}
      >
        <div className="gcvis-scale absolute inset-0">
          {/* cartão do calendário, centrado */}
          <div
            className="absolute left-1/2 top-1/2 w-[292px] rounded-[14px] border border-[rgba(255,255,255,.1)] bg-surface px-[18px] pb-3.5 pt-[18px]"
            style={{
              margin: "-112px 0 0 -146px",
              boxShadow: "0 24px 50px -18px rgba(0,0,0,.75)",
            }}
          >
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="font-display text-[15px] font-extrabold text-primary">
                {t(MESES[mes])}
              </span>
              <span className="font-mono text-[9.5px] font-semibold tracking-[.1em] text-muted">
                {ano}
              </span>
            </div>
            <div className="mb-[5px] grid grid-cols-7 gap-1">
              {DIAS_SEMANA.map((d, i) => (
                <span
                  key={i}
                  className="text-center font-mono text-[8px] font-semibold text-[#5E6470]"
                >
                  {t(d).charAt(0)}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: off }).map((_, i) => (
                <span key={`v${i}`} className="calE" />
              ))}
              {Array.from({ length: dim }).map((_, i) => {
                const dia = i + 1;
                const ev = diasComEvento.get(dia);
                return (
                  <span
                    key={dia}
                    className={`calD ${ev ? "gcanim" : ""}`}
                    style={
                      ev
                        ? {
                            border: `1px solid ${corDoTipo(ev.tipo)}`,
                            color: "#fff",
                            animation: `gcD${ev.seq} 30s linear infinite`,
                          }
                        : undefined
                    }
                  >
                    {dia}
                  </span>
                );
              })}
            </div>
          </div>

          {/* popups em sequência (loop 30s) */}
          {eventos.map((ev) => (
            <div
              key={ev.seq}
              className="gcanim absolute flex items-start gap-2 rounded-[10px] bg-surface px-[11px] py-2"
              style={{
                top: "50%",
                marginTop: ev.top,
                ...(ev.esquerda
                  ? { right: "50%", marginRight: ev.margem }
                  : { left: "50%", marginLeft: ev.margem }),
                border: `1px solid ${corDoTipo(ev.tipo).replace(
                  /\.\d+\)$/,
                  ".35)"
                )}`,
                boxShadow: "0 14px 30px -12px rgba(0,0,0,.7)",
                opacity: 0,
                animation: `gcE${ev.seq} 30s linear infinite`,
              }}
            >
              <IconeEvento tipo={ev.tipo} />
              <span className="flex flex-col gap-1">
                <span className="whitespace-nowrap font-mono text-[8.5px] font-semibold text-muted">
                  {ev.rotulo}
                </span>
                {ev.tipo === "alta" ? (
                  <span className="whitespace-nowrap font-mono text-[9px] font-semibold tracking-[.05em] text-[#F5A623]">
                    {t(TITULOS.alta)}
                  </span>
                ) : (
                  <>
                    <span className="whitespace-nowrap text-[11px] font-semibold text-primary">
                      {t(TITULOS[ev.tipo])}
                    </span>
                    {ev.extra?.map((linha) => (
                      <span
                        key={linha}
                        className="whitespace-nowrap font-mono text-[9px] font-semibold text-[#7DB0FF]"
                      >
                        {linha}
                      </span>
                    ))}
                    {ev.valor != null && (
                      <span
                        className="whitespace-nowrap font-mono text-[9px] font-bold"
                        style={{
                          color: ev.tipo === "cache" ? "#3CE08C" : "#7DB0FF",
                        }}
                      >
                        {fmtValor(ev.valor)}
                      </span>
                    )}
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
