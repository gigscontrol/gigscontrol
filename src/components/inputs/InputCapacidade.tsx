"use client";

import { forwardRef } from "react";
import { mascararCapacidade } from "@/lib/formatters";
import { useT } from "@/lib/i18n";

const INPUT_BASE =
  "bg-elevated border border-border rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted outline-none transition-colors focus:border-border-strong";

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "inputMode" | "maxLength"
> & {
  /** Valor exibido (só dígitos, max 6). */
  value: string;
  /** Disparado com a nova string (só dígitos, max 6). */
  onChange: (digitos: string) => void;
};

/**
 * Input de capacidade de público:
 *   - Só dígitos (não aceita letras, vírgulas, pontos, etc)
 *   - Hard cap em 6 caracteres (999.999 — qualquer estádio cabe)
 *   - inputMode="numeric" pra abrir teclado numérico em mobile
 */
const InputCapacidade = forwardRef<HTMLInputElement, Props>(
  function InputCapacidade(
    { value, onChange, className = "", placeholder, ...rest },
    ref
  ) {
    const t = useT();
    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder ?? t("Ex: 500")}
        value={mascararCapacidade(value)}
        onChange={(e) => {
          onChange(mascararCapacidade(e.target.value));
        }}
        className={`${INPUT_BASE} ${className}`}
        {...rest}
      />
    );
  }
);

export default InputCapacidade;
