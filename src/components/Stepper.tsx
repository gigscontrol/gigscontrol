"use client";

import { Check } from "lucide-react";

type Step = { num: number; label: string };

type Props = {
  steps: Step[];
  current: number;
  accent: string;
};

export default function Stepper({ steps, current, accent }: Props) {
  return (
    <ol className="flex items-center gap-2 mb-8 w-full">
      {steps.map((s, idx) => {
        const isCurrent = s.num === current;
        const isDone = s.num < current;
        const isLast = idx === steps.length - 1;
        return (
          <li key={s.num} className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                style={{
                  backgroundColor: isCurrent || isDone ? accent : "var(--bg-elevated)",
                  color: isCurrent || isDone ? "#fff" : "var(--text-muted)",
                  boxShadow: isCurrent ? `0 0 0 4px ${accent}25` : undefined,
                }}
              >
                {isDone ? <Check size={14} /> : s.num}
              </span>
              <span
                className={`text-xs sm:text-sm font-semibold truncate ${
                  isCurrent ? "text-primary" : isDone ? "text-secondary" : "text-muted"
                }`}
              >
                {s.label}
              </span>
            </div>
            {!isLast && (
              <div
                className="flex-1 h-px"
                style={{ backgroundColor: isDone ? accent : "var(--border-color)" }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
