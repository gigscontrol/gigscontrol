import type { ReactNode } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

type Trend = {
  value: number; // ex: +12 ou -5 (em %)
  label?: string; // ex: "vs mês anterior"
};

type Props = {
  title: string;
  value: string | number;
  icon: ReactNode;
  accentColor?: string;
  trend?: Trend;
  subtitle?: string;
};

export default function StatCard({
  title,
  value,
  icon,
  accentColor,
  trend,
  subtitle,
}: Props) {
  return (
    <div className="card flex flex-col gap-4 min-h-[140px]">
      <div className="flex items-start justify-between">
        <span className="stat-label">{title}</span>
        <div
          className="h-[30px] w-[30px] rounded-chip flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: accentColor ?? "color-mix(in srgb, var(--text-primary) 7%, transparent)",
            color: accentColor ? "var(--text-primary)" : "var(--text-secondary)",
          }}
        >
          {icon}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="stat-value">{value}</div>
        {(trend || subtitle) && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {trend && <TrendBadge value={trend.value} />}
            {(trend?.label || subtitle) && (
              <span className="text-xs text-muted">
                {trend?.label ?? subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TrendBadge({ value }: { value: number }) {
  const positive = value > 0;
  const neutral = value === 0;
  const colorClass = neutral
    ? "text-muted"
    : positive
    ? "text-success"
    : "text-danger";
  const Icon = neutral ? Minus : positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${colorClass}`}>
      <Icon size={12} />
      {positive && "+"}
      {value}%
    </span>
  );
}
