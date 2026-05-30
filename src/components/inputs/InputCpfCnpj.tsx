"use client";

import { forwardRef } from "react";
import { mascararCpfCnpj, apenasDigitos } from "@/lib/formatters";

const INPUT_BASE =
  "bg-elevated border border-border rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted outline-none transition-colors focus:border-border-strong";

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  /**
   * Valor exibido — pode chegar como dígitos crus ("12345678901") ou já
   * mascarado. O componente normaliza pra mostrar sempre com máscara.
   */
  value: string;
  /**
   * Disparado a cada mudança. Recebe o valor MASCARADO (`123.456.789-01`).
   * Pra salvar só os dígitos, use `apenasDigitos(valor)`.
   */
  onChange: (mascarado: string) => void;
};

/**
 * Input com máscara progressiva CPF/CNPJ enquanto digita.
 *   1-11 dígitos → CPF (XXX.XXX.XXX-XX)
 *   12-14 dígitos → CNPJ (XX.XXX.XXX/XXXX-XX)
 * Trunca em 14 dígitos.
 */
const InputCpfCnpj = forwardRef<HTMLInputElement, Props>(function InputCpfCnpj(
  { value, onChange, className = "", placeholder, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder ?? "000.000.000-00 ou 00.000.000/0000-00"}
      value={mascararCpfCnpj(value)}
      onChange={(e) => {
        // Mantém só os dígitos do que o usuário digitou e re-aplica máscara.
        // Isso "desfaz" eventuais caracteres não-numéricos colados.
        const proxima = mascararCpfCnpj(apenasDigitos(e.target.value));
        onChange(proxima);
      }}
      className={`${INPUT_BASE} ${className}`}
      {...rest}
    />
  );
});

export default InputCpfCnpj;
