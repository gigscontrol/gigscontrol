"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, AlertTriangle, CreditCard, QrCode, Tag } from "lucide-react";
import { useT } from "@/lib/i18n";
import PagamentoStripeElement from "./PagamentoStripeElement";
import MercadoPagoSecureFields from "./MercadoPagoSecureFields";
import { type DadosPixBrick } from "./MercadoPagoBrick";
import PixPendente from "./PixPendente";
import CampoCupom from "./CampoCupom";
import ResumoPedido from "./ResumoPedido";
import {
  getPlano,
  valorMensal,
  valorAnual,
  type CicloCobranca,
  type PlanoId,
  type Moeda,
} from "@/lib/planos";
import type { Gateway } from "@/lib/gateway";

/**
 * Checkout Nível 2 em 2 colunas: PAGAMENTO (esquerda) + RESUMO DO PEDIDO
 * (direita, com o campo de cupom descontando o valor).
 *
 * Pagamento: seletor Mercado Pago | Stripe no topo. Dentro do Mercado Pago há o
 * toggle Cartão | PIX (no próprio MercadoPagoSecureFields); Stripe é só cartão.
 * Parcelamento aparece só no anual + Mercado Pago (sem anunciar).
 *
 * Cupom: aplicado no Resumo → o valor zera (1º mês grátis) e a coluna de
 * Pagamento troca pro botão "Ativar" — não passa por gateway (Stripe não aceita
 * PaymentIntent de R$ 0).
 *
 * Degradação: cada gateway some via onIndisponivel; se os dois caírem,
 * onFallbackHosted (o pai mostra o checkout hospedado da Stripe).
 */

type Props = {
  plano: PlanoId;
  ciclo: CicloCobranca;
  onFallbackHosted: () => void;
  onSucessoMercadoPago: (paymentId: string) => void;
  onSucessoCupom?: () => void;
};

type Opcoes = {
  gatewayPadrao: Gateway;
  gatewaysDisponiveis: Gateway[];
  moeda: Moeda;
};

type CupomAplicado = { codigo: string; dias: number };

const MENSAGENS_ERRO_CUPOM: Record<string, string> = {
  codigo_invalido: "Cupom não encontrado.",
  inativo: "Este cupom não está mais ativo.",
  expirado: "Este cupom expirou.",
  plano_nao_bate: "Este cupom não vale para o plano escolhido.",
  esgotado: "Este cupom já atingiu o limite de uso.",
  ja_usado: "Você já resgatou um cupom nesta conta.",
};

