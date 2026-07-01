"use client";

import { forwardRef } from "react";
import { useT } from "@/lib/i18n";
import { configDocumento } from "@/lib/data/documentos";

const INPUT_BASE =
  "bg-elevated border border-border rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted outline-none transition-colors focus:border-border-strong";

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  /** País (ISO2) — define o rótulo, placeholder e formatação do documento. */
  pais: string;
  /** Valor cru (dígitos/alfanumérico). O componente formata pra exibir. */
  value: string;
  /** Recebe o valor FORMATADO. Pra salvar, use normalizarDocumento(pais, v). */
  onChange: (formatado: string) => void;
};

/**
 * Input de documento que se adapta ao país: BR = CPF/CNPJ, US = SSN/EIN,
 * PT = NIF, AR = CUIT, etc. (ver `documentos.ts`). Formata enquanto digita.
 */
const InputDocumento = forwardRef<HTMLInputElement, Props>(function InputDocumento(
  { pais, value, onChange, className = "", placeholder, ...rest },
  ref
) {
  const t = useT();
  const cfg = configDocumento(pais);
  return (
    <input
      ref={ref}
      type="text"
      autoComplete="off"
      placeholder={t(placeholder ?? cfg.placeholder)}
      value={cfg.format(value)}
      onChange={(e) => onChange(cfg.format(e.target.value))}
      className={`${INPUT_BASE} ${className}`}
      {...rest}
    />
  );
});

export default InputDocumento;
