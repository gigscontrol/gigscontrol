"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";

type Props = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  accentColor?: string;
};

export default function PageHeader({ title, subtitle, actions, accentColor }: Props) {
  const t = useT();
  return (
    <div className="relative flex flex-wrap items-end justify-between gap-4 mb-8">
      {accentColor && (
        <div
          aria-hidden
          className="pointer-events-none absolute -left-4 -top-10 h-28 w-72 rounded-full opacity-[0.13] blur-3xl"
          style={{ backgroundColor: accentColor }}
        />
      )}
      <div className="relative flex items-start gap-3 min-w-0">
        {accentColor && (
          <div
            className="h-10 w-1 rounded-full mt-1 flex-shrink-0"
            style={{ backgroundColor: accentColor }}
          />
        )}
        <div className="min-w-0">
          <h1 className="page-title">{t(title)}</h1>
          {subtitle && (
            <p className="page-subtitle mt-0.5">
              {typeof subtitle === "string" ? t(subtitle) : subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="relative flex-shrink-0">{actions}</div>}
    </div>
  );
}
