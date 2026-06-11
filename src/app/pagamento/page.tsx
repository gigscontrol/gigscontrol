"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Loader2,
  Sparkles,
  AlertTriangle,
  QrCode,
  CreditCard,
  Barcode,
  ShieldCheck,
} from "lucide-react";

/**
 * Página /pagamento — Checkout Pro do Mercado Pago.
 *
 * Aparece na primeira entrada do admin que escolheu um plano pago. Em
 * vez de coletar cartão aqui, cria a "preference" no Mercado Pago e
 * redireciona pro ambiente hospedado deles (PIX, boleto ou cartão). A
 * ATIVAÇÃO da assinatura acontece de forma assíncrona via webhook
 * quando o pagamento aprova — por isso o retorno cai em /pagamento/retorno,
 * que aguarda a confirmação.
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
  nomeAgencia: string;
};

export default function PagamentoPage() {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
      const res = await fetch("/api/checkout/mercadopago", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: status.plano.id, ciclo: "mensal" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.initPoint) {
        throw new Error((body.erro as string) ?? `HTTP ${res.status}`);
      }
      // Redireciona pro checkout hospedado do Mercado Pago.
      window.location.href = body.initPoint as string;
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
          Carregando...
        </div>
      </div>
    );
  }

  if (erroCarregamento || !status) {
    return (
      <div className="min-h-screen bg-main flex items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <AlertTriangle size={28} className="text-danger mx-auto mb-3" />
          <h1 className="text-lg font-bold text-primary">Erro ao carregar</h1>
          <p className="text-sm text-secondary mt-1">
            {erroCarregamento ?? "Tente recarregar a página."}
          </p>
        </div>
      </div>
    );
  }

  const plano = status.plano;
  const precoFormatado = plano
    ? new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(plano.precoMensal)
    : "—";

  return (
    <div className="min-h-screen bg-main text-primary flex flex-col">
      <div
        className="fixed inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(600px circle at 50% 0%, rgba(168,85,247,0.15), transparent 60%)",
        }}
      />

      <nav className="relative border-b border-border">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2">
            <div
              className="rounded-md flex items-center justify-center font-bold text-white h-7 w-7 text-sm"
              style={{ backgroundColor: "var(--module-vendas)" }}
            >
              G
            </div>
            <span className="font-bold tracking-tight text-base">
              GIGS<span className="text-muted"> CONTROL</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Lock size={12} />
            Pagamento seguro via Mercado Pago
          </div>
        </div>
      </nav>

      <div className="relative flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-[920px] grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Coluna principal */}
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight">
                Confirme seu plano
              </h1>
              <p className="mt-1 text-sm text-secondary">
                Falta só um passinho.{" "}
                <strong className="text-primary">{status.nomeAgencia}</strong>{" "}
                vai começar a usar o GIGS CONTROL.
              </p>
            </div>

            <div className="card">
              <div className="section-title mb-1 flex items-center gap-2">
                <ShieldCheck size={16} style={{ color: "var(--module-vendas)" }} />
                Pagamento pelo Mercado Pago
              </div>
              <p className="text-sm text-secondary mb-4">
                Você vai pro ambiente seguro do Mercado Pago pra concluir.
                Escolha como pagar:
              </p>

              <div className="grid grid-cols-3 gap-2 mb-5">
                <MetodoCard icon={<QrCode size={18} />} label="PIX" hint="na hora" />
                <MetodoCard icon={<CreditCard size={18} />} label="Cartão" hint="crédito" />
                <MetodoCard icon={<Barcode size={18} />} label="Boleto" hint="1-2 dias" />
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
                style={{ backgroundColor: "var(--module-vendas)", color: "#fff" }}
              >
                {indo ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Abrindo o Mercado Pago...
                  </>
                ) : (
                  <>
                    <Lock size={14} />
                    Pagar {precoFormatado} com Mercado Pago
                  </>
                )}
              </button>

              <p className="text-[0.65rem] text-muted text-center mt-3 leading-relaxed">
                Você pode cancelar a qualquer momento em Configurações.
                Sem fidelidade.
              </p>
            </div>
          </div>

          {/* Coluna lateral — resumo */}
          <aside>
            <div
              className="card sticky top-4"
              style={{
                background:
                  "linear-gradient(135deg, rgba(168,85,247,0.08), rgba(168,85,247,0.02))",
                borderColor: "rgba(168,85,247,0.2)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} style={{ color: "var(--module-vendas)" }} />
                <span className="text-xs uppercase tracking-wider text-muted font-semibold">
                  Resumo do pedido
                </span>
              </div>
              {plano ? (
                <>
                  <div className="text-lg font-bold text-primary">
                    Plano {plano.nome}
                  </div>
                  {plano.tagline && (
                    <div className="text-xs text-secondary mt-0.5">
                      {plano.tagline}
                    </div>
                  )}
                  <div className="border-t border-border my-3" />
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-secondary">Mensalidade</span>
                    <span className="font-mono text-primary">{precoFormatado}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary">Hoje</span>
                    <span className="font-mono font-bold text-primary">
                      {precoFormatado}
                    </span>
                  </div>
                  <div className="border-t border-border my-3" />
                  <div className="text-[0.7rem] text-muted leading-relaxed">
                    Cobrança mensal. Pode trocar de plano em Configurações a
                    qualquer momento.
                  </div>
                </>
              ) : (
                <p className="text-sm text-danger">
                  Plano não encontrado. Volte ao cadastro pra escolher um.
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
      <span style={{ color: "var(--module-vendas)" }}>{icon}</span>
      <span className="text-xs font-semibold text-primary">{label}</span>
      <span className="text-[0.6rem] text-muted">{hint}</span>
    </div>
  );
}
