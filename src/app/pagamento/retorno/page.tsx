"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  Clock,
  XCircle,
} from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Página /pagamento/retorno — success_url / cancel_url do Checkout da Stripe.
 *
 * A Stripe redireciona pra cá depois do checkout com ?status=success ou
 * ?status=cancel. A ativação real é assíncrona (webhook), então no caso
 * "success" a gente faz polling do status do onboarding até a subscription
 * virar 'ativa' e então segue pro /onboarding. "cancel" é tratado como
 * pagamento não concluído (sem cobrança).
 */

function RetornoInner() {
  const router = useRouter();
  const t = useT();
  const params = useSearchParams();
  // Checkout HOSPEDADO volta com ?status=success|cancel. Checkout EMBUTIDO
  // volta com ?session_id=... (return_url configurado no servidor, sem
  // status). Tratamos a presença de session_id como sucesso — a ativação
  // real continua sendo confirmada pelo polling do onboarding.
  const sessionId = params.get("session_id");
  const statusParam = params.get("status");
  const status = statusParam ?? (sessionId ? "success" : "pending");
  // Stripe manda "cancel"; também aceitamos "failure" por compatibilidade.
  const cancelado = status === "cancel" || status === "failure";

  const [tentativas, setTentativas] = useState(0);
  const [confirmado, setConfirmado] = useState(false);
  const [demorou, setDemorou] = useState(false);

  // Polling do status quando o retorno é de sucesso. Modelo pré-pago: o
  // critério é `acessoAte` no futuro (não mais subscriptionStatus==='ativa',
  // que não cobre o crédito de dias do Mercado Pago). Janela mais longa
  // (~2min, 4s de intervalo) pra cobrir o PIX — que só confirma quando o
  // pagador escaneia o QR Code, mais lento que o retorno síncrono do cartão.
  useEffect(() => {
    if (status !== "success") return;
    let ativo = true;
    let n = 0;
    const MAX_TENTATIVAS = 30; // 30 × 4s ≈ 2min

    const checar = async () => {
      try {
        const r = await fetch("/api/workspace/onboarding", {
          credentials: "include",
        });
        if (r.ok) {
          const d = (await r.json()) as {
            subscriptionStatus: string;
            acessoAte: string | null;
          };
          const acessoOk = d.acessoAte
            ? new Date(d.acessoAte).getTime() > Date.now()
            : d.subscriptionStatus === "ativa";
          if (acessoOk) {
            if (ativo) {
              setConfirmado(true);
              setTimeout(() => router.replace("/onboarding"), 1000);
            }
            return true;
          }
        }
      } catch {
        // ignora; tenta de novo
      }
      return false;
    };

    const loop = setInterval(async () => {
      n += 1;
      if (ativo) setTentativas(n);
      const ok = await checar();
      if (ok || n >= MAX_TENTATIVAS) {
        clearInterval(loop);
        if (!ok && ativo) setDemorou(true);
      }
    }, 4000);

    // primeira checagem imediata
    void checar();

    return () => {
      ativo = false;
      clearInterval(loop);
    };
  }, [status, router]);

  return (
    <div className="min-h-screen bg-main text-primary flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center py-10">
        {status === "success" && !confirmado && !demorou && (
          <>
            <Loader2
              size={40}
              className="animate-spin mx-auto mb-4"
              style={{ color: "var(--brand)" }}
            />
            <h1 className="text-lg font-bold text-primary">
              {t("Confirmando seu pagamento...")}
            </h1>
            <p className="text-sm text-secondary mt-1">
              {t("Só um instante — estamos validando sua assinatura.")}
            </p>
            {tentativas > 3 && (
              <p className="text-xs text-muted mt-3">
                {t("Tá levando um pouquinho mais que o normal...")}
              </p>
            )}
          </>
        )}

        {status === "success" && confirmado && (
          <>
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{
                background:
                  "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))",
                color: "var(--success)",
              }}
            >
              <CheckCircle2 size={28} />
            </div>
            <h1 className="text-lg font-bold text-primary">
              {t("Pagamento confirmado!")}
            </h1>
            <p className="text-sm text-secondary mt-1">
              {t("Redirecionando pra configuração inicial...")}
            </p>
          </>
        )}

        {status === "success" && demorou && (
          <>
            <Clock
              size={40}
              className="mx-auto mb-4"
              style={{ color: "var(--warning)" }}
            />
            <h1 className="text-lg font-bold text-primary">{t("Quase lá")}</h1>
            <p className="text-sm text-secondary mt-1">
              {t(
                "O pagamento foi feito, mas a confirmação está demorando. Pode seguir — assim que confirmar, sua conta é ativada automaticamente."
              )}
            </p>
            <button
              onClick={() => router.replace("/onboarding")}
              className="btn btn-primary text-sm mt-5"
              style={{ backgroundColor: "var(--brand)", color: "#fff" }}
            >
              {t("Continuar")}
            </button>
          </>
        )}

        {status === "pending" && (
          <>
            <Clock
              size={40}
              className="mx-auto mb-4"
              style={{ color: "var(--warning)" }}
            />
            <h1 className="text-lg font-bold text-primary">
              {t("Pagamento pendente")}
            </h1>
            <p className="text-sm text-secondary mt-1">
              {t(
                "A confirmação pode levar um tempinho. Assim que cair, sua conta é ativada automaticamente e a gente te avisa."
              )}
            </p>
            <button
              onClick={() => router.replace("/onboarding")}
              className="btn btn-secondary text-sm mt-5"
            >
              {t("Continuar mesmo assim")}
            </button>
          </>
        )}

        {cancelado && (
          <>
            <XCircle size={40} className="text-danger mx-auto mb-4" />
            <h1 className="text-lg font-bold text-primary">
              {t("Pagamento não concluído")}
            </h1>
            <p className="text-sm text-secondary mt-1">
              {t(
                "Algo deu errado ou o pagamento foi cancelado. Pode tentar de novo — nenhuma cobrança foi feita."
              )}
            </p>
            <button
              onClick={() => router.replace("/pagamento")}
              className="btn btn-primary text-sm mt-5"
              style={{ backgroundColor: "var(--brand)", color: "#fff" }}
            >
              {t("Tentar de novo")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function RetornoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-main flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-muted" />
        </div>
      }
    >
      <RetornoInner />
    </Suspense>
  );
}
