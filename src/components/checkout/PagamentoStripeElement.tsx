"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, CreditCard } from "lucide-react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { Stripe, StripeElementsOptions, Appearance } from "@stripe/stripe-js";
import { useT } from "@/lib/i18n";
import { getStripe } from "./stripe-client";

/**
 * Payment Element da Stripe montado NA NOSSA página (form nosso), no padrão
 * DEFERRED INTENT: nenhum PaymentIntent é criado no load — só no submit.
 * Substitui o Embedded Checkout (iframe da Stripe) na aba Stripe do
 * SeletorGateway, espelhando o par brasileiro (MercadoPago Secure Fields).
 *
 * Fluxo de submit (ORDEM importa):
 *  1. `elements.submit()` — valida os campos do Payment Element localmente.
 *  2. POST /api/checkout/stripe { ui:'payment_element', plano, ciclo } → cria o
 *     PaymentIntent no servidor (moeda derivada do IP/cookie) e devolve o
 *     `clientSecret`. Só aqui um PI passa a existir.
 *  3. `stripe.confirmPayment({ elements, clientSecret, confirmParams:{ return_url } })`
 *     → confirma o cartão e redireciona pro /pagamento/retorno?status=success.
 *
 * O acesso NÃO é concedido aqui: quem estende é o webhook
 * `payment_intent.succeeded` (RPC registrar_pagamento_estender). O
 * /pagamento/retorno só faz polling de `acessoAte > now`.
 *
 * SAQ-A: os dados de cartão vivem SÓ dentro do iframe do Payment Element
 * (Stripe.js de js.stripe.com) — nunca no nosso DOM.
 *
 * Sem `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (ou se o Stripe.js não carrega),
 * dispara `onIndisponivel()` — o pai degrada (mesmo contrato do
 * CheckoutEmbutido/MercadoPagoBrick).
 */

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

type Props = {
  plano: string;
  ciclo: string;
  /** valor TOTAL na unidade da moeda (reais/dólares) — vira `amount` em centavos. */
  valor: number;
  /** código ISO da moeda em minúsculo ('brl' | 'usd') pro Elements. */
  moeda: string;
  /**
   * Crédito de upgrade em DIAS (modelo pré-pago), opcional — repassado pro body;
   * o servidor recalcula e limita, nunca confia no valor cru. Omitido em plano novo.
   */
  creditoDias?: number;
  /**
   * Chamado quando a chave pública não está configurada / o Stripe.js falha —
   * o pai deve degradar (mesmo contrato do CheckoutEmbutido).
   */
  onIndisponivel?: () => void;
};

/**
 * Aparência do Payment Element — espelha os MESMOS tokens do design system que o
 * MercadoPagoBrick usa (primária azul, superfície/input escuros, texto claro,
 * radius 10px). Lido em runtime das CSS vars do :root pra NÃO hardcodar hex; se
 * o computed style não estiver disponível (SSR/edge), cai num tema 'night' cru.
 */
function lerToken(nome: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(nome)
    .trim();
  return v || undefined;
}

export function aparenciaGC(): Appearance {
  const variables: Record<string, string> = { borderRadius: "10px" };
  const primaria = lerToken("--brand");
  const fundo = lerToken("--bg-surface");
  const texto = lerToken("--text-primary");
  const perigo = lerToken("--danger");
  if (primaria) variables.colorPrimary = primaria;
  if (fundo) variables.colorBackground = fundo;
  if (texto) variables.colorText = texto;
  if (perigo) variables.colorDanger = perigo;
  variables.fontFamily =
    "'Hanken Grotesk', system-ui, -apple-system, sans-serif";
  return { theme: "night", variables };
}

/** Resumo simples do pedido (o claude design estiliza depois). */
function ResumoPedido() {
  const t = useT();
  return (
    <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
      {t("Pague com cartão de crédito de forma segura.")}
    </p>
  );
}

/** Container do Payment Element (campos de cartão dentro do iframe da Stripe). */
function CampoPagamento() {
  return <PaymentElement options={{ layout: "tabs" }} />;
}

/** Botão de pagar — reflete o estado de processamento. */
function BotaoPagar({
  processando,
  desabilitado,
}: {
  processando: boolean;
  desabilitado: boolean;
}) {
  const t = useT();
  return (
    <button
      type="submit"
      disabled={desabilitado}
      className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-control w-full mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {processando ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <CreditCard size={14} />
      )}
      {t("Pagar com cartão")}
    </button>
  );
}

