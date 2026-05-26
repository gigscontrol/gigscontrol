"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock, User, AlertCircle } from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginInner />
    </AuthProvider>
  );
}

function LoginInner() {
  const router = useRouter();
  const { sessao, login } = useAuth();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Se já está logado, vai direto pro destino certo
  useEffect(() => {
    if (sessao) {
      router.replace(sessao.tipo === "super-admin" ? "/admin" : "/app");
    }
  }, [sessao, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const res = await login(email, senha);
    setEnviando(false);
    if (res.ok) {
      router.replace(res.tipo === "super-admin" ? "/admin" : "/app");
    } else {
      setErro(res.erro ?? "Não foi possível entrar.");
    }
  }

  return (
    <div className="min-h-screen bg-main text-primary flex flex-col">
      {/* Glow de fundo */}
      <div
        className="fixed inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(500px circle at 50% 0%, rgba(168,85,247,0.15), transparent 60%)",
        }}
      />

      {/* Nav simples */}
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
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors"
          >
            <ArrowLeft size={13} />
            Voltar ao site
          </Link>
        </div>
      </nav>

      {/* Formulário */}
      <div className="relative flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Entrar na conta</h1>
            <p className="mt-1.5 text-sm text-secondary">
              Acesse o painel da sua agência
            </p>
          </div>

          <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
            {/* E-mail */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-secondary">
                E-mail ou usuário
              </span>
              <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong transition-colors">
                <User size={14} className="text-muted flex-shrink-0" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="username"
                  className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted"
                />
              </div>
            </label>

            {/* Senha */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-secondary">Senha</span>
              <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong transition-colors">
                <Lock size={14} className="text-muted flex-shrink-0" />
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted"
                />
              </div>
            </label>

            {/* Erro */}
            {erro && (
              <div className="flex items-center gap-2 text-xs text-danger bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.3)] rounded-md px-3 py-2">
                <AlertCircle size={13} className="flex-shrink-0" />
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="btn btn-primary text-sm w-full justify-center py-2.5 disabled:opacity-60"
              style={{ backgroundColor: "var(--module-vendas)", color: "#fff" }}
            >
              {enviando ? "Entrando…" : "Entrar"}
              {!enviando && <ArrowRight size={14} />}
            </button>

            <div className="text-center flex flex-col gap-1.5">
              <Link
                href="/signup"
                className="text-sm font-medium hover:text-primary transition-colors"
                style={{ color: "var(--module-vendas)" }}
              >
                Criar conta agora →
              </Link>
              <Link
                href="/planos"
                className="text-xs text-muted hover:text-secondary transition-colors"
              >
                Ver planos disponíveis
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
