"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  accentColor?: string;
};

export default function PageHeader({ title, subtitle, actions, accentColor }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div className="flex items-start gap-3 min-w-0">
        {accentColor && (
          <div
            className="h-10 w-1 rounded-full mt-1 flex-shrink-0"
            style={{ backgroundColor: accentColor }}
          />
        )}
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  );
}
