// Mockup do módulo 05 — Contatos (visual à DIREITA da seção).
//
// Radar ANIMADO — porta o bloco do /inicio (RadarMapa): 320×320 com mira, 3
// anéis, escala de km, varredura de 16s (gcSweep) e os 8 pontos que PULSAM
// quando o feixe passa (gcPingB/W/L) revelando um chip com a informação (gcRev3).
// Reusa as MESMAS keyframes do redesign.css (nenhuma nova). Exceção à regra de
// mock estático (pedido do dono); ainda assim SEM hook/useT — rótulos PT fixos.
// Muda pouca coisa do /inicio: posições, quantidades e rótulos de exemplo.

/** Casa (telhado) — traço configurável, 12×12. */
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

/** Contato (pessoa) — traço azul, 12×12. */
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

// Pontos que pulsam quando o feixe passa (posições/quantidades próprias).
const PINGS: {
  tipo: "show" | "casa" | "contato";
  x: number;
  y: number;
  delay: number;
  cluster?: number;
}[] = [
  { tipo: "show", x: 214, y: 70, delay: 15.24 },
  { tipo: "show", x: 150, y: 262, delay: 6.12 },
  { tipo: "show", x: 58, y: 140, delay: 10.36 },
  { tipo: "casa", x: 270, y: 120, delay: 0.98, cluster: 2 },
  { tipo: "casa", x: 100, y: 92, delay: 12.03 },
  { tipo: "contato", x: 224, y: 196, delay: 3.17, cluster: 3 },
  { tipo: "contato", x: 40, y: 210, delay: 8.86 },
  { tipo: "contato", x: 128, y: 14, delay: 13.32 },
];

// Chips de show — dia · casa · horário (aparecem logo após o pulso do ponto).
const CHIPS_SHOW: {
  x: number;
  y: number;
  delay: number;
  dia: string;
  casa: string;
  horario: string;
}[] = [
  { x: 224, y: 44, delay: 15.39, dia: "SÁB", casa: "Vila Mix", horario: "01:10 – 02:30" },
  { x: 172, y: 250, delay: 6.27, dia: "SEX", casa: "Audio Club", horario: "00:30 – 02:00" },
  { x: 70, y: 146, delay: 10.51, dia: "SÁB", casa: "Estúdio Alameda", horario: "02:00 – 04:00" },
];

// Chips mini — casas e contatos (contadores diferentes: 2 / 3).
const CHIPS_MINI: {
  tipo: "casa" | "contato";
  x: number;
  y: number;
  delay: number;
  rotulo: string;
}[] = [
  { tipo: "casa", x: 144, y: 116, delay: 1.13, rotulo: "2 CASAS DE SHOWS" },
  { tipo: "casa", x: 52, y: 66, delay: 12.18, rotulo: "CASA DE SHOWS" },
  { tipo: "contato", x: 196, y: 216, delay: 3.32, rotulo: "3 CONTATOS" },
  { tipo: "contato", x: 0, y: 236, delay: 9.01, rotulo: "CONTATO" },
  { tipo: "contato", x: 150, y: 6, delay: 13.47, rotulo: "PROD. ALAMEDA" },
];

export default function MockContatos() {
  return (
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
      <div className="absolute left-[104px] top-[104px] h-[112px] w-[112px] rounded-full border border-dashed border-[var(--brand-soft)]" />
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
      {/* varredura — classe compartilhada com o RadarMapa (redesign.css), que
          já embute o conic-gradient + a animação gcSweep, incluindo o
          override do tema claro (feixe mais tímido sobre fundo branco). */}
      <div className="gcanim gc-sweep-radar absolute left-[10px] top-[10px] h-[300px] w-[300px] rounded-full" />
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
                  ? "0 0 4px color-mix(in srgb, var(--text-soft) 35%, transparent)"
                  : "0 0 4px color-mix(in srgb, var(--brand-ink) 35%, transparent)",
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
              {c.dia}
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
          className="gcanim absolute flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border-hover)] bg-surface px-[9px] py-1.5 font-mono text-[8.5px] font-semibold tracking-[.06em] text-[var(--text-soft)]"
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
          {c.rotulo}
        </div>
      ))}

      {/* rótulo da cidade-base — fixo abaixo do radar */}
      <div className="absolute left-1/2 top-[330px] -translate-x-1/2 whitespace-nowrap rounded-lg border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-surface px-2.5 py-[7px] font-mono text-[9px] font-semibold tracking-[.12em] text-muted">
        SÃO PAULO, SP · RAIO 150 KM
      </div>
    </div>
  );
}
