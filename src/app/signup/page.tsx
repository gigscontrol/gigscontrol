"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Mail,
  User,
  Building2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { criarClienteBrowser } from "@/lib/db/supabase-browser";
import {
  PLANOS,
  formatarPreco,
  type PlanoId,
} from "@/lib/planos";
import BotoesOAuth from "@/components/BotoesOAuth";
import CampoSenha from "@/components/CampoSenha";
import { avaliarSenha } from "@/lib/senha-forca";

/**
 * Tela de cadastro (signup) em 2 etapas:
 *   1) Escolha do plano
 *   2) Form: nome, e-mail, senha, nome da agência, termos
 *
 * Cliente chama supabase.auth.signUp() com user_metadata. O Supabase
 * envia o email de confirmação. Quando o usuário clicar no link, cai
 * em /auth/callback — que cria workspace + profile.
 */
export default function SignupPage() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [planoEscolhido, setPlanoEscolhido] = useState<PlanoId | null>(null);

  // Form
  const [nome, setNome] = useState("");
  const [nomeAgencia, setNomeAgencia] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Status do email — validação em tempo real (debounce 500ms)
  type EmailStatus = "idle" | "invalido" | "checando" | "em-uso" | "ok";
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");

  // Debounce do email: roda checagem 500ms após parar de digitar
  useEffect(() => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailStatus("idle");
      return;
    }
    // Validação simples de formato
    const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!valido) {
      setEmailStatus("invalido");
      return;
    }
    setEmailStatus("checando");
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/email-existe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed.toLowerCase() }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          // Falha técnica: deixa idle pra não bloquear UX por bug nosso
          setEmailStatus("idle");
          return;
        }
        const body = (await res.json()) as { existe?: boolean };
        setEmailStatus(body.existe ? "em-uso" : "ok");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setEmailStatus("idle");
      }
    }, 500);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [email]);

  function escolherPlano(id: PlanoId) {
    setPlanoEscolhido(id);
    setEtapa(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) return setErro("Informe seu nome.");
    if (!nomeAgencia.trim()) return setErro("Informe o nome da agência.");
    if (!email.trim() || !email.includes("@")) return setErro("Email inválido.");
    const avalSenha = avaliarSenha(senha);
    if (!avalSenha.podeUsar) {
      return setErro(avalSenha.motivos[0] ?? "Escolha uma senha mais segura.");
    }
    if (!aceitouTermos) return setErro("Você precisa aceitar os Termos de Uso.");
    if (!planoEscolhido) return setErro("Volte e escolha um plano.");

    setEnviando(true);
    try {
      // Pre-check: o Supabase devolve sucesso silencioso pra email já
      // cadastrado (por segurança). Checamos antes pra dar feedback claro.
      const checkRes = await fetch("/api/auth/email-existe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (checkRes.ok) {
        const body = await checkRes.json();
        if (body.existe) {
          throw new Error(
            "Esse e-mail já tem uma conta no GIGS CONTROL. Faça login ou recupere sua senha."
          );
        }
      }

      const supabase = criarClienteBrowser();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/app`,
          data: {
            nome: nome.trim(),
            nome_agencia: nomeAgencia.trim(),
            plano_escolhido: planoEscolhido,
          },
        },
      });
      if (error) {
        if (error.message.toLowerCase().includes("already registered")) {
          throw new Error("Esse e-mail já tem uma conta. Faça login.");
        }
        throw error;
      }
      router.replace(`/signup/verifique-email?email=${encodeURIComponent(email.trim())}`);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-main text-primary flex flex-col">
      <div
        className="fixed inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(500px circle at 50% 0%, rgba(168,85,247,0.15), transparent 60%)",
        }}
      />

      <nav className="relative border-b border-border">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-6 h-16">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="rounded-md flex items-center justify-center font-bold text-white h-7 w-7 text-sm"
              style={{ backgroundColor: "var(--module-vendas)" }}
            >
              G
            </div>
            <span className="font-bold tracking-tight text-base">
              GIGS<span className="text-muted"> CONTROL</span>
            </span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors"
          >
            Já tenho conta
            <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      <div className="relative flex-1 flex items-start justify-center px-6 py-10">
        {etapa === 1 ? (
          <Etapa1
            planoSelecionado={planoEscolhido}
            onEscolher={escolherPlano}
          />
        ) : (
          <Etapa2
            plano={planoEscolhido!}
            nome={nome}
            setNome={setNome}
            nomeAgencia={nomeAgencia}
            setNomeAgencia={setNomeAgencia}
            email={email}
            setEmail={setEmail}
            emailStatus={emailStatus}
            senha={senha}
            setSenha={setSenha}
            aceitouTermos={aceitouTermos}
            setAceitouTermos={setAceitouTermos}
            erro={erro}
            enviando={enviando}
            onVoltar={() => setEtapa(1)}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Etapa 1 — Escolha do plano
// ============================================================
function Etapa1({
  planoSelecionado,
  onEscolher,
}: {
  planoSelecionado: PlanoId | null;
  onEscolher: (id: PlanoId) => void;
}) {
  return (
    <div className="w-full max-w-[1000px]">
      <div className="text-center mb-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
          Passo 1 de 2
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Escolha o plano da sua agência
        </h1>
        <p className="mt-2 text-sm text-secondary max-w-md mx-auto">
          Você pode mudar de plano quando quiser. Sem fidelidade.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {PLANOS.map((p) => {
          const sel = planoSelecionado === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onEscolher(p.id)}
              className="card text-left transition-all hover:border-border-strong relative"
              style={{
                borderColor: sel ? "var(--module-vendas)" : undefined,
                boxShadow: sel ? "0 0 0 1px var(--module-vendas)" : undefined,
              }}
            >
              {p.destaque && (
                <span
                  className="absolute -top-2 left-4 text-[0.6rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white"
                  style={{ backgroundColor: "var(--module-vendas)" }}
                >
                  Mais popular
                </span>
              )}
              <div className="text-base font-bold text-primary">{p.nome}</div>
              <div className="text-xs text-muted mb-3">{p.tagline}</div>
              <div className="mb-3">
                <span className="text-2xl font-bold text-primary">
                  {formatarPreco(p.precoMensal)}
                </span>
                <span className="text-xs text-muted">/mês</span>
              </div>
              <ul className="flex flex-col gap-1.5 text-xs text-secondary">
                {p.recursos.slice(0, 4).map((r) => (
                  <li key={r} className="flex items-start gap-1.5">
                    <Check size={11} className="mt-0.5 flex-shrink-0" style={{ color: "var(--success)" }} />
                    {r}
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-3 border-t border-border">
                <span
                  className="text-xs font-semibold inline-flex items-center gap-1"
                  style={{ color: sel ? "var(--module-vendas)" : "var(--text-muted)" }}
                >
                  {sel ? <Check size={12} /> : <ArrowRight size={12} />}
                  {sel ? "Selecionado" : "Escolher"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Etapa 2 — Form de cadastro
// ============================================================
function Etapa2({
  plano,
  nome,
  setNome,
  nomeAgencia,
  setNomeAgencia,
  email,
  setEmail,
  emailStatus,
  senha,
  setSenha,
  aceitouTermos,
  setAceitouTermos,
  erro,
  enviando,
  onVoltar,
  onSubmit,
}: {
  plano: PlanoId;
  nome: string;
  setNome: (v: string) => void;
  nomeAgencia: string;
  setNomeAgencia: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  emailStatus: "idle" | "invalido" | "checando" | "em-uso" | "ok";
  senha: string;
  setSenha: (v: string) => void;
  aceitouTermos: boolean;
  setAceitouTermos: (v: boolean) => void;
  erro: string | null;
  enviando: boolean;
  onVoltar: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const planoInfo = PLANOS.find((p) => p.id === plano)!;
  // Habilita o botão só quando o email é válido E livre, senha passa
  // na política (NIST + bloqueio de senhas comuns) e termos aceitos.
  // Outros campos validamos no submit.
  const podeEnviar =
    emailStatus === "ok" &&
    avaliarSenha(senha).podeUsar &&
    aceitouTermos &&
    nome.trim().length > 0 &&
    nomeAgencia.trim().length > 0 &&
    !enviando;
  return (
    <div className="w-full max-w-[440px]">
      <button
        onClick={onVoltar}
        type="button"
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors mb-4"
      >
        <ArrowLeft size={13} />
        Trocar plano
      </button>

      <div className="text-center mb-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">
          Passo 2 de 2
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Criar conta</h1>
        <p className="mt-1 text-sm text-secondary">
          Plano <strong className="text-primary">{planoInfo.nome}</strong> ·{" "}
          {formatarPreco(planoInfo.precoMensal)}/mês
        </p>
      </div>

      {/* OAuth — atalho rápido */}
      <div className="card mb-3">
        <BotoesOAuth prefixo="Cadastrar com" />
      </div>

      {/* Divisor */}
      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-main px-3 text-[0.65rem] uppercase tracking-wider text-muted">
            ou com email
          </span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="card flex flex-col gap-4">
        <Campo
          icon={<User size={14} />}
          label="Seu nome"
          value={nome}
          onChange={setNome}
          placeholder="João da Silva"
          autoComplete="name"
        />
        <Campo
          icon={<Building2 size={14} />}
          label="Nome da agência"
          value={nomeAgencia}
          onChange={setNomeAgencia}
          placeholder="Agência Estrela"
          autoComplete="organization"
        />
        <CampoEmail
          email={email}
          setEmail={setEmail}
          status={emailStatus}
        />
        <CampoSenha
          label="Senha"
          value={senha}
          onChange={setSenha}
          autoComplete="new-password"
        />

        <label className="flex items-start gap-2 text-xs text-secondary cursor-pointer mt-1">
          <input
            type="checkbox"
            checked={aceitouTermos}
            onChange={(e) => setAceitouTermos(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Li e aceito os{" "}
            <Link href="/termos" target="_blank" className="text-primary underline">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" target="_blank" className="text-primary underline">
              Política de Privacidade
            </Link>
            .
          </span>
        </label>

        {erro && (
          <div className="flex items-center gap-2 text-xs text-danger bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.3)] rounded-md px-3 py-2">
            <AlertCircle size={13} className="flex-shrink-0" />
            {erro}
          </div>
        )}

        <button
          type="submit"
          disabled={!podeEnviar}
          className="btn btn-primary text-sm w-full justify-center py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: "var(--module-vendas)", color: "#fff" }}
        >
          {enviando ? "Criando conta…" : "Criar conta e enviar verificação"}
          {!enviando && <ArrowRight size={14} />}
        </button>

        <div className="text-center">
          <Link
            href="/login"
            className="text-xs text-muted hover:text-secondary transition-colors"
          >
            Já tem conta? Entre aqui
          </Link>
        </div>
      </form>
    </div>
  );
}

function Campo({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-secondary">{label}</span>
      <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong transition-colors">
        <span className="text-muted flex-shrink-0">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted"
        />
      </div>
    </label>
  );
}

/**
 * Campo de email com validação em tempo real (debounce 500ms).
 * Mostra ícone à direita (spinner/check/x) + mensagem inline abaixo.
 */
function CampoEmail({
  email,
  setEmail,
  status,
}: {
  email: string;
  setEmail: (v: string) => void;
  status: "idle" | "invalido" | "checando" | "em-uso" | "ok";
}) {
  // Cor de borda + mensagem conforme status
  const borda =
    status === "em-uso" || status === "invalido"
      ? "var(--danger)"
      : status === "ok"
      ? "var(--success)"
      : undefined;

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-secondary">E-mail</span>
      <div
        className="flex items-center gap-2 bg-elevated border rounded-md px-3 py-2 focus-within:border-border-strong transition-colors"
        style={{ borderColor: borda ?? "var(--border-color)" }}
      >
        <Mail size={14} className="text-muted flex-shrink-0" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          autoComplete="email"
          className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted"
        />
        {status === "checando" && (
          <Loader2 size={14} className="animate-spin text-muted flex-shrink-0" />
        )}
        {status === "ok" && (
          <Check size={14} style={{ color: "var(--success)" }} className="flex-shrink-0" />
        )}
        {(status === "em-uso" || status === "invalido") && (
          <AlertCircle size={14} style={{ color: "var(--danger)" }} className="flex-shrink-0" />
        )}
      </div>

      {/* Mensagem inline abaixo do campo */}
      {status === "invalido" && (
        <span className="text-[0.7rem]" style={{ color: "var(--danger)" }}>
          Formato de e-mail inválido.
        </span>
      )}
      {status === "em-uso" && (
        <span className="text-[0.7rem]" style={{ color: "var(--danger)" }}>
          Esse e-mail já tem uma conta.{" "}
          <Link href="/login" className="underline">
            Entrar
          </Link>{" "}
          ou{" "}
          <Link href="/forgot-password" className="underline">
            recuperar senha
          </Link>
          .
        </span>
      )}
      {status === "ok" && (
        <span className="text-[0.7rem]" style={{ color: "var(--success)" }}>
          E-mail disponível ✓
        </span>
      )}
    </label>
  );
}
