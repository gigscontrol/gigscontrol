"use client";

import { Minus, Plus } from "lucide-react";

type Props = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
};

export default function QuantitySelector({ label, value, onChange, min = 0, max = 99 }: Props) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  return (
    <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-elevated border border-border">
      <span
        className={`text-sm flex-1 min-w-0 truncate ${value > 0 ? "text-primary font-medium" : "text-secondary"}`}
      >
        {label}
      </span>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={dec}
          disabled={value <= min}
          className="h-7 w-7 rounded-md border border-border bg-surface-2 text-secondary flex items-center justify-center transition-all hover:border-border-strong hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={`Diminuir ${label}`}
        >
          <Minus size={13} />
        </button>

        <span
          className="text-sm font-bold tabular-nums w-6 text-center"
          style={{ color: value > 0 ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          {value}
        </span>

        <button
          type="button"
          onClick={inc}
          disabled={value >= max}
          className="h-7 w-7 rounded-md border border-border bg-surface-2 text-secondary flex items-center justify-center transition-all hover:border-border-strong hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={`Aumentar ${label}`}
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}
