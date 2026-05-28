"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Lock,
  CheckCircle2,
  Loader2,
  Sparkles,
  Calendar,
  User,
  AlertTriangle,
} from "lucide-react";

/**
 * Página /pagamento — mock de checkout.
 *
 * Aparece UMA vez na primeira entrada do admin, logo após confirmar
 * o email. Visualmente parece um checkout real (campo de cartão,
 * CVV, etc) mas NÃO valida nem cobra nada — só simula um loading e
 * marca a subscription como 'ativa' no banco.
 *
 * Quando o Stripe entrar, essa página vira o componente de checkout
 * real e dispara o webhook.
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

  // Campos do cartão (visuais; sem validação real)
  const [numero, setNumero] = useState("");
  const [titular, setTitular] = useState("");
  const [validade, setValidade] = useState("");
  const [cvv, setCvv] = useState("");

  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  // Carrega status do onboarding ao montar
  useEffect(() => {
    fetch("/api/workspace/onboarding", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as OnboardingStatus;
      })
      .then((d) => {
        setStatus(d);
        // Se já está ativo, pula direto pro onboarding
        if (d.subscriptionStatus === "ativa") {
          router.replace(d.onboardingCompleto ? "/app" : "/onboarding");
        }
      })
      .catch((e) => setErroCarregamento((e as Error).message))
      .finally(() => setCarregando(false));
  }, [router]);

  async function pagar() {
    if (processando) return;
    setErro(null);

    // Validações cosméticas
    const numeroLimpo = numero.replace(/\s/g, "");
    if (numeroLimpo.length < 13) {
      setErro("Número de cartão incompleto.");
      return;
    }
    if (!titular.trim()) {
      setErro("Informe o nome do titular do cartão.");
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(validade)) {
      setErro("Validade no formato MM/AA.");
      return;
    }
    if (cvv.length < 3) {
      setErro("CVV incompleto.");
      return;
    }

    setProcessando(true);
    try {
      // Simula latência de processamento de pagamento
      await new Promise((res) => setTimeout(res, 1800));
      const res = await fetch("/api/workspace/ativar-plano", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b.erro as string) ?? `HTTP ${res.status}`);
      }
      setSucesso(true);
      // Aguarda 1s pra mostrar o sucesso e segue
      setTimeout(() => router.replace("/onboarding"), 1000);
    } catch (e) {
      setErro((e as Error).message);
      setProcessando(false);
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
      {/* Glow de fundo */}
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
            Pagamento seguro
          </div>
        </div>
      </nav>

      <div className="relative flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-[920px] grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Coluna principal — form */}
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

            {sucesso ? (
              <div className="card text-center py-10">
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
                <h2 className="text-lg font-bold text-primary">
                  Pagamento confirmado!
                </h2>
                <p className="text-sm text-secondary mt-1">
                  Redirecionando pra configuração inicial...
                </p>
              </div>
            ) : (
              <div className="card">
                <div className="section-title mb-4 flex items-center gap-2">
                  <CreditCard size={16} style={{ color: "var(--module-vendas)" }} />
                  Dados do cartão
                </div>

                <div className="flex flex-col gap-4">
                  {/* Número do cartão */}
                  <Campo label="Número do cartão" icon={<CreditCard size={14} />}>
                    <input
                      value={numero}
                      onChange={(e) =>
                        setNumero(
                          e.target.value
                            .replace(/\D/g, "")
                            .replace(/(.{4})/g, "$1 ")
                            .trim()
                            .slice(0, 19)
                        )
                      }
                      placeholder="1234 5678 9012 3456"
                      className="bg-transparent outline-none text-sm text-primary placeholder:text-muted flex-1 font-mono"
                      inputMode="numeric"
                      maxLength={19}
                    />
                  </Campo>

                  <Campo label="Nome do titular" icon={<User size={14} />}>
                    <input
                      value={titular}
                      onChange={(e) =>
                        setTitular(e.target.value.toUpperCase())
                      }
                      placeholder="COMO ESTÁ NO CARTÃO"
                      className="bg-transparent outline-none text-sm text-primary placeholder:text-muted flex-1 uppercase"
                    />
                  </Campo>

                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Validade" icon={<Calendar size={14} />}>
                      <input
                        value={validade}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                          setValidade(
                            v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v
                          );
                        }}
                        placeholder="MM/AA"
                        className="bg-transparent outline-none text-sm text-primary placeholder:text-muted flex-1 font-mono"
                        maxLength={5}
                      />
                    </Campo>
                    <Campo label="CVV" icon={<Lock size={14} />}>
                      <input
                        value={cvv}
                        onChange={(e) =>
                          setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))
                        }
                        placeholder="123"
                        className="bg-transparent outline-none text-sm text-primary placeholder:text-muted flex-1 font-mono"
                        inputMode="numeric"
                        maxLength={4}
                      />
                    </Campo>
                  </div>
                </div>

                {erro && (
                  <div
                    className="flex items-center gap-2 text-xs rounded-md px-3 py-2 mt-4"
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
                  onClick={pagar}
                  disabled={processando}
                  className="btn btn-primary text-sm w-full justify-center py-2.5 mt-5 disabled:opacity-60"
                  style={{
                    backgroundColor: "var(--module-vendas)",
                    color: "#fff",
                  }}
                >
                  {processando ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Processando pagamento...
                    </>
                  ) : (
                    <>
                      <Lock size={14} />
                      Confirmar pagamento de {precoFormatado}
                    </>
                  )}
                </button>

                <p className="text-[0.65rem] text-muted text-center mt-3 leading-relaxed">
                  Você pode cancelar a qualquer momento em Configurações.
                  Sem fidelidade.
                </p>

                {/* Banner de aviso — esse é mock */}
                <div
                  className="text-[0.7rem] rounded-md px-3 py-2 mt-3 leading-relaxed"
                  style={{
                    backgroundColor: "rgba(245,158,11,0.08)",
                    color: "var(--warning)",
                    border: "1px solid rgba(245,158,11,0.2)",
                  }}
                >
                  <strong>Modo demonstração:</strong> esse checkout é
                  visual — não cobra do cartão. Pode digitar qualquer
                  número (com 13+ dígitos) e validade futura. Em breve
                  vai integrar com Stripe.
                </div>
              </div>
            )}
          </div>

          {/* Coluna lateral — resumo do plano */}
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
                    <span className="font-mono text-primary">
                      {precoFormatado}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary">Hoje</span>
                    <span className="font-mono font-bold text-primary">
                      {precoFormatado}
                    </span>
                  </div>
                  <div className="border-t border-border my-3" />
                  <div className="text-[0.7rem] text-muted leading-relaxed">
                    Cobrança mensal recorrente.
                    <br />
                    Pode trocar de plano em Configurações a qualquer momento.
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

// ============================================================
// Helper de campo (label + ícone + input filho)
// ============================================================

function Campo({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-secondary">{label}</span>
      <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong transition-colors">
        <span className="text-muted flex-shrink-0">{icon}</span>
        {children}
      </div>
    </label>
  );
}
