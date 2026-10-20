"use client";

import { AlertTriangle, Ban, CheckCircle2, ChevronRight, Clock } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useNavegacao } from "../NavOverlay";
import { formatarDataBR, formatarMoeda } from "@/lib/formatters";
import { STATUS_PARCELA } from "@/lib/statusUI";
import { statusEfetivoParcela, type Moeda, type Parcela } from "@/types";

/**
 * Resumo (Recebido / A receber / Atrasado) + parcelas de UMA venda. Era o
 * mesmo bloco copiado à mão no modal do show e no detalhe da venda.
 *
 * `clicavel`: cada parcela abre o modal da parcela (com endereço ?parcela=)
 * onde se informa pagamento, cobra ou cancela — antes as parcelas eram só
 * leitura e mandavam a pessoa "gerenciar em Financeiro".
 */
export default function ListaParcelas({
  parcelas,
  moeda,
  clicavel = false,
}: {
  parcelas: Parcela[];
  moeda: Moeda;
  clicavel?: boolean;
}) {
  const t = useT();
  const { abrirSobreposicao } = useNavegacao();
  if (parcelas.length === 0) return null;

  const fmt = (v: number) => formatarMoeda(v, moeda);
  const ativas = parcelas.filter((p) => statusEfetivoParcela(p) !== "cancelado");
  const total = ativas.reduce((a, p) => a + p.valor, 0);
  const pago = ativas
    .filter((p) => statusEfetivoParcela(p) === "pago")
    .reduce((a, p) => a + p.valor, 0);
  const atrasado = ativas
    .filter((p) => statusEfetivoParcela(p) === "atrasado")
    .reduce((a, p) => a + p.valor, 0);

  return (
    <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 mb-1 text-sm">
        <span className="text-secondary">
          {t("Recebido:")}{" "}
          <span className="font-semibold" style={{ color: "var(--success)" }}>
            {fmt(pago)}
          </span>
        </span>
        <span className="text-secondary">
          {t("A receber:")}{" "}
          <span className="font-semibold text-primary">{fmt(total - pago)}</span>
        </span>
        {atrasado > 0 && (
          <span className="text-secondary">
            {t("Atrasado:")}{" "}
            <span className="font-semibold" style={{ color: "var(--danger)" }}>
              {fmt(atrasado)}
            </span>
          </span>
        )}
      </div>

      {parcelas.map((p, idx) => {
        const st = statusEfetivoParcela(p);
        const label = STATUS_PARCELA[st];
        const conteudo = (
          <>
            <div className="min-w-0 text-left">
              <span className="text-primary font-medium">
                {t("Parcela")} {idx + 1}/{parcelas.length}
              </span>
              <span className="text-muted text-xs ml-1.5">({p.percentual.toFixed(0)}%)</span>
              <div className="text-xs text-muted">
                {t("Vence")} {formatarDataBR(p.dataVencimento)}
                {p.dataPagamento && (
                  <span style={{ color: "var(--success)" }}>
                    {" "}· {t("pago em")} {formatarDataBR(p.dataPagamento)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-semibold tabular-nums text-primary">{fmt(p.valor)}</span>
              <span className={`badge ${label.badge}`}>
                {st === "pago" && <CheckCircle2 size={10} />}
                {st === "pendente" && <Clock size={10} />}
                {st === "atrasado" && <AlertTriangle size={10} />}
                {st === "cancelado" && <Ban size={10} />}
                {t(label.label)}
              </span>
              {clicavel && <ChevronRight size={14} className="text-muted" />}
            </div>
          </>
        );
        const base =
          "flex w-full items-center justify-between gap-3 py-1.5 text-sm border-b border-border/50 last:border-0";
        return clicavel ? (
          <button
            key={p.id}
            type="button"
            onClick={() => abrirSobreposicao("parcela", p.id)}
            className={`${base} rounded-sm px-1 -mx-1 transition-colors hover:bg-elevated`}
            title={t("Abrir parcela")}
          >
            {conteudo}
          </button>
        ) : (
          <div key={p.id} className={base}>
            {conteudo}
          </div>
        );
      })}
      {clicavel && (
        <p className="text-xs text-muted mt-1">
          {t("Toque numa parcela para informar pagamento, cobrar ou cancelar.")}
        </p>
      )}
    </>
  );
}
