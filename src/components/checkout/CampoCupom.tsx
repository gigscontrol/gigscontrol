"use client";

import { useState } from "react";
import { Loader2, Tag, Check, X, AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { CicloCobranca, PlanoId } from "@/lib/planos";

/**
 * Campo de cupom DENTRO do Resumo do pedido. Só valida e aplica — o desconto
 * aparece nos totais do Resumo, e o botão "Ativar (1º mês grátis)" fica na
 * coluna de Pagamento (o SeletorGateway resgata). Fluxo:
 *
 *  1. Digita o código + Aplicar → POST /api/checkout/cupom `acao:'validar'`
 *     (não consome uso, só confere).
 *  2. Válido → `onAplicado({ codigo, dias })` → o Resumo mostra o desconto e a
 *     coluna de Pagamento troca pro botão de ativar.
 *  3. Remover → `onRemovido()` volta ao valor cheio.
 */

type CupomAplicado = { codigo: string; dias: number };

type Props = {
  plano: PlanoId;
  ciclo: CicloCobranca;
  aplicado: CupomAplicado | null;
  onAplicado: (cupom: CupomAplicado) => void;
  onRemovido: () => void;
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
}: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [validando, setValidando] = useState(false);
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
      setAberto(false);
    } catch {
      setErro(t("Não foi possível validar o cupom."));
    } finally {
      setValidando(false);
    }
  }

  function remover() {
    setCodigo("");
    setErro(null);
    onRemovido();
  }

  // Aplicado → linha compacta (o desconto em si aparece nos totais do Resumo).
  if (aplicado) {
    return (
      <div
        className="flex items-center justify-between gap-2 text-xs rounded-md px-3 py-2 mb-1"
        style={{
          backgroundColor: "color-mix(in srgb, var(--success) 8%, transparent)",
          color: "var(--success)",
          border: "1px solid color-mix(in srgb, var(--success) 30%, transparent)",
        }}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <Check size={12} className="flex-shrink-0" />
          <span className="truncate">
            {t("Cupom {codigo} aplicado", { codigo: aplicado.codigo })}
          </span>
        </span>
        <button
          type="button"
          onClick={remover}
          className="inline-flex items-center gap-1 hover:underline flex-shrink-0"
          style={{ color: "var(--success)" }}
        >
          <X size={12} />
          {t("Remover")}
        </button>
      </div>
    );
  }

  // Fechado → link discreto.
  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 text-xs hover:underline mb-1"
        style={{ color: "var(--text-muted)" }}
      >
        <Tag size={12} />
        {t("Tem um cupom?")}
      </button>
    );
  }

  return (
    <div className="mb-1">
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
          autoFocus
        />
        <button
          type="button"
          onClick={validar}
          disabled={validando || !codigo.trim()}
          className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-control disabled:opacity-60"
        >
          {validando ? <Loader2 size={14} className="animate-spin" /> : null}
          {t("Aplicar")}
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
