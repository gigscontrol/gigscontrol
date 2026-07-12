"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import type {
  Stripe,
  StripeEmbeddedCheckout,
} from "@stripe/stripe-js";
import { useT } from "@/lib/i18n";

/**
 * Embedded Checkout da Stripe (iframe montado na nossa página).
 *
 * Faz `loadStripe(NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)` e monta o checkout
 * embutido buscando o `clientSecret` via POST /api/checkout/stripe
 * ({ui:'embedded'}). Ao concluir, a Stripe redireciona pro `return_url`
 * (/pagamento/retorno?session_id=...), configurado no servidor.
 *
 * DESVIO DO SPEC: o spec pedia `initEmbeddedCheckout({fetchClientSecret})`,
 * mas o SDK pinado (@stripe/stripe-js@9) expõe `createEmbeddedCheckoutPage`
 * (par do `ui_mode:'embedded_page'` no servidor). Mesma assinatura de
 * opções e mesmo objeto de retorno (mount/unmount/destroy).
 *
 * FALLBACK: se `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` estiver ausente, não
 * monta o iframe e chama `onIndisponivel()` pra o pai degradar pro fluxo
 * hospedado (redirect). Assim não quebra prod antes da env estar setada.
 */

type Props = {
  plano: string;
  ciclo: string;
  /**
   * Crédito de upgrade em DIAS (modelo pré-pago), opcional — repassado pro
   * metadata da Checkout Session; o webhook recalcula e saneia, nunca confia
   * no valor cru. Omitido em checkout de plano novo (sem crédito).
   */
  creditoDias?: number;
  /**
   * Chamado quando a chave pública não está configurada — o pai deve
   * degradar pro checkout hospedado (redirect) em vez de mostrar o iframe.
   */
  onIndisponivel?: () => void;
};

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// Memoiza a Promise do loadStripe (recomendação da Stripe: fora do render).
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> {
  if (!PUBLISHABLE_KEY) return Promise.resolve(null);
  if (!stripePromise) stripePromise = loadStripe(PUBLISHABLE_KEY);
  return stripePromise;
}

export default function CheckoutEmbutido({ plano, ciclo, creditoDias, onIndisponivel }: Props) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // Sem chave pública → degrada pro fluxo hospedado.
    if (!PUBLISHABLE_KEY) {
      onIndisponivel?.();
      return;
    }

    let ativo = true;
    let checkout: StripeEmbeddedCheckout | null = null;

    (async () => {
      try {
        const stripe = await getStripe();
        if (!ativo) return;
        if (!stripe) {
          onIndisponivel?.();
          return;
        }

        checkout = await stripe.createEmbeddedCheckoutPage({
          // Busca o client_secret sob demanda (contrato do Embedded Checkout).
          fetchClientSecret: async () => {
            const res = await fetch("/api/checkout/stripe", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                plano,
                ciclo,
                ui: "embedded",
                ...(creditoDias ? { creditoDias } : {}),
              }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body.clientSecret) {
              throw new Error(
                (body.erro as string) ?? `HTTP ${res.status}`
              );
            }
            return body.clientSecret as string;
          },
        });

        // Race: componente pode ter desmontado durante o await.
        if (!ativo || !containerRef.current) {
          checkout.destroy();
          checkout = null;
          return;
        }

        checkout.mount(containerRef.current);
        setCarregando(false);
      } catch (e) {
        if (ativo) {
          setErro((e as Error).message ?? t("Falha ao carregar o pagamento."));
          setCarregando(false);
        }
      }
    })();

    return () => {
      ativo = false;
      // destroy() é seguro chamar uma vez; limpa o iframe no unmount.
      try {
        checkout?.destroy();
      } catch {
        /* já destruído — ignora */
      }
    };
  }, [plano, ciclo, creditoDias, onIndisponivel, t]);

  if (erro) {
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
        {erro}
      </div>
    );
  }

  return (
    <div className="relative">
      {carregando && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" />
          {t("Carregando o pagamento seguro...")}
        </div>
      )}
      {/* A Stripe injeta o iframe aqui. */}
      <div ref={containerRef} />
    </div>
  );
}
