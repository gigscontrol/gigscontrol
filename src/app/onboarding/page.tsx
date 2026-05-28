"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Music,
  Users,
  Image as ImageIcon,
  Contact2,
  Loader2,
  Sparkles,
  ArrowRight,
  PartyPopper,
} from "lucide-react";

/**
 * Página /onboarding — checklist "Comece por aqui".
 *
 * Aparece pra novos admins entre /pagamento e /app. Mostra 5 tarefas:
 *   1. ✓ Conta criada (sempre check — gatilho de chegar aqui)
 *   2. Adicionar 1º artista
 *   3. Cadastrar 1º contratante ou casa
 *   4. Subir logo da agência
 *   5. Convidar membro da equipe
 *
 * Cada item linka pra Configurações na aba certa. O status do
 * checklist é calculado em tempo real pelo endpoint (count de cada
 * entidade no workspace). Admin pode "Pular por agora" se quiser
 * ir pra dashboard sem completar — marcar como completo manualmente.
 *
 * Quando completa todos os passos OU clica "Pular", marca
 * onboarding_completo = true e vai pro /app.
 */

type Status = {
  onboardingCompleto: boolean;
  subscriptionStatus: string;
  checklist: {
    contaCriada: boolean;
    temArtista: boolean;
    temContato: boolean;
    logoSubida: boolean;
    temEquipe: boolean;
  };
  nomeAgencia: string;
};

type ItemChecklist = {
  id: keyof Status["checklist"];
  titulo: string;
  descricao: string;
  icone: typeof Music;
  href: string;
  obrigatorio: boolean;
};

