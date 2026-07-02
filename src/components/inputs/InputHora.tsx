"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

const INPUT_BASE =
  "bg-elevated border border-border rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted outline-none transition-colors focus:border-border-strong";

type Periodo = "" | "AM" | "PM";

/**
 * Máscara HH:MM conforme digita; `maxHora` é 23 (24h) ou 12 (com AM/PM).
 * O ":" entra sozinho e entende hora de 1 dígito: "930" → "09:30".
 */
function mascararHora(raw: string, maxHora: number): string {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  if (!d) return "";
  if (d.length === 1) return d;

  const doisPrimeiros = parseInt(d.slice(0, 2), 10);
  const horaUmDigito =
    parseInt(d[0], 10) > Math.floor(maxHora / 10) || doisPrimeiros > maxHora;
  const hLen = horaUmDigito ? 1 : 2;

  const h = d.slice(0, hLen).padStart(2, "0");
  const min = d.slice(hLen, hLen + 2);
  if (!min) return h;
  const mm =
    min.length === 2
      ? String(Math.min(59, parseInt(min, 10))).padStart(2, "0")
      : min;
  return `${h}:${mm}`;
}

/**
 * Display (HH:MM, em 12h se `periodo` marcado, senão 24h) + período →
 * canônico "HH:mm" 24h, ou "" se ainda incompleto/ inválido.
 */
function paraCanonica(display: string, periodo: Periodo): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(display);
  if (!m) return "";
  let h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  if (mi > 59) return "";
  if (periodo === "") {
    if (h > 23) return "";
    return `${String(h).padStart(2, "0")}:${m[2]}`;
  }
  if (h < 1 || h > 12) return "";
  if (periodo === "AM") h = h === 12 ? 0 : h;
  else h = h === 12 ? 12 : h + 12;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/** Canônico 24h "HH:mm" → número de 12h "HH:MM" (sem o sufixo do período). */
function canon24ParaDisplay12(canon: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(canon);
  if (!m) return canon;
  let h = parseInt(m[1], 10) % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  /** "HH:mm" 24h ou "" se ainda não preenchido. */
  value: string;
  /** Recebe "HH:mm" 24h válido quando completo, ou "" enquanto incompleto. */
  onChange: (hhmm: string) => void;
  /** Cor de destaque do AM/PM ativo (hex/CSS). Default = brand (Signal Blue). */
  accent?: string;
};

/**
 * Input de horário com máscara HH:MM. Por padrão é 24h (mais intuitivo que o
 * `type="time"` nativo, que vira 12h AM/PM em alguns browsers). Há dois botões
 * discretos AM / PM (opcionais): ao marcar, o campo passa a aceitar 12h e o
 * valor é convertido pra 24h nos bastidores. Clicar de novo desmarca (volta a
 * 24h). O que sai no onChange é sempre "HH:mm" 24h.
 */
const InputHora = forwardRef<HTMLInputElement, Props>(function InputHora(
  {
    value,
    onChange,
    className = "",
    placeholder,
    accent = "var(--brand)",
    ...rest
  },
  ref
) {
  const t = useT();
  const [displayed, setDisplayed] = useState(value);
  const [periodo, setPeriodo] = useState<Periodo>("");

  // Refs pra ler o estado atual dentro do efeito de sincronização sem
  // recriá-lo a cada tecla (evita stale closure e resets indevidos).
  const displayedRef = useRef(displayed);
  displayedRef.current = displayed;
  const periodoRef = useRef(periodo);
  periodoRef.current = periodo;

  // Sincroniza quando o valor externo (ex: pré-preenchimento) muda de fato.
  // Ignora o "eco" do nosso próprio onChange e não apaga digitação parcial.
  useEffect(() => {
    if (paraCanonica(displayedRef.current, periodoRef.current) === value) return;
    if (!value) return;
    setDisplayed(value);
    setPeriodo("");
  }, [value]);

  function aoDigitar(raw: string) {
    const masc = mascararHora(raw, periodo === "" ? 23 : 12);
    setDisplayed(masc);
    onChange(paraCanonica(masc, periodo));
  }

  function trocarPeriodo(novo: Periodo) {
    const canon = paraCanonica(displayed, periodo);
    if (canon) {
      if (novo === "") {
        setDisplayed(canon);
        setPeriodo("");
        onChange(canon);
      } else {
        const d12 = canon24ParaDisplay12(canon);
        setDisplayed(d12);
        setPeriodo(novo);
        onChange(paraCanonica(d12, novo));
      }
    } else {
      const masc = mascararHora(displayed, novo === "" ? 23 : 12);
      setDisplayed(masc);
      setPeriodo(novo);
      onChange(paraCanonica(masc, novo));
    }
  }

  return (
    <div className="flex items-stretch gap-2">
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder ?? "hh:mm"}
        maxLength={5}
        value={displayed}
        onChange={(e) => aoDigitar(e.target.value)}
        className={`${INPUT_BASE} flex-1 min-w-0 tabular-nums ${className}`}
        {...rest}
      />
      {/* AM/PM como segmented control. Nenhum ativo = 24h (padrão). */}
      <div className="flex shrink-0 overflow-hidden rounded-md border border-border">
        {(["AM", "PM"] as const).map((p, i) => {
          const ativo = periodo === p;
          return (
            <button
              key={p}
              type="button"
              tabIndex={-1}
              aria-pressed={ativo}
              onClick={() => trocarPeriodo(ativo ? "" : p)}
              title={
                ativo
                  ? t("{p} marcado — clique pra voltar a 24h", { p })
                  : t("Marcar {p} (12h)", { p })
              }
              className={`flex items-center px-2.5 text-xs font-semibold transition-colors ${
                i === 1 ? "border-l border-border" : ""
              }`}
              style={
                ativo
                  ? {
                      color: accent,
                      background: `color-mix(in srgb, ${accent} 20%, transparent)`,
                    }
                  : { color: "var(--text-muted)" }
              }
            >
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default InputHora;
