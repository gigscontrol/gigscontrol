"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Loader2,
  Sparkles,
  AlertTriangle,
  CreditCard,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useT, useMoeda } from "@/lib/i18n";
import {
  getPlano,
  valorMensal,
  formatarPreco,
  type PlanoId,
} from "@/lib/planos";
import CheckoutEmbutido from "@/components/checkout/CheckoutEmbutido";

/**
 * Página /pagamento — Checkout de assinatura (Stripe).
 *
 * Aparece na primeira entrada do admin que escolheu um plano pago. Em vez
 * de coletar cartão aqui, cria a Checkout Session de assinatura na Stripe
 * e redireciona pro ambiente seguro hospedado deles. A ATIVAÇÃO da
 * assinatura acontece de forma assíncrona via webhook quando o pagamento
 * aprova — por isso o retorno cai em /pagamento/retorno, que aguarda a
 * confirmação.
 */

type OnboardingStatus = {
  onboardingCompleto: boolean;
  subscriptionStatus: string;
  plano: {
    id: string;
    nome: string;
    precoMensal: number;
    tagline?: string;
  } | null;
  ciclo?: string;
  nomeAgencia: string;
};

export default function PagamentoPage() {
  const router = useRouter();
  const t = useT();
  const moeda = useMoeda();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Quando a chave pública da Stripe não está setada, o CheckoutEmbutido
  // avisa e a gente degrada pro fluxo hospedado (botão + redirect).
  const [usarHosted, setUsarHosted] = useState(false);
  const degradarParaHosted = useCallback(() => setUsarHosted(true), []);

  // Carrega status do onboarding ao montar
  useEffect(() => {
    fetch("/api/workspace/onboarding", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as OnboardingStatus;
      })
      .then((d) => {
        setStatus(d);
        // Se já está ativo, pula direto
        if (d.subscriptionStatus === "ativa") {
          router.replace(d.onboardingCompleto ? "/app" : "/onboarding");
        }
      })
      .catch((e) => setErroCarregamento((e as Error).message))
      .finally(() => setCarregando(false));
  }, [router]);

  async function irParaCheckout() {
    if (indo || !status?.plano) return;
    setErro(null);
    setIndo(true);
    try {
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: status.plano.id, ciclo: status.ciclo ?? "mensal" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        throw new Error((body.erro as string) ?? `HTTP ${res.status}`);
      }
      // Redireciona pro checkout seguro hospedado da Stripe.
      window.location.href = body.url as string;
    } catch (e) {
      setErro((e as Error).message);
      setIndo(false);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-main flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" />
          {t("Carregando...")}
        </div>
      </div>
    );
  }

  if (erroCarregamento || !status) {
    return (
      <div className="min-h-screen bg-main flex items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <AlertTriangle size={28} className="text-danger mx-auto mb-3" />
          <h1 className="text-lg font-bold text-primary">
            {t("Erro ao carregar")}
          </h1>
          <p className="text-sm text-secondary mt-1">
            {erroCarregamento ?? t("Tente recarregar a página.")}
          </p>
        </div>
      </div>
    );
  }

  const plano = status.plano;
  // Usa o catálogo PLANOS (tem USD) em vez do precoMensal cru da API.
  const planoCompleto = plano ? getPlano(plano.id as PlanoId) : null;
  const precoFormatado = planoCompleto
    ? formatarPreco(valorMensal(planoCompleto, moeda), moeda)
    : "—";

  return (
    <div className="min-h-screen bg-main text-primary flex flex-col">
      <div
        className="fixed inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(600px circle at 50% 0%, rgba(61,123,255,0.15), transparent 60%)",
        }}
      />

      <nav className="relative border-b border-border">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2">
            <div
              className="rounded-md flex items-center justify-center font-bold text-white h-7 w-7 text-sm"
              style={{ backgroundColor: "var(--brand)" }}
            >
              G
            </div>
            <span className="font-bold tracking-tight text-base">
              GIGS<span className="text-muted"> CONTROL</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Lock size={12} />
            {t("Pagamento seguro")}
          </div>
        </div>
      </nav>

      <div className="relative flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-[920px] grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Coluna principal */}
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight">
                {t("Confirme seu plano")}
              </h1>
              <p className="mt-1 text-sm text-secondary">
                {t("Falta só um passinho.")}{" "}
                <strong className="text-primary">{status.nomeAgencia}</strong>{" "}
                {t("vai começar a usar o GIGS CONTROL.")}
              </p>
            </div>

            <div className="card">
              <div className="section-title mb-1 flex items-center gap-2">
                <ShieldCheck size={16} style={{ color: "var(--brand)" }} />
                {t("Pagamento por cartão")}
              </div>

              {plano && !usarHosted ? (
                // Checkout embutido (iframe da Stripe na nossa página).
                <>
                  <p className="text-sm text-secondary mb-4">
                    {t(
                      "Preencha os dados do cartão abaixo pra concluir a assinatura."
                    )}
                  </p>
                  <CheckoutEmbutido
                    plano={plano.id}
                    ciclo={status.ciclo ?? "mensal"}
                    onIndisponivel={degradarParaHosted}
                  />
                  <p className="text-[0.65rem] text-muted text-center mt-3 leading-relaxed">
                    {t(
                      "Você pode cancelar a qualquer momento em Configurações. Sem fidelidade."
                    )}
                  </p>
                </>
              ) : (
                // Fallback hospedado: sem chave pública ou sem plano.
                <>
                  <p className="text-sm text-secondary mb-4">
                    {t(
                      "Você vai pro ambiente seguro de pagamento pra concluir a assinatura."
                    )}
                  </p>

                  <div className="grid grid-cols-2 gap-2 mb-5">
                    <MetodoCard
                      icon={<CreditCard size={18} />}
                      label={t("Cartão")}
                      hint={t("crédito")}
                    />
                    <MetodoCard
                      icon={<RefreshCw size={18} />}
                      label={t("Renovação")}
                      hint={t("automática")}
                    />
                  </div>

                  {erro && (
                    <div
                      className="flex items-center gap-2 text-xs rounded-md px-3 py-2 mb-4"
                      style={{
                        backgroundColor: "rgba(239,68,68,0.08)",
                        color: "var(--danger)",
                        border: "1px solid rgba(239,68,68,0.3)",
                      }}
                    >
                      <AlertTriangle size={12} className="flex-shrink-0" />
                      {erro}
                    </div>
                  )}

                  <button
                    onClick={irParaCheckout}
                    disabled={indo || !plano}
                    className="btn btn-primary text-sm w-full justify-center py-2.5 disabled:opacity-60"
                    style={{ backgroundColor: "var(--brand)", color: "#fff" }}
                  >
                    {indo ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {t("Abrindo o pagamento seguro...")}
                      </>
                    ) : (
                      <>
                        <Lock size={14} />
                        {t("Assinar por {preco}", { preco: precoFormatado })}
                      </>
                    )}
                  </button>

                  <p className="text-[0.65rem] text-muted text-center mt-3 leading-relaxed">
                    {t(
                      "Você pode cancelar a qualquer momento em Configurações. Sem fidelidade."
                    )}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Coluna lateral — resumo */}
          <aside>
            <div
              className="card sticky top-4"
              style={{
                background:
                  "linear-gradient(135deg, rgba(61,123,255,0.08), rgba(61,123,255,0.02))",
                borderColor: "rgba(61,123,255,0.2)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} style={{ color: "var(--brand)" }} />
                <span className="text-xs uppercase tracking-wider text-muted font-semibold">
                  {t("Resumo do pedido")}
                </span>
              </div>
              {plano ? (
                <>
                  <div className="text-lg font-bold text-primary">
                    {t("Plano")} {plano.nome}
                  </div>
                  {plano.tagline && (
                    <div className="text-xs text-secondary mt-0.5">
                      {plano.tagline}
                    </div>
                  )}
                  <div className="border-t border-border my-3" />
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-secondary">{t("Mensalidade")}</span>
                    <span className="font-mono text-primary">{precoFormatado}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary">{t("Hoje")}</span>
                    <span className="font-mono font-bold text-primary">
                      {precoFormatado}
                    </span>
                  </div>
                  <div className="border-t border-border my-3" />
                  <div className="text-[0.7rem] text-muted leading-relaxed">
                    {t(
                      "Cobrança mensal recorrente. Pode trocar de plano em Configurações a qualquer momento."
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-danger">
                  {t("Plano não encontrado. Volte ao cadastro pra escolher um.")}
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function MetodoCard({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-border bg-elevated py-3">
      <span style={{ color: "var(--brand)" }}>{icon}</span>
      <span className="text-xs font-semibold text-primary">{label}</span>
      <span className="text-[0.6rem] text-muted">{hint}</span>
    </div>
  );
}
