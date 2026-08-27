"use client";

import { useEffect, useId, useRef, useState } from "react";
import Script from "next/script";
import { Loader2, AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Payment Brick do Mercado Pago embutido na nossa página (v1: PIX + cartão,
 * SEM boleto/ticket). Par brasileiro do `CheckoutEmbutido` da Stripe — expõe o
 * MESMO contrato de props (`onIndisponivel` quando a env/SDK falha) pra o
 * chamador (W5) degradar sem quebrar.
 *
 * Fluxo:
 *  1. Carrega o SDK v2 (`sdk.mercadopago.com/js/v2`) via next/script.
 *  2. `new MercadoPago(publicKey)` + `bricks().create('payment', ...)`.
 *  3. `onSubmit({ formData })` → POST /api/checkout/mercadopago. O backend cria
 *     o pagamento a partir do token que o Brick tokenizou no browser (SAQ-A —
 *     NUNCA transita PAN/CVV por aqui).
 *  4. Cartão APPROVED → `onAprovado(paymentId)`. PIX pending → `onPix(dadosPix)`.
 *
 * Sem `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` (ou se o SDK não carrega), dispara
 * `onIndisponivel()` e não monta nada.
 */

// Aceita também o nome legado sem underscore — é o que a Vercel de produção
// ainda tem (env "Sensitive", não recriável). Ambas as expressões são inlined
// no build, então o fallback resolve em build time.
const PUBLIC_KEY =
  process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY ??
  process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

/** QR Code PIX devolvido pro pai (repassado ao PixPendente). */
export type DadosPixBrick = {
  paymentId: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
};

type Props = {
  plano: string;
  ciclo: string;
  /** valor TOTAL em REAIS (o Brick pede o amount em unidade da moeda). */
  valor: number;
  onAprovado: (paymentId: string) => void;
  onPix: (dados: DadosPixBrick) => void;
  onErro: (msg: string) => void;
  /** Env ausente / SDK falhou / public key inválida → o pai degrada. */
  onIndisponivel: () => void;
};

// Shape mínimo do SDK que usamos (o pacote não tem types oficiais no npm).
type BrickController = { unmount: () => void };
type PaymentBrickResult = {
  formData?: Record<string, unknown>;
  [k: string]: unknown;
};
type MercadoPagoInstance = {
  bricks: () => {
    create: (
      brick: "payment",
      containerId: string,
      settings: unknown
    ) => Promise<BrickController>;
  };
};
type MercadoPagoCtor = new (
  publicKey: string,
  options?: { locale?: string }
) => MercadoPagoInstance;

declare global {
  interface Window {
    MercadoPago?: MercadoPagoCtor;
  }
}

export default function MercadoPagoBrick({
  plano,
  ciclo,
  valor,
  onAprovado,
  onPix,
  onErro,
  onIndisponivel,
}: Props) {
  const t = useT();
  // id único e válido pra um container DOM (o Brick monta por id de elemento).
  const rawId = useId();
  const containerId = `mp-brick-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const [sdkPronto, setSdkPronto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // O Brick chama onError tanto na FALHA DE INIT (public key/credencial ruim,
  // ANTES de renderizar) quanto em VALIDAÇÃO DE CAMPO (ex.: número de cartão
  // incompleto enquanto digita). Só o primeiro caso deve degradar pro Stripe —
  // por isso rastreamos se o Brick chegou a ficar pronto (onReady).
  const prontoRef = useRef(false);

  // Guarda callbacks/valores voláteis pra o onSubmit (registrado uma vez) não
  // fechar sobre versões velhas nem re-montar o Brick a cada render.
  const cbRef = useRef({ plano, ciclo, onAprovado, onPix, onErro, t });
  cbRef.current = { plano, ciclo, onAprovado, onPix, onErro, t };

  // Sem public key → indisponível na hora (o pai degrada pro Stripe).
  useEffect(() => {
    if (!PUBLIC_KEY) {
      onIndisponivel();
      setCarregando(false);
    }
  }, [onIndisponivel]);

  // Monta o Brick quando o SDK terminar de carregar.
  useEffect(() => {
    if (!PUBLIC_KEY || !sdkPronto) return;

    let ativo = true;
    let controller: BrickController | null = null;

    (async () => {
      const Ctor = window.MercadoPago;
      if (!Ctor) {
        onIndisponivel();
        return;
      }
      try {
        const mp = new Ctor(PUBLIC_KEY, { locale: "pt-BR" });
        // Lê os tokens computados no momento de montar o Brick (o iframe do MP
        // não enxerga nossas CSS vars) — acompanha o tema ativo (claro/escuro).
        // Limitação aceita: alternar o tema com o Brick já montado não retematiza
        // o iframe em tempo real.
        const raiz = document.documentElement;
        const temaClaro = raiz.getAttribute("data-theme") === "light";
        const estiloRaiz = getComputedStyle(raiz);
        const corVar = (nome: string, fallback: string) =>
          estiloRaiz.getPropertyValue(nome).trim() || fallback;
        controller = await mp.bricks().create("payment", containerId, {
          initialization: {
            amount: valor,
          },
          customization: {
            paymentMethods: {
              // v1: só cartão de crédito + PIX (bankTransfer). SEM ticket/boleto.
              creditCard: "all",
              bankTransfer: "all",
              maxInstallments: 12,
            },
            // Tema alinhado aos tokens do design system (claro/escuro).
            visual: {
              style: {
                theme: temaClaro ? "default" : "dark",
                customVariables: {
                  baseColor: corVar("--brand", "#3D7BFF"),
                  formBackgroundColor: corVar("--bg-surface", "#12151D"),
                  inputBackgroundColor: corVar("--bg-surface-2", "#161A24"),
                  textPrimaryColor: corVar("--text-primary", "#F4F6FB"),
                  textSecondaryColor: corVar("--text-secondary", "#9AA4B2"),
                  borderRadiusMedium: "10px",
                },
              },
            },
          },
          callbacks: {
            onReady: () => {
              prontoRef.current = true;
              if (ativo) setCarregando(false);
            },
            onError: (e: { type?: string; message?: string } | undefined) => {
              if (!ativo) return;
              // eslint-disable-next-line no-console
              console.error("[MercadoPagoBrick] onError", e?.type, e?.message);
              if (!prontoRef.current) {
                // Antes de renderizar = falha de init (credencial/SDK inválida) →
                // degrada pro Stripe, como o CheckoutEmbutido faz.
                setCarregando(false);
                onIndisponivel();
              } else if (e?.type === "critical") {
                // Erro CRÍTICO depois de pronto (ex.: credencial recusada ao
                // processar) → mostra o aviso, mas NÃO troca de aba.
                cbRef.current.onErro(
                  e?.message || cbRef.current.t("Falha no pagamento pelo Mercado Pago.")
                );
              }
              // Erro NÃO-crítico depois de pronto = validação de campo enquanto
              // digita → ignora (o próprio Brick mostra a mensagem inline).
            },
            onSubmit: ({ formData }: PaymentBrickResult) => {
              const c = cbRef.current;
              return new Promise<void>((resolve, reject) => {
                fetch("/api/checkout/mercadopago", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    plano: c.plano,
                    ciclo: c.ciclo,
                    formData,
                  }),
                })
                  .then(async (res) => {
                    const body = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      const msg =
                        (body.erro as string) ??
                        c.t("Falha ao processar o pagamento.");
                      c.onErro(msg);
                      reject(new Error(msg));
                      return;
                    }
                    const status = body.status as string;
                    const paymentId = String(body.paymentId ?? "");
                    if (status === "approved") {
                      c.onAprovado(paymentId);
                      resolve();
                    } else if (status === "pending" && body.qrCodeBase64) {
                      // PIX pending com QR Code.
                      c.onPix({
                        paymentId,
                        qrCode: (body.qrCode as string) ?? null,
                        qrCodeBase64: (body.qrCodeBase64 as string) ?? null,
                        ticketUrl: (body.ticketUrl as string) ?? null,
                      });
                      resolve();
                    } else if (status === "in_process" || status === "pending") {
                      // Cartão em análise — trata como erro suave pro usuário.
                      c.onErro(
                        c.t("Pagamento em análise. Tente outro cartão.")
                      );
                      resolve();
                    } else {
                      // rejected / cancelled / desconhecido.
                      const detalhe =
                        (body.statusDetail as string) ??
                        c.t("Pagamento recusado.");
                      c.onErro(detalhe);
                      resolve();
                    }
                  })
                  .catch((e) => {
                    const msg =
                      (e as Error).message ??
                      c.t("Falha ao processar o pagamento.");
                    c.onErro(msg);
                    reject(e);
                  });
              });
            },
          },
        });

        // Race: desmontou durante o await do create().
        if (!ativo && controller) {
          controller.unmount();
          controller = null;
        }
      } catch (e) {
        if (!ativo) return;
        setCarregando(false);
        onIndisponivel();
        // eslint-disable-next-line no-console
        console.error("[MercadoPagoBrick] create falhou", (e as Error).message);
      }
    })();

    return () => {
      ativo = false;
      try {
        controller?.unmount();
      } catch {
        /* já desmontado — ignora */
      }
    };
  }, [sdkPronto, valor, containerId, onIndisponivel]);

  if (!PUBLIC_KEY) return null;

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
      {/* SDK v2 do Mercado Pago (liberado no CSP: sdk.mercadopago.com). */}
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onReady={() => setSdkPronto(true)}
        onLoad={() => setSdkPronto(true)}
        onError={() => {
          setCarregando(false);
          setErro(t("Não foi possível carregar o pagamento."));
          onIndisponivel();
        }}
      />
      {carregando && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" />
          {t("Carregando o pagamento seguro...")}
        </div>
      )}
      {/* O Brick injeta o formulário aqui. */}
      <div id={containerId} />
    </div>
  );
}