export default function SeletorGateway({
  plano,
  ciclo,
  onFallbackHosted,
  onSucessoMercadoPago,
  onSucessoCupom,
}: Props) {
  const t = useT();
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(true);
  const [erroOpcoes, setErroOpcoes] = useState<string | null>(null);

  const [cupomAplicado, setCupomAplicado] = useState<CupomAplicado | null>(null);
  const [resgatando, setResgatando] = useState(false);
  const [erroCupom, setErroCupom] = useState<string | null>(null);

  const [aba, setAba] = useState<Gateway | null>(null);
  const [mpIndisponivel, setMpIndisponivel] = useState(false);
  const [stripeIndisponivel, setStripeIndisponivel] = useState(false);

  const [pix, setPix] = useState<DadosPixBrick | null>(null);
  const [erroMp, setErroMp] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch("/api/checkout/opcoes", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as Opcoes;
      })
      .then((d) => {
        if (!ativo) return;
        setOpcoes(d);
        setAba(d.gatewayPadrao);
      })
      .catch((e) => {
        if (ativo) setErroOpcoes((e as Error).message);
      })
      .finally(() => {
        if (ativo) setCarregandoOpcoes(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const marcarMpIndisponivel = useCallback(() => {
    setMpIndisponivel(true);
    setAba((a) => (a === "mercadopago" ? "stripe" : a));
  }, []);

  const marcarStripeIndisponivel = useCallback(() => {
    setStripeIndisponivel(true);
    setAba((a) => (a === "stripe" ? "mercadopago" : a));
  }, []);

  // Ambos os gateways embutidos falharam → fallback hospedado.
  useEffect(() => {
    if (!opcoes) return;
    const mpElegivel = opcoes.gatewaysDisponiveis.includes("mercadopago");
    const mpOk = mpElegivel && !mpIndisponivel;
    const stripeOk = !stripeIndisponivel;
    if (!mpOk && !stripeOk) onFallbackHosted();
  }, [opcoes, mpIndisponivel, stripeIndisponivel, onFallbackHosted]);

  async function resgatarCupom() {
    if (!cupomAplicado) return;
    setResgatando(true);
    setErroCupom(null);
    try {
      const res = await fetch("/api/checkout/cupom", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "resgatar",
          codigo: cupomAplicado.codigo,
          plano,
          ciclo,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setErroCupom(
          t(
            MENSAGENS_ERRO_CUPOM[body.codigo] ??
              body.erro ??
              "Não foi possível ativar o cupom."
          )
        );
        setCupomAplicado(null);
        return;
      }
      onSucessoCupom?.();
    } catch {
      setErroCupom(t("Não foi possível ativar o cupom."));
    } finally {
      setResgatando(false);
    }
  }

  if (carregandoOpcoes) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" />
        {t("Carregando o pagamento seguro...")}
      </div>
    );
  }

  if (erroOpcoes || !opcoes) {
    return (
      <div
        className="flex items-center gap-2 text-xs rounded-md px-3 py-2"
        style={{
          backgroundColor: "color-mix(in srgb, var(--danger) 8%, transparent)",
          color: "var(--danger)",
          border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
        }}
      >
        <AlertTriangle size={12} className="flex-shrink-0" />
        {t("Não foi possível carregar as opções de pagamento.")}
      </div>
    );
  }

  const subtotal =
    ciclo === "anual"
      ? valorAnual(getPlano(plano), opcoes.moeda)
      : valorMensal(getPlano(plano), opcoes.moeda);

  const mostraMp =
    opcoes.gatewaysDisponiveis.includes("mercadopago") && !mpIndisponivel;
  const mostraStripe = !stripeIndisponivel;
  const mostraAbas = mostraMp && mostraStripe;

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      {/* ── PAGAMENTO ── */}
      <div>
        <div
          className="text-xs uppercase mb-3"
          style={{ color: "var(--text-muted)", letterSpacing: "0.06em" }}
        >
          {t("Pagamento")}
        </div>

        {cupomAplicado ? (
          <div
            className="p-4 text-center"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
            }}
          >
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
              {t("Com o cupom você não paga hoje. Ative pra liberar o acesso.")}
            </p>
            {erroCupom && (
              <div
                className="flex items-center gap-2 text-xs rounded-md px-3 py-2 mb-3 text-left"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--danger) 8%, transparent)",
                  color: "var(--danger)",
                  border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
                }}
              >
                <AlertTriangle size={12} className="flex-shrink-0" />
                {erroCupom}
              </div>
            )}
            <button
              type="button"
              onClick={resgatarCupom}
              disabled={resgatando}
              className="btn-primary w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-md disabled:opacity-60"
            >
              {resgatando ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Tag size={14} />
              )}
              {resgatando ? t("Ativando...") : t("Ativar (1º mês grátis)")}
            </button>
          </div>
        ) : (
          <>
            {mostraAbas && (
              <div className="mb-4 inline-flex items-center gap-1 bg-surface border border-border rounded-full p-1 w-full">
                <button
                  type="button"
                  onClick={() => setAba("mercadopago")}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full transition-colors ${
                    aba === "mercadopago"
                      ? "bg-elevated text-primary"
                      : "text-muted hover:text-secondary"
                  }`}
                >
                  <QrCode size={13} />
                  {t("Mercado Pago")}
                </button>
                <button
                  type="button"
                  onClick={() => setAba("stripe")}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full transition-colors ${
                    aba === "stripe"
                      ? "bg-elevated text-primary"
                      : "text-muted hover:text-secondary"
                  }`}
                >
                  <CreditCard size={13} />
                  {t("Stripe")}
                </button>
              </div>
            )}

            {aba === "mercadopago" && mostraMp && (
              <div>
                {pix ? (
                  <PixPendente
                    dados={pix}
                    onAprovado={onSucessoMercadoPago}
                    onGerarNovo={() => setPix(null)}
                  />
                ) : (
                  <>
                    {erroMp && (
                      <div
                        className="flex items-center gap-2 text-xs rounded-md px-3 py-2 mb-3"
                        style={{
                          backgroundColor: "color-mix(in srgb, var(--danger) 8%, transparent)",
                          color: "var(--danger)",
                          border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
                        }}
                      >
                        <AlertTriangle size={12} className="flex-shrink-0" />
                        {erroMp}
                      </div>
                    )}
                    <MercadoPagoSecureFields
                      plano={plano}
                      ciclo={ciclo}
                      valor={subtotal}
                      onAprovado={onSucessoMercadoPago}
                      onPix={(d) => {
                        setErroMp(null);
                        setPix(d);
                      }}
                      onErro={(msg) => setErroMp(msg)}
                      onIndisponivel={marcarMpIndisponivel}
                    />
                  </>
                )}
              </div>
            )}

            {aba === "stripe" && mostraStripe && (
              <PagamentoStripeElement
                plano={plano}
                ciclo={ciclo}
                valor={subtotal}
                moeda={opcoes.moeda}
                onIndisponivel={marcarStripeIndisponivel}
              />
            )}
          </>
        )}
      </div>

      {/* ── RESUMO ── */}
      <div>
        <ResumoPedido
          plano={plano}
          ciclo={ciclo}
          moeda={opcoes.moeda}
          subtotal={subtotal}
          cupomAplicado={cupomAplicado}
        >
          <CampoCupom
            plano={plano}
            ciclo={ciclo}
            aplicado={cupomAplicado}
            onAplicado={(c) => {
              setErroCupom(null);
              setCupomAplicado(c);
            }}
            onRemovido={() => {
              setErroCupom(null);
              setCupomAplicado(null);
            }}
          />
        </ResumoPedido>
      </div>
    </div>
  );
}