const ITENS: ItemChecklist[] = [
  {
    id: "contaCriada",
    titulo: "Conta criada",
    descricao: "Seu workspace tá no ar e configurado.",
    icone: Sparkles,
    href: "#",
    obrigatorio: true,
  },
  {
    id: "temArtista",
    titulo: "Adicionar primeiro artista",
    descricao: "Cadastre um DJ pra começar a montar a agenda dele.",
    icone: Music,
    href: "/app?aba=configuracoes&config=artistas",
    obrigatorio: true,
  },
  {
    id: "temContato",
    titulo: "Cadastrar primeiro contratante ou casa",
    descricao: "Pra emitir orçamentos você precisa de pelo menos um cliente.",
    icone: Contact2,
    href: "/app?aba=contatos",
    obrigatorio: true,
  },
  {
    id: "logoSubida",
    titulo: "Subir logo da agência",
    descricao: "Aparece no topo da dashboard e nos orçamentos enviados.",
    icone: ImageIcon,
    href: "/app?aba=configuracoes&config=geral",
    obrigatorio: false,
  },
  {
    id: "temEquipe",
    titulo: "Convidar membro da equipe",
    descricao: "Compartilhe acesso com vendedor, produtor ou financeiro.",
    icone: Users,
    href: "/app?aba=configuracoes&config=equipe",
    obrigatorio: false,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [finalizando, setFinalizando] = useState(false);

  async function recarregar() {
    setCarregando(true);
    try {
      const r = await fetch("/api/workspace/onboarding", {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as Status;
      // Se a subscription tá em trial (não passou pelo /pagamento), volta lá
      if (d.subscriptionStatus !== "ativa") {
        router.replace("/pagamento");
        return;
      }
      // Já tinha completado? vai pro app
      if (d.onboardingCompleto) {
        router.replace("/app");
        return;
      }
      setStatus(d);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function concluir() {
    if (finalizando) return;
    setFinalizando(true);
    try {
      await fetch("/api/workspace/onboarding", {
        method: "POST",
        credentials: "include",
      });
      router.replace("/app");
    } catch {
      setFinalizando(false);
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

  if (!status) return null;

  const completos = ITENS.filter((it) => status.checklist[it.id]).length;
  const totalObrigatorios = ITENS.filter((it) => it.obrigatorio).length;
  const obrigatoriosFeitos = ITENS.filter(
    (it) => it.obrigatorio && status.checklist[it.id]
  ).length;
  const tudoFeito = completos === ITENS.length;
  const obrigatoriosOk = obrigatoriosFeitos === totalObrigatorios;
  const progresso = (completos / ITENS.length) * 100;

  return (
    <div className="min-h-screen bg-main text-primary flex flex-col">
      <div
        className="fixed inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(700px circle at 50% 0%, rgba(168,85,247,0.15), transparent 60%)",
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
          <button
            onClick={concluir}
            disabled={finalizando}
            className="text-xs text-muted hover:text-secondary transition-colors disabled:opacity-50"
          >
            Pular por agora
          </button>
        </div>
      </nav>

      <div className="relative flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-[680px]">
          <div className="text-center mb-8">
            <div
              className="h-14 w-14 mx-auto rounded-full flex items-center justify-center mb-4"
              style={{
                background:
                  "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(168,85,247,0.05))",
                color: "var(--module-vendas)",
              }}
            >
              <PartyPopper size={26} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Bem-vindo ao GIGS CONTROL!
            </h1>
            <p className="mt-2 text-sm text-secondary">
              <strong className="text-primary">{status.nomeAgencia}</strong> tá
              quase pronta. Configure 4 coisas e comece a usar.
            </p>
          </div>

          {/* Barra de progresso */}
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-primary">
                Progresso da configuração
              </span>
              <span className="text-sm font-mono text-muted tabular-nums">
                {completos} de {ITENS.length}
              </span>
            </div>
            <div className="h-2 rounded-full bg-elevated overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progresso}%`,
                  backgroundColor: tudoFeito
                    ? "var(--success)"
                    : "var(--module-vendas)",
                }}
              />
            </div>
          </div>

          {/* Lista de itens */}
          <div className="flex flex-col gap-2">
            {ITENS.map((it) => {
              const Icon = it.icone;
              const feito = status.checklist[it.id];
              return (
                <Link
                  key={it.id}
                  href={feito ? "#" : it.href}
                  onClick={(e) => {
                    if (feito) e.preventDefault();
                  }}
                  className="card flex items-center gap-4 transition-all hover:border-border-strong"
                  style={{
                    opacity: feito ? 0.7 : 1,
                    cursor: feito ? "default" : "pointer",
                    backgroundColor: feito
                      ? "rgba(34,197,94,0.04)"
                      : undefined,
                    borderColor: feito
                      ? "rgba(34,197,94,0.2)"
                      : undefined,
                  }}
                >
                  <div className="flex-shrink-0">
                    {feito ? (
                      <CheckCircle2
                        size={22}
                        style={{ color: "var(--success)" }}
                      />
                    ) : (
                      <Circle size={22} className="text-muted" />
                    )}
                  </div>
                  <div
                    className="h-10 w-10 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: feito
                        ? "rgba(34,197,94,0.1)"
                        : "var(--bg-elevated)",
                      color: feito
                        ? "var(--success)"
                        : "var(--module-vendas)",
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-medium"
                      style={{
                        color: feito ? "var(--text-muted)" : "var(--text-primary)",
                        textDecoration: feito ? "line-through" : "none",
                      }}
                    >
                      {it.titulo}
                      {!it.obrigatorio && (
                        <span className="text-[0.65rem] font-normal text-muted ml-2 uppercase tracking-wider">
                          opcional
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-secondary mt-0.5">
                      {it.descricao}
                    </div>
                  </div>
                  {!feito && (
                    <ArrowRight
                      size={14}
                      className="text-muted flex-shrink-0"
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* CTA: ir pra dashboard */}
          <div className="mt-6 flex flex-col gap-3 items-center">
            <button
              onClick={concluir}
              disabled={finalizando}
              className="btn btn-primary text-sm py-2.5 px-6 disabled:opacity-60"
              style={{
                backgroundColor: obrigatoriosOk
                  ? "var(--module-vendas)"
                  : undefined,
                color: obrigatoriosOk ? "#fff" : undefined,
                opacity: obrigatoriosOk ? 1 : 0.6,
              }}
            >
              {finalizando
                ? "Indo..."
                : obrigatoriosOk
                ? tudoFeito
                  ? "Tudo pronto! Ir para a dashboard"
                  : "Ir para a dashboard"
                : "Conclua os passos obrigatórios"}
              {!finalizando && <ArrowRight size={14} />}
            </button>
            {!obrigatoriosOk && (
              <span className="text-[0.65rem] text-muted">
                Faltam {totalObrigatorios - obrigatoriosFeitos} passo(s)
                obrigatório(s) — ou{" "}
                <button
                  type="button"
                  onClick={concluir}
                  className="underline hover:text-secondary"
                >
                  pular tudo
                </button>
              </span>
            )}
            <button
              onClick={() => void recarregar()}
              className="text-[0.65rem] text-muted hover:text-secondary"
            >
              Já fiz na outra aba — atualizar status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
