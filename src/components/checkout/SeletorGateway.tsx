"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, AlertTriangle, CreditCard, QrCode } from "lucide-react";
import { useT } from "@/lib/i18n";
import PagamentoStripeElement from "./PagamentoStripeElement";
import MercadoPagoSecureFields from "./MercadoPagoSecureFields";
import { type DadosPixBrick } from "./MercadoPagoBrick";
import PixPendente from "./PixPendente";
import CampoCupom from "./CampoCupom";
import { getPlano, valorMensal, valorAnual, type CicloCobranca, type PlanoId, type Moeda } from "@/lib/planos";
import type { Gateway } from "@/lib/gateway";

/**
 * Seletor de gateway de pagamento — abas "Mercado Pago" (PIX ou cartão em até
 * 12x) e "Cartão (Stripe)". A aba default vem de GET /api/checkout/opcoes
 * (roteamento por país, `lib/gateway.ts`). Fora do Brasil só existe Stripe —
 * sem abas, sem seletor.
 *
 * Cada lado degrada independentemente via onIndisponivel:
 *  - Mercado Pago indisponível (env ausente/país fora do BR) → some a aba,
 *    fica só Stripe.
 *  - Ambos indisponíveis → chama `onFallbackHosted` (o pai mostra o botão de
 *    checkout hospedado da Stripe, igual ao fluxo antigo).
 *
 * Fluxo PIX: MercadoPagoSecureFields devolve o QR Code via onPix → troca pro
 * PixPendente (polling do status). Aprovado (cartão OU PIX) → onSucesso.
 */

type Props = {
  plano: PlanoId;
  ciclo: CicloCobranca;
  /** Ambos os gateways embutidos falharam — o pai deve mostrar o fallback hospedado. */
  onFallbackHosted: () => void;
  /** Pagamento aprovado (cartão Stripe via redirect não passa por aqui — só MP). */
  onSucessoMercadoPago: (paymentId: string) => void;
  /** Cupom resgatado com sucesso (acesso já estendido server-side — sem gateway). */
  onSucessoCupom?: () => void;
};

type Opcoes = {
  gatewayPadrao: Gateway;
  gatewaysDisponiveis: Gateway[];
  moeda: Moeda;
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
  const [cupomAplicado, setCupomAplicado] = useState<{ codigo: string; dias: number } | null>(null);

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

  const mostraMp =
    opcoes.gatewaysDisponiveis.includes("mercadopago") && !mpIndisponivel;
  const mostraStripe = !stripeIndisponivel;
  const mostraAbas = mostraMp && mostraStripe;

  return (
    <div>
      <CampoCupom
        plano={plano}
        ciclo={ciclo}
        aplicado={cupomAplicado}
        onAplicado={(c) => setCupomAplicado(c)}
        onRemovido={() => setCupomAplicado(null)}
        onSucesso={() => onSucessoCupom?.()}
      />

      {!cupomAplicado && mostraAbas && (
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
            {t("Mercado Pago — PIX ou cartão em até 12x")}
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
            {t("Cartão (Stripe)")}
          </button>
        </div>
      )}

      {!cupomAplicado && aba === "mercadopago" && mostraMp && (
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
                valor={
                  ciclo === "anual"
                    ? valorAnual(getPlano(plano), opcoes.moeda)
                    : valorMensal(getPlano(plano), opcoes.moeda)
                }
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

      {!cupomAplicado && aba === "stripe" && mostraStripe && (
        <PagamentoStripeElement
          plano={plano}
          ciclo={ciclo}
          valor={
            ciclo === "anual"
              ? valorAnual(getPlano(plano), opcoes.moeda)
              : valorMensal(getPlano(plano), opcoes.moeda)
          }
          moeda={opcoes.moeda}
          onIndisponivel={marcarStripeIndisponivel}
        />
      )}
    </div>
  );
}