/** Erro inline no MESMO padrão do MP/CheckoutEmbutido. */
function ErroInline({ msg }: { msg: string }) {
  return (
    <div
      className="flex items-center gap-2 text-xs rounded-md px-3 py-2 mt-3"
      style={{
        backgroundColor: "color-mix(in srgb, var(--danger) 8%, transparent)",
        color: "var(--danger)",
        border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
      }}
    >
      <AlertTriangle size={12} className="flex-shrink-0" />
      {msg}
    </div>
  );
}

/** Form interno — precisa viver DENTRO do <Elements> pra usar useStripe/useElements. */
function CheckoutForm({
  plano,
  ciclo,
  creditoDias,
}: {
  plano: string;
  ciclo: string;
  creditoDias?: number;
}) {
  const t = useT();
  const stripe = useStripe();
  const elements = useElements();
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || processando) return;
    setErro(null);
    setProcessando(true);
    try {
      // (1) Valida os campos localmente ANTES de criar qualquer PI no servidor.
      const { error: erroSubmit } = await elements.submit();
      if (erroSubmit) {
        setErro(erroSubmit.message ?? t("Verifique os dados do cartão."));
        return;
      }

      // (2) Cria o PaymentIntent no servidor e pega o clientSecret.
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plano,
          ciclo,
          ui: "payment_element",
          ...(creditoDias ? { creditoDias } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.clientSecret) {
        setErro((body.erro as string) ?? `HTTP ${res.status}`);
        return;
      }

      // (3) Confirma o pagamento — redireciona pro retorno em caso de sucesso.
      const { error: erroConfirma } = await stripe.confirmPayment({
        elements,
        clientSecret: body.clientSecret as string,
        confirmParams: {
          return_url:
            window.location.origin + "/pagamento/retorno?status=success",
        },
      });
      // Só chega aqui se a confirmação falhou SEM redirecionar (cartão recusado,
      // erro de validação). O caminho feliz sai da página via return_url.
      if (erroConfirma) {
        setErro(erroConfirma.message ?? t("Pagamento recusado."));
      }
    } catch (err) {
      setErro((err as Error).message ?? t("Falha ao processar o pagamento."));
    } finally {
      setProcessando(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <CampoPagamento />
      {erro && <ErroInline msg={erro} />}
      <BotaoPagar processando={processando} desabilitado={!stripe || processando} />
    </form>
  );
}

export default function PagamentoStripeElement({
  plano,
  ciclo,
  valor,
  moeda,
  creditoDias,
  onIndisponivel,
}: Props) {
  const t = useT();

  // Sem chave pública → degrada (mesmo contrato dos outros gateways).
  const stripe: Promise<Stripe | null> | null = useMemo(
    () => (PUBLISHABLE_KEY ? getStripe() : null),
    []
  );

  // Opções do Elements no modo DEFERRED INTENT (sem client_secret no load:
  // nenhum PI é criado até o submit). O `amount` é em centavos.
  const options: StripeElementsOptions = useMemo(
    () => ({
      mode: "payment",
      amount: Math.round(valor * 100),
      currency: moeda,
      paymentMethodTypes: ["card"],
      appearance: aparenciaGC(),
    }),
    [valor, moeda]
  );

  const indisponivel = !PUBLISHABLE_KEY || !stripe;

  // Degrada no EFEITO (nunca durante o render — senão dispara setState do pai no
  // meio do render, erro do React). Cobre (a) sem publishable key e (b) o
  // Stripe.js que falha em carregar (rede/adblock) → a promise rejeita/resolve null.
  useEffect(() => {
    if (!PUBLISHABLE_KEY) {
      onIndisponivel?.();
      return;
    }
    if (!stripe) return;
    let ativo = true;
    stripe
      .then((s) => {
        if (ativo && !s) onIndisponivel?.();
      })
      .catch(() => {
        if (ativo) onIndisponivel?.();
      });
    return () => {
      ativo = false;
    };
  }, [stripe, onIndisponivel]);

  if (indisponivel) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" />
        {t("Carregando o pagamento seguro...")}
      </div>
    );
  }

  return (
    <div>
      <ResumoPedido />
      <Elements stripe={stripe} options={options}>
        <CheckoutForm plano={plano} ciclo={ciclo} creditoDias={creditoDias} />
      </Elements>
    </div>
  );
}
