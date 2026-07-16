"use client";

/**
 * Seção "03 · Colhe o resultado" (tela 13 do guia): radar de raio.
 *
 * 3 anéis com escala de km, mira central e varredura lenta de 16s (gcSweep).
 * Quando o feixe passa por um ponto ele PULSA neon (gcPingB/W/L) e só então
 * o chip com a informação aparece (gcRev3) — os 9 pontos se identificam ao
 * longo do ciclo; pontos com acúmulo mostram contador (2/3/4), estilo
 * cluster de mapa. Shows sem nome de artista: casa, dia e horário.
 *
 * Cidade-base por IP (prop `pais`): Brasil → São Paulo, SP; fora → Londres.
 */

import { useT } from "@/lib/i18n";
import { BadgeSecao, ChecksSecao, CtasSecao, Grad } from "./blocos";

/* pontos que pulsam quando o feixe passa */
const PINGS: {
  tipo: "show" | "casa" | "contato";
  x: number;
  y: number;
  delay: number;
  cluster?: number;
}[] = [
  { tipo: "show", x: 204, y: 74, delay: 15.11 },
  { tipo: "show", x: 197, y: 269, delay: 4.89 },
  { tipo: "show", x: 59, y: 130, delay: 10.44 },
  { tipo: "casa", x: 276, y: 117, delay: 1.07, cluster: 2 },
  { tipo: "casa", x: 115, y: 249, delay: 6.71, cluster: 4 },
  { tipo: "casa", x: 106, y: 97, delay: 12 },
  { tipo: "contato", x: 223, y: 192, delay: 3.08, cluster: 3 },
  { tipo: "contato", x: 36, y: 214, delay: 8.53 },
  { tipo: "contato", x: 125, y: 11, delay: 13.3 },
];

/* chips que aparecem logo depois do pulso do seu ponto */
const CHIPS_SHOW: {
  x: number;
  y: number;
  delay: number;
  dia: string;
  casa: string;
  horario: string;
}[] = [
  { x: 222, y: 58, delay: 15.26, dia: "SEX", casa: "Vila JK", horario: "01:30 – 02:30" },
  { x: 215, y: 260, delay: 5.04, dia: "SÁB", casa: "D-EDGE", horario: "03:00 – 05:00" },
  { x: 75, y: 134, delay: 10.59, dia: "SEX", casa: "Formatura Mackenzie", horario: "01:00 – 02:00" },
];

const CHIPS_MINI: {
  tipo: "casa" | "contato";
  x: number;
  y: number;
  delay: number;
  rotulo: string;
}[] = [
  { tipo: "casa", x: 132, y: 120, delay: 1.22, rotulo: "2 CASAS DE SHOWS" },
  { tipo: "casa", x: 58, y: 273, delay: 6.86, rotulo: "4 CASAS DE SHOWS" },
  { tipo: "casa", x: 59, y: 65, delay: 12.15, rotulo: "CASA DE SHOWS" },
  { tipo: "contato", x: 196, y: 216, delay: 3.23, rotulo: "3 CONTATOS" },
  { tipo: "contato", x: 0, y: 238, delay: 8.68, rotulo: "CONTATO" },
  { tipo: "contato", x: 100, y: 33, delay: 13.45, rotulo: "CONTATO" },
];

function IconeCasa({ stroke }: { stroke: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      style={{ width: 12, height: 12 }}
      aria-hidden
    >
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function IconeContato() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--brand-ink)"
      strokeWidth="2"
      style={{ width: 12, height: 12 }}
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
    </svg>
  );
}

