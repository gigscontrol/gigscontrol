"use client";

import type { ReactNode } from "react";
import { Lock, Ticket } from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  getPlano,
  formatarPreco,
  type PlanoId,
  type CicloCobranca,
  type Moeda,
} from "@/lib/planos";

/**
 * Coluna "Resumo do pedido" do checkout — pedido, valor e o cupom descontando
 * o valor. O campo de cupom entra como `children` (fica DENTRO do resumo). Com
 * cupom aplicado (1º mês grátis), o desconto zera o "Total hoje" e o resumo
 * mostra o preço que volta a valer depois.
 */

type Props = {
  plano: PlanoId;
  ciclo: CicloCobranca;
  moeda: Moeda;
  /** valor cheio do plano/ciclo na moeda (subtotal). */
  subtotal: number;
  cupomAplicado: { codigo: string; dias: number } | null;
  /** o campo de cupom (CampoCupom) renderiza aqui dentro. */
  children?: ReactNode;
};

export default function ResumoPedido({
  plano,
  ciclo,
  moeda,
  subtotal,
  cupomAplicado,
  children,
}: Props) {
  const t = useT();
  const p = getPlano(plano);
  const anual = ciclo === "anual";
  const gratis = !!cupomAplicado;
  const total = gratis ? 0 : subtotal;

  return (
    <div
      className="p-4"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-card)",
      }}
    >
      <div
        className="text-xs uppercase mb-3"
        style={{ color: "var(--text-muted)", letterSpacing: "0.06em" }}
      >
        {t("Resumo do pedido")}
      </div>

      {/* Pedido */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {p.nome}
          </div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {anual ? t("Assinatura anual") : t("Assinatura mensal")}
          </div>
        </div>
        <div className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>
          {formatarPreco(subtotal, moeda)}
        </div>
      </div>

      {/* Campo de cupom (slot) */}
      {children}

      {/* Totais */}
      <div
        className="mt-3 pt-3 flex flex-col gap-1.5"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div
          className="flex justify-between text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>{t("Subtotal")}</span>
          <span className="font-mono">{formatarPreco(subtotal, moeda)}</span>
        </div>

        {gratis && (
          <div
            className="flex justify-between text-xs"
            style={{ color: "var(--success)" }}
          >
            <span className="inline-flex items-center gap-1">
              <Ticket size={11} className="flex-shrink-0" />
              {t("Cupom {codigo} · 1º mês grátis", { codigo: cupomAplicado.codigo })}
            </span>
            <span className="font-mono">− {formatarPreco(subtotal, moeda)}</span>
          </div>
        )}

        <div className="flex justify-between items-baseline mt-0.5">
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {gratis ? t("Total hoje") : t("Total")}
          </span>
          <span
            className="text-lg font-semibold font-mono"
            style={{ color: "var(--text-primary)" }}
          >
            {formatarPreco(total, moeda)}
          </span>
        </div>

        <div className="text-[0.65rem] text-right" style={{ color: "var(--text-muted)" }}>
          {gratis
            ? t("depois, {preco} por {periodo}", {
                preco: formatarPreco(subtotal, moeda),
                periodo: anual ? t("ano") : t("mês"),
              })
            : anual
              ? t("cobrado uma vez no ano · cancele quando quiser")
              : t("cobrado por mês · cancele quando quiser")}
        </div>
      </div>

      <div
        className="mt-3 flex items-center gap-1.5 text-[0.65rem]"
        style={{ color: "var(--text-secondary)" }}
      >
        <Lock size={11} className="flex-shrink-0" />
        {t("Pagamento seguro · seus dados de cartão não passam por nós")}
      </div>
    </div>
  );
}
