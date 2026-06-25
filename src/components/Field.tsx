"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";

type Props = {
  label: ReactNode;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Field({ label, required, hint, error, children }: Props) {
  const t = useT();
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-secondary">
        {typeof label === "string" ? t(label) : label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-danger">{t(error)}</span>
      ) : hint ? (
        <span className="text-xs text-muted">{t(hint)}</span>
      ) : null}
    </label>
  );
}

const INPUT_BASE =
  "bg-elevated border border-border rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted outline-none transition-colors focus:border-border-strong";

export function TextInput({
  className = "",
  placeholder,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const t = useT();
  return (
    <input
      {...rest}
      placeholder={placeholder ? t(placeholder) : placeholder}
      className={`${INPUT_BASE} ${className}`}
    />
  );
}

export function TextArea({
  className = "",
  placeholder,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const t = useT();
  return (
    <textarea
      {...rest}
      placeholder={placeholder ? t(placeholder) : placeholder}
      className={`${INPUT_BASE} resize-none min-h-[72px] ${className}`}
    />
  );
}

export function Select({ className = "", ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={`${INPUT_BASE} appearance-none cursor-pointer ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23a1a1aa' d='M6 8L0 0h12z'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: "32px",
      }}
    />
  );
}
