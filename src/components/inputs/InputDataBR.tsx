"use client";

import { forwardRef, useEffect, useState } from "react";
import {
  formatarDataBR,
  mascararDataBR,
  parseDataBR,
} from "@/lib/formatters";
import { getFormatoData } from "@/lib/preferencias";
import { useT } from "@/lib/i18n";

const INPUT_BASE =
  "bg-elevated border border-border rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted outline-none transition-colors focus:border-border-strong";

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  /** Valor ISO (YYYY-MM-DD) — vazio se não preenchido. */
  value: string;
  /**
   * Recebe valor ISO (YYYY-MM-DD) ou "" enquanto a data ainda não está
   * completa/válida. Útil pra binding direto no estado do form.
   */
  onChange: (iso: string) => void;
  /**
   * "DD/MM" — pré-preenche o display com dia/mês pra completar SÓ o ano
   * (colagem de lista do WhatsApp que veio sem ano). Só aplica enquanto
   * não há data completa (`value` vazio).
   */
  sugestaoParcial?: string;
};

/**
 * Input de data com máscara DD/MM/YYYY, garantindo formato BR
 * independente do locale do browser do usuário (`type="date"` herda
 * o locale e por isso pode aparecer MM/DD/YYYY em browsers em inglês).
 *
 * - Display: DD/MM/YYYY
 * - Storage: ISO YYYY-MM-DD (chamada de onChange só quando a data está
 *   completa e é válida; enquanto digita parcial, chama onChange("")).
 */
const InputDataBR = forwardRef<HTMLInputElement, Props>(function InputDataBR(
  { value, onChange, className = "", placeholder, sugestaoParcial, ...rest },
  ref
) {
  // Display string interno — segue sendo digitado letra a letra,
  // independente de quando o ISO fica válido.
  const t = useT();
  const [displayed, setDisplayed] = useState(() => formatarDataBR(value));

  // Quando o ISO externo muda (ex: pré-preenchimento via orçamento),
  // sincroniza o display.
  useEffect(() => {
    const ext = formatarDataBR(value);
    setDisplayed((atual) => {
      // Evita resetar se o usuário está no meio da digitação e o
      // pai re-renderizou com o mesmo ISO já consolidado.
      if (parseDataBR(atual) === value) return atual;
      return ext;
    });
  }, [value]);

  // Sugestão parcial ("DD/MM" da colagem sem ano): mostra "DD/MM/" pro
  // usuário digitar só o ano. Não mexe se já existe data completa.
  useEffect(() => {
    if (!sugestaoParcial || value) return;
    setDisplayed(mascararDataBR(`${sugestaoParcial}/`));
    // `value` fora das deps de propósito: só reage à CHEGADA da sugestão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugestaoParcial]);

  // Data COMPLETA (10 chars) porém inválida (31/02, mês 19…): antes falhava em
  // SILÊNCIO — o pai recebia "" e a pessoa via "não deixa cadastrar a data" sem
  // nenhuma pista. Agora o campo sinaliza vermelho e explica no title.
  const completaInvalida = displayed.length === 10 && parseDataBR(displayed) === null;

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder ?? t(getFormatoData() === "mdy" ? "mm/dd/aaaa" : "dd/mm/aaaa")}
      maxLength={10}
      value={displayed}
      onChange={(e) => {
        const masc = mascararDataBR(e.target.value);
        setDisplayed(masc);
        // Só consolida no ISO quando a data está completa E é válida.
        // Caso contrário, o pai recebe "" (estado "ainda incompleta").
        onChange(parseDataBR(masc) ?? "");
      }}
      aria-invalid={completaInvalida || undefined}
      title={completaInvalida ? t("Data inválida — confira dia e mês.") : undefined}
      className={`${INPUT_BASE} ${completaInvalida ? "!border-danger" : ""} ${className}`}
      {...rest}
    />
  );
});

export default InputDataBR;
