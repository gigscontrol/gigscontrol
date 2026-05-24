"use client";

import { useMemo } from "react";
import { Plus, Trash2, Percent, DollarSign, AlertTriangle, CheckCircle2 } from "lucide-react";
import { TextInput } from "./Field";
import { formatBRL } from "@/lib/whatsapp";
import type { Parcela } from "@/types";

/**
 * Editor de parcelas de pagamento.
 * O usuário escolhe o modo (% ou R$). Internamente as parcelas sempre
 * carregam os dois valores sincronizados — o `valor` é a fonte de verdade
 * para o financeiro, o `percentual` é só para exibição/edição.
 */

export type ModoParcela = "percentual" | "valor";

type Props = {
  cacheTotal: number;
  parcelas: Parcela[];
  onChange: (parcelas: Parcela[]) => void;
  modo: ModoParcela;
  onModoChange: (m: ModoParcela) => void;
  accent: string;
  error?: string;
};

let parcelaCounter = 0;
export function novaParcela(percentual: number, cacheTotal: number): Parcela {
  parcelaCounter += 1;
  return {
    id: `parc-${Date.now()}-${parcelaCounter}`,
    percentual,
    valor: Math.round((cacheTotal * percentual) / 100),
    dataVencimento: "",
    statusBase: "pendente",
  };
}

export default function PagamentoSection({
  cacheTotal,
  parcelas,
  onChange,
  modo,
  onModoChange,
  accent,
  error,
}: Props) {
  const somaPercentual = useMemo(
    () => parcelas.reduce((acc, p) => acc + (p.percentual || 0), 0),
    [parcelas]
  );
  const somaValor = useMemo(
    () => parcelas.reduce((acc, p) => acc + (p.valor || 0), 0),
    [parcelas]
  );

  const percentualOk = Math.abs(somaPercentual - 100) < 0.01;
  const valorOk = Math.abs(somaValor - cacheTotal) < 1;
  const tudoOk = modo === "percentual" ? percentualOk : valorOk;

  function adicionar() {
    // Sugere o percentual restante
    const restante = Math.max(0, 100 - somaPercentual);
    onChange([...parcelas, novaParcela(restante, cacheTotal)]);
  }

  function remover(id: string) {
    if (parcelas.length === 1) return;
    onChange(parcelas.filter((p) => p.id !== id));
  }

  function atualizar(id: string, patch: Partial<Parcela>) {
    onChange(parcelas.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  // Quando edita o percentual, recalcula o valor
  function setPercentual(id: string, pct: number) {
    const limpo = Math.max(0, Math.min(100, pct));
    atualizar(id, {
      percentual: limpo,
      valor: Math.round((cacheTotal * limpo) / 100),
    });
  }

  // Quando edita o valor, recalcula o percentual
  function setValor(id: string, valor: number) {
    const limpo = Math.max(0, valor);
    atualizar(id, {
      valor: limpo,
      percentual: cacheTotal > 0 ? Number(((limpo / cacheTotal) * 100).toFixed(2)) : 0,
    });
  }

  return (
    <div>
      {/* Seletor de modo */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-muted">Dividir por:</span>
        <div className="pill-group">
          <button
            type="button"
            className={`pill ${modo === "percentual" ? "active" : ""}`}
            onClick={() => onModoChange("percentual")}
          >
            <Percent size={11} />
            Porcentagem
          </button>
          <button
            type="button"
            className={`pill ${modo === "valor" ? "active" : ""}`}
            onClick={() => onModoChange("valor")}
          >
            <DollarSign size={11} />
            Valor R$
          </button>
        </div>
      </div>

      {cacheTotal <= 0 && (
        <div className="text-xs text-warning mb-3 flex items-center gap-1.5">
          <AlertTriangle size={12} />
          Preencha o cachê acima para calcular as parcelas.
        </div>
      )}

      {/* Lista de parcelas */}
      <div className="flex flex-col gap-2">
        {parcelas.map((p, idx) => (
          <div
            key={p.id}
            className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center bg-elevated border border-border rounded-md p-2.5"
          >
            {/* Número */}
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: `${accent}20`, color: accent }}
            >
              {idx + 1}
            </div>

            {/* % ou R$ */}
            {modo === "percentual" ? (
              <div className="flex items-center gap-1.5">
                <TextInput
                  type="number"
                  min={0}
                  max={100}
                  value={p.percentual}
                  onChange={(e) => setPercentual(p.id, Number(e.target.value) || 0)}
                  className="w-20 text-right tabular-nums"
                />
                <span className="text-xs text-muted">%</span>
                <span className="text-xs text-secondary tabular-nums ml-1">
                  = {formatBRL(p.valor)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted">R$</span>
                <TextInput
                  type="number"
                  min={0}
                  value={p.valor}
                  onChange={(e) => setValor(p.id, Number(e.target.value) || 0)}
                  className="w-28 text-right tabular-nums"
                />
                <span className="text-xs text-secondary tabular-nums ml-1">
                  ({p.percentual.toFixed(0)}%)
                </span>
              </div>
            )}

            {/* Data de vencimento */}
            <TextInput
              type="date"
              value={p.dataVencimento}
              onChange={(e) => atualizar(p.id, { dataVencimento: e.target.value })}
            />

            {/* Remover */}
            <button
              type="button"
              onClick={() => remover(p.id)}
              disabled={parcelas.length === 1}
              className="btn-ghost p-1.5 rounded disabled:opacity-30"
              style={{ color: "var(--danger)" }}
              aria-label="Remover parcela"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Adicionar */}
      <button
        type="button"
        onClick={adicionar}
        className="mt-2 btn btn-secondary text-sm"
      >
        <Plus size={14} />
        Adicionar parcela
      </button>

      {/* Resumo */}
      <div
        className="mt-3 flex items-center justify-between gap-3 px-3 py-2 rounded-md border text-sm"
        style={{
          borderColor: tudoOk ? "var(--success)" : "var(--danger)",
          backgroundColor: tudoOk ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
        }}
      >
        <span className="text-secondary">
          {parcelas.length} {parcelas.length === 1 ? "parcela" : "parcelas"}
        </span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums font-semibold text-primary">
            {somaPercentual.toFixed(0)}% · {formatBRL(somaValor)}
          </span>
          {tudoOk ? (
            <CheckCircle2 size={15} style={{ color: "var(--success)" }} />
          ) : (
            <AlertTriangle size={15} style={{ color: "var(--danger)" }} />
          )}
        </span>
      </div>

      {!tudoOk && (
        <p className="text-xs text-danger mt-1.5">
          {modo === "percentual"
            ? `A soma das parcelas deve ser 100% (está ${somaPercentual.toFixed(0)}%)`
            : `A soma deve ser ${formatBRL(cacheTotal)} (está ${formatBRL(somaValor)})`}
        </p>
      )}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}