export default function RadarMapa({ pais }: { pais: string }) {
  const t = useT();
  const rotuloCidade =
    pais === "BR"
      ? t("SÃO PAULO, SP · RAIO 150 KM")
      : t("LONDRES · RAIO 150 KM");

  return (
    <section
      className="grid scroll-mt-[72px] items-center gap-6 border-t border-[var(--hairline)] px-6 pb-[54px] pt-12 sm:px-12 lg:min-h-dvh lg:grid-cols-[1fr_1.05fr] lg:py-6"
      style={{
        background:
          "radial-gradient(70% 90% at 22% 30%, var(--glow-hero), var(--glow-fade) 60%)",
      }}
    >
      {/* radar — desliza da esquerda ao entrar no viewport */}
      <div
        className="gcrv-l relative order-1 min-h-[420px] max-md:min-h-[340px] overflow-hidden lg:order-1"
        style={{ transitionDelay: "120ms" }}
      >
        <div className="gcvis-scale absolute inset-0">
          <div
            className="absolute left-1/2 top-1/2 h-[320px] w-[320px]"
            style={{ margin: "-160px 0 0 -160px" }}
          >
            {/* mira */}
            <div className="absolute left-0 top-[159px] h-px w-[320px] bg-[color-mix(in_srgb,var(--brand)_10%,transparent)]" />
            <div className="absolute left-[159px] top-0 h-[320px] w-px bg-[color-mix(in_srgb,var(--brand)_10%,transparent)]" />
            {/* anéis */}
            <div className="absolute left-[10px] top-[10px] h-[300px] w-[300px] rounded-full border border-[color-mix(in_srgb,var(--brand)_25%,transparent)]" />
            <div className="absolute left-[57px] top-[57px] h-[206px] w-[206px] rounded-full border border-dashed border-[color-mix(in_srgb,var(--brand)_22%,transparent)]" />
            <div className="absolute left-[104px] top-[104px] h-[112px] w-[112px] rounded-full border border-dashed border-[color-mix(in_srgb,var(--brand)_18%,transparent)]" />
            {/* escala de km */}
            {[
              { km: "50", left: 88 },
              { km: "100", left: 38 },
              { km: "150", left: -8 },
            ].map(({ km, left }) => (
              <span
                key={km}
                className="absolute bg-main px-[3px] py-px font-mono text-[7px] font-semibold text-[var(--text-disabled)]"
                style={{ left, top: 153 }}
              >
                {km}
              </span>
            ))}
            {/* varredura */}
            <div
              className="gcanim gc-sweep-radar absolute left-[10px] top-[10px] h-[300px] w-[300px] rounded-full"
              style={{
                animation: "gcSweep 16s linear infinite",
              }}
            />
            {/* centro */}
            <div className="absolute left-[154px] top-[154px] h-3 w-3 rounded-full bg-[color-mix(in_srgb,var(--brand)_25%,transparent)]" />
            <div
              className="absolute left-[157px] top-[157px] h-1.5 w-1.5 rounded-full bg-[var(--brand)]"
              style={{ boxShadow: "0 0 12px var(--brand)" }}
            />

            {/* pontos que pulsam quando o feixe passa */}
            {PINGS.map((p, i) =>
              p.tipo === "show" ? (
                <i
                  key={i}
                  className="gcanim absolute h-2 w-2 rounded-full bg-[var(--brand)]"
                  style={{
                    left: p.x,
                    top: p.y,
                    boxShadow: "0 0 5px color-mix(in srgb, var(--brand) 50%, transparent)",
                    animation: `gcPingB 16s linear ${p.delay}s infinite`,
                  }}
                />
              ) : (
                <span
                  key={i}
                  className="gcanim absolute flex h-4 w-4 items-center justify-center rounded"
                  style={{
                    left: p.x,
                    top: p.y,
                    boxShadow:
                      p.tipo === "casa"
                        ? "0 0 4px var(--gc-ping-w-base)"
                        : "0 0 4px var(--gc-ping-l-base)",
                    animation: `${
                      p.tipo === "casa" ? "gcPingW" : "gcPingL"
                    } 16s linear ${p.delay}s infinite`,
                  }}
                >
                  {p.tipo === "casa" ? (
                    <IconeCasa stroke="var(--text-soft)" />
                  ) : (
                    <IconeContato />
                  )}
                  {p.cluster && (
                    <i
                      className="absolute -right-[7px] -top-1.5 h-[11px] w-[11px] rounded-full text-center font-mono text-[7px] font-bold not-italic leading-[11px] text-main"
                      style={{
                        background: p.tipo === "casa" ? "var(--text-soft)" : "var(--brand-ink)",
                      }}
                    >
                      {p.cluster}
                    </i>
                  )}
                </span>
              )
            )}

            {/* chips de show: dia · casa · horário */}
            {CHIPS_SHOW.map((c, i) => (
              <div
                key={i}
                className="gcanim absolute flex items-start gap-2 rounded border border-[color-mix(in_srgb,var(--brand)_40%,transparent)] bg-surface px-3 py-2"
                style={{
                  left: c.x,
                  top: c.y,
                  opacity: 0,
                  boxShadow: "0 14px 30px -12px var(--shadow-color-strong)",
                  animation: `gcRev3 16s linear ${c.delay}s infinite`,
                }}
              >
                <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-[var(--brand)]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2"
                    style={{ width: 12, height: 12 }}
                    aria-hidden
                  >
                    <path d="M9 18V6l10-2v12" />
                    <circle cx="6.5" cy="18" r="2.5" />
                    <circle cx="16.5" cy="16" r="2.5" />
                  </svg>
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-mono text-[8.5px] font-semibold text-muted">
                    {t(c.dia)}
                  </span>
                  <span className="whitespace-nowrap text-[11.5px] font-semibold text-primary">
                    {c.casa}
                  </span>
                  <span className="whitespace-nowrap font-mono text-[9.5px] font-semibold text-[var(--brand-ink)]">
                    {c.horario}
                  </span>
                </span>
              </div>
            ))}

            {/* chips mini: casas e contatos */}
            {CHIPS_MINI.map((c, i) => (
              <div
                key={i}
                className="gcanim max-sm:hidden absolute flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-hover)] bg-surface px-[9px] py-1.5 font-mono text-[8.5px] font-semibold tracking-[.06em] text-[var(--text-soft)]"
                style={{
                  left: c.x,
                  top: c.y,
                  opacity: 0,
                  boxShadow: "0 10px 24px -10px var(--shadow-color-strong)",
                  animation: `gcRev3 16s linear ${c.delay}s infinite`,
                }}
              >
                {c.tipo === "casa" ? (
                  <IconeCasa stroke="var(--text-soft)" />
                ) : (
                  <IconeContato />
                )}
                {t(c.rotulo)}
              </div>
            ))}
          </div>

          {/* rótulo da cidade-base */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-surface px-2.5 py-[7px] font-mono text-[9px] font-semibold tracking-[.12em] text-muted">
            {rotuloCidade}
          </div>
        </div>
      </div>

      {/* copy — desliza da direita ao entrar no viewport */}
      <div className="gcrv-r order-2 flex flex-col justify-center gap-[22px] lg:order-2">
        <BadgeSecao>{t("03 · Colhe o resultado")}</BadgeSecao>
        <h2 className="font-display text-4xl font-extrabold leading-[1.06] tracking-[-0.03em] md:text-[40px] xl:text-[46px]">
          {t("Visualize oportunidades")}
          <br />
          <Grad>{t("antes da concorrência")}</Grad>.
        </h2>
        <p className="max-w-[470px] text-[15px] leading-[1.6] text-secondary xl:text-base">
          {t(
            "Mapeie clientes, contratantes, casas de shows, cidades e negociações em uma visão dinâmica e intuitiva. Encontre informações em segundos e mantenha toda a sua operação conectada."
          )}
        </p>
        <CtasSecao />
        <ChecksSecao
          itens={[
            "Contatos sempre organizados",
            "Busque por cidade, região ou cliente",
            "Agilidade para fechar mais negócios",
          ]}
        />
      </div>
    </section>
  );
}
