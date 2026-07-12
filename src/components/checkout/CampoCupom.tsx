"use client";

import { useState } from "react";
import { Loader2, Tag, Check, X, AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { CicloCobranca, PlanoId } from "@/lib/planos";

/**
 * Campo discreto "Tem um cupom?" acima das abas do SeletorGateway. Fluxo:
 *
 *  1. Usuário digita o código e clica Aplicar → POST /api/checkout/cupom
 *     `acao:'validar'` (não consome uso, só feedback).
 *  2. Válido → mostra banner de sucesso e o pai entra em MODO GRÁTIS
 *     (esconde abas/gateways). Aparece o botão único "Ativar (1º mês grátis)".
 *  3. Ativar → POST /api/checkout/cupom `acao:'resgatar'` (RPC atômica: valida
 *     + consome + estende 30 dias). Sucesso → `onSucesso` (mesmo contrato que
 *     o gateway chama no aprovado, pro pai avançar o fluxo).
 *
 * Cupom de valor 0 NUNCA passa por gateway (Stripe recusa PaymentIntent de
 * amount 0) — por isso este caminho é 100% separado do MP/Stripe.
 */

type CupomAplicado = { codigo: string; dias: number };

type Props = {
  plano: PlanoId;
  ciclo: CicloCobranca;
  aplicado: CupomAplicado | null;
  onAplicado: (cupom: CupomAplicado) => void;
  onRemovido: () => void;
  onSucesso: () => void;
};

type RespostaValidar =
  | { valido: true; planoAlvo: string; dias: number }
  | { valido: false; codigo: string; erro: string };

const MENSAGENS_ERRO: Record<string, string> = {
  codigo_invalido: "Cupom não encontrado.",
  inativo: "Este cupom não está mais ativo.",
  expirado: "Este cupom expirou.",
  plano_nao_bate: "Este cupom não vale para o plano escolhido.",
  esgotado: "Este cupom já atingiu o limite de uso.",
  ja_usado: "Você já resgatou um cupom nesta conta.",
};

export default function CampoCupom({
  plano,
  ciclo,
  aplicado,
  onAplicado,
  onRemovido,
  onSucesso,
}: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [validando, setValidando] = useState(false);
  const [resgatando, setResgatando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function validar() {
    const cod = codigo.trim();
    if (!cod) return;
    setValidando(true);
    setErro(null);
    try {
      const res = await fetch("/api/checkout/cupom", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "validar", codigo: cod, plano, ciclo }),
      });
      const body = (await res.json()) as RespostaValidar;
      if (!res.ok) {
        setErro(t("Não foi possível validar o cupom."));
        return;
      }
      if (!body.valido) {
        setErro(t(MENSAGENS_ERRO[body.codigo] ?? body.erro));
        return;
      }
      onAplicado({ codigo: cod, dias: body.dias });
    } catch {
      setErro(t("Não foi possível validar o cupom."));
    } finally {
      setValidando(false);
    }
  }

  async function ativar() {
    if (!aplicado) return;
    setResgatando(true);
    setErro(null);
    try {
      const res = await fetch("/api/checkout/cupom", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "resgatar",
          codigo: aplicado.codigo,
          plano,
          ciclo,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setErro(t(MENSAGENS_ERRO[body.codigo] ?? body.erro ?? "Não foi possível ativar o cupom."));
        onRemovido();
        return;
      }
      onSucesso();
    } catch {
      setErro(t("Não foi possível ativar o cupom."));
      onRemovido();
    } finally {
      setResgatando(false);
    }
  }

  function remover() {
    setCodigo("");
    setErro(null);
    onRemovido();
  }

  // Cupom validado → banner de sucesso + botão único de ativação (modo grátis).
  if (aplicado) {
    return (
      <div className="mb-4">
        <div
          className="flex items-center justify-between gap-2 text-xs rounded-md px-3 py-2 mb-3"
          style={{
            backgroundColor: "color-mix(in srgb, var(--success) 8%, transparent)",
            color: "var(--success)",
            border: "1px solid color-mix(in srgb, var(--success) 30%, transparent)",
          }}
        >
          <span className="flex items-center gap-2">
            <Check size={12} className="flex-shrink-0" />
            {t("Cupom aplicado — primeiro mês grátis")}
          </span>
          <button
            type="button"
            onClick={remover}
            className="inline-flex items-center gap-1 text-xs hover:underline"
            style={{ color: "var(--success)" }}
          >
            <X size={12} />
            {t("Remover")}
          </button>
        </div>

        {erro && (
          <div
            className="flex items-center gap-2 text-xs rounded-md px-3 py-2 mb-3"
            style={{
              backgroundColor: "color-mix(in srgb, var(--danger) 8%, transparent)",
              color: "var(--danger)",
              border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
            }}
          >
            <AlertTriangle size={12} className="flex-shrink-0" />
            {erro}
          </div>
        )}

        <button
          type="button"
          onClick={ativar}
          disabled={resgatando}
          className="btn-primary w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-md disabled:opacity-60"
        >
          {resgatando ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Tag size={14} />
          )}
          {resgatando
            ? t("Ativando...")
            : t("Ativar (1º mês grátis)")}
        </button>
      </div>
    );
  }

  // Campo discreto fechado.
  if (!aberto) {
    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="text-xs hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          {t("Tem um cupom?")}
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value);
            if (erro) setErro(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              validar();
            }
          }}
          placeholder={t("Código do cupom")}
          className="flex-1 text-sm rounded-md px-3 py-2 bg-surface border border-border text-primary"
          disabled={validando}
        />
        <button
          type="button"
          onClick={validar}
          disabled={validando || !codigo.trim()}
          className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md disabled:opacity-60"
        >
          {validando ? <Loader2 size={14} className="animate-spin" /> : null}
          {t("Aplicar")}
        </button>
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setCodigo("");
            setErro(null);
          }}
          className="text-xs hover:underline flex-shrink-0"
          style={{ color: "var(--text-muted)" }}
        >
          {t("Cancelar")}
        </button>
      </div>

      {erro && (
        <div
          className="flex items-center gap-2 text-xs rounded-md px-3 py-2 mt-2"
          style={{
            backgroundColor: "color-mix(in srgb, var(--danger) 8%, transparent)",
            color: "var(--danger)",
            border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
          }}
        >
          <AlertTriangle size={12} className="flex-shrink-0" />
          {erro}
        </div>
      )}
    </div>
  );
}
