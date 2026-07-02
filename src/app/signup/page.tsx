"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Mail,
  User,
  Building2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { criarClienteBrowser } from "@/lib/db/supabase-browser";
import type { PlanoId } from "@/lib/planos";
import BotoesOAuth from "@/components/BotoesOAuth";
import AuthShell from "@/components/auth/AuthShell";
import CampoSenha from "@/components/CampoSenha";
import { avaliarSenha } from "@/lib/senha-forca";
import { useT } from "@/lib/i18n";

/**
 * Tela de cadastro (signup) — uma única etapa:
 *   nome, e-mail, senha, nome da agência, termos.
 *
 * O PLANO é escolhido depois, na Etapa 2 do /onboarding (com opção
 * de teste grátis 7 dias). Aqui o plano vai como "individual" no
 * user_metadata só pra preencher — o user troca depois.
 *
 * Cliente chama supabase.auth.signUp() com user_metadata. O Supabase
 * envia o email de confirmação. Quando o usuário clicar no link, cai
 * em /auth/callback — que cria workspace + profile.
 */
export default function SignupPage() {
  const router = useRouter();
  const t = useT();
  // Plano fixo no signup — o usuário escolhe de verdade na Etapa 2
  // do /onboarding (com opção de trial grátis 7 dias).
  const planoFixoInicial: PlanoId = "individual";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) return setErro(t("Informe seu nome."));
    if (!nomeAgencia.trim()) return setErro(t("Informe o nome da agência."));
    if (!email.trim() || !email.includes("@")) return setErro(t("Email inválido."));
    const avalSenha = avaliarSenha(senha);
    if (!avalSenha.podeUsar) {
      return setErro(avalSenha.motivos[0] ?? t("Escolha uma senha mais segura."));
    }
    if (!aceitouTermos) return setErro(t("Você precisa aceitar os Termos de Uso."));

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
            t("Esse e-mail já tem uma conta no GIGS CONTROL. Faça login ou recupere sua senha.")
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
            plano_escolhido: planoFixoInicial,
          },
        },
      });
      if (error) {
        if (error.message.toLowerCase().includes("already registered")) {
          throw new Error(t("Esse e-mail já tem uma conta. Faça login."));
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
    <AuthShell
      titulo={t("Criar conta")}
      subtitulo={t("7 dias grátis. Sem cartão de crédito.")}
    >
      <FormCadastro
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
        onSubmit={handleSubmit}
      />
    </AuthShell>
  );
}

// ============================================================
// Form de cadastro — único passo. Plano é escolhido depois no /onboarding
// (com opção de teste grátis 7 dias).
// ============================================================
function FormCadastro({
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
  onSubmit,
}: {
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
  onSubmit: (e: React.FormEvent) => void;
}) {
  const t = useT();
  const podeEnviar =
    emailStatus === "ok" &&
    avaliarSenha(senha).podeUsar &&
    aceitouTermos &&
    nome.trim().length > 0 &&
    nomeAgencia.trim().length > 0 &&
    !enviando;
  return (
    <>
      {/* OAuth — atalho rápido */}
      <div className="card mb-3">
        <BotoesOAuth prefixo={t("Cadastrar com")} />
      </div>

      {/* Divisor */}
      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-main px-3 text-[0.65rem] uppercase tracking-wider text-muted">
            {t("ou com email")}
          </span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="card flex flex-col gap-4">
        <Campo
          icon={<User size={14} />}
          label={t("Seu nome")}
          value={nome}
          onChange={setNome}
          placeholder={t("João da Silva")}
          autoComplete="name"
        />
        <Campo
          icon={<Building2 size={14} />}
          label={t("Nome da agência")}
          value={nomeAgencia}
          onChange={setNomeAgencia}
          placeholder={t("Agência Estrela")}
          autoComplete="organization"
        />
        <CampoEmail
          email={email}
          setEmail={setEmail}
          status={emailStatus}
        />
        <CampoSenha
          label={t("Senha")}
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
            {t("Li e aceito os")}{" "}
            <Link href="/termos" target="_blank" className="text-primary underline">
              {t("Termos de Uso")}
            </Link>{" "}
            {t("e a")}{" "}
            <Link href="/privacidade" target="_blank" className="text-primary underline">
              {t("Política de Privacidade")}
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
          style={{ backgroundColor: "var(--brand)", color: "#fff" }}
        >
          {enviando ? t("Criando conta…") : t("Criar conta e enviar verificação")}
          {!enviando && <ArrowRight size={14} />}
        </button>

        <div className="text-center">
          <Link
            href="/login"
            className="text-xs text-muted hover:text-secondary transition-colors"
          >
            {t("Já tem conta? Entre aqui")}
          </Link>
        </div>
      </form>
    </>
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
  const t = useT();
  // Cor de borda + mensagem conforme status
  const borda =
    status === "em-uso" || status === "invalido"
      ? "var(--danger)"
      : status === "ok"
      ? "var(--success)"
      : undefined;

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-secondary">{t("E-mail")}</span>
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
          {t("Formato de e-mail inválido.")}
        </span>
      )}
      {status === "em-uso" && (
        <span className="text-[0.7rem]" style={{ color: "var(--danger)" }}>
          {t("Esse e-mail já tem uma conta.")}{" "}
          <Link href="/login" className="underline">
            {t("Entrar")}
          </Link>{" "}
          {t("ou")}{" "}
          <Link href="/forgot-password" className="underline">
            {t("recuperar senha")}
          </Link>
          .
        </span>
      )}
      {status === "ok" && (
        <span className="text-[0.7rem]" style={{ color: "var(--success)" }}>
          {t("E-mail disponível ✓")}
        </span>
      )}
    </label>
  );
}
