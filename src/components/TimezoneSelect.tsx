"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Globe, Search } from "lucide-react";
import { useT } from "@/lib/i18n";

/** Lista IANA completa (fallback curto se o runtime não expõe supportedValuesOf). */
export function listaFusos(): string[] {
  try {
    const anyIntl = Intl as unknown as {
      supportedValuesOf?: (k: string) => string[];
    };
    const v = anyIntl.supportedValuesOf?.("timeZone");
    if (Array.isArray(v) && v.length) return v;
  } catch {
    /* fallback abaixo */
  }
  return [
    "America/Sao_Paulo", "America/New_York", "America/Los_Angeles",
    "America/Mexico_City", "America/Bogota", "America/Buenos_Aires",
    "Europe/Lisbon", "Europe/London", "Europe/Paris", "Europe/Madrid",
    "Europe/Berlin", "Europe/Rome", "Africa/Luanda", "Asia/Tokyo",
    "Asia/Dubai", "Australia/Sydney", "UTC",
  ];
}

/** Fuso do dispositivo (ex.: "America/Sao_Paulo"). */
export function fusoDoNavegador(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Offset atual de um fuso, ex.: "GMT-03:00". Vazio se inválido. */
export function offsetDe(tz: string): string {
  try {
    return (
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? ""
    );
  } catch {
    return "";
  }
}

/** "America/Sao_Paulo" → "São Paulo" (só a cidade, com espaços). */
export function nomeCidadeFuso(tz: string): string {
  const parte = tz.split("/").pop() ?? tz;
  return parte.replace(/_/g, " ");
}

type Props = {
  value: string | null;
  onChange: (tz: string) => void;
  disabled?: boolean;
};

/**
 * Combobox de fuso horário com busca. Mostra o nome IANA + o offset atual
 * (GMT±hh:mm). A busca casa em qualquer parte (cidade, continente ou offset).
 */
export default function TimezoneSelect({ value, onChange, disabled }: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const fusos = useMemo(() => listaFusos(), []);
  const comOffset = useMemo(
    () => fusos.map((tz) => ({ tz, offset: offsetDe(tz), cidade: nomeCidadeFuso(tz) })),
    [fusos]
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q
      ? comOffset.filter(
          (f) =>
            f.tz.toLowerCase().includes(q) ||
            f.cidade.toLowerCase().includes(q) ||
            f.offset.toLowerCase().includes(q)
        )
      : comOffset;
    return base.slice(0, 80);
  }, [comOffset, busca]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberto) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [aberto]);

  const rotuloAtual = value
    ? `${nomeCidadeFuso(value)} · ${offsetDe(value)}`
    : t("Selecione o fuso horário");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-left transition-colors disabled:opacity-60 hover:border-brand/60"
      >
        <Globe size={14} style={{ color: "var(--brand)" }} className="flex-shrink-0" />
        <span className="flex-1 text-primary truncate">{rotuloAtual}</span>
      </button>

      {aberto && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-elevated shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search size={13} className="text-muted flex-shrink-0" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={t("Buscar cidade, região ou GMT…")}
              className="flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-muted"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtrados.length === 0 && (
              <div className="px-3 py-3 text-xs text-muted">{t("Nenhum fuso encontrado.")}</div>
            )}
            {filtrados.map((f) => {
              const ativo = f.tz === value;
              return (
                <button
                  key={f.tz}
                  type="button"
                  onClick={() => {
                    onChange(f.tz);
                    setAberto(false);
                    setBusca("");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface-2 transition-colors"
                >
                  <span className="flex-1 text-primary truncate">{f.cidade}</span>
                  <span className="text-xs text-muted tabular-nums flex-shrink-0">{f.offset}</span>
                  {ativo && <Check size={13} style={{ color: "var(--brand)" }} className="flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
