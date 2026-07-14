"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, User, AlertCircle } from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import BotoesOAuth from "@/components/BotoesOAuth";
import AuthShell from "@/components/auth/AuthShell";
import PainelVivoLogin from "@/components/auth/PainelVivoLogin";
import LandingNav from "@/components/landing/LandingNav";
import FooterLanding from "@/components/landing/FooterLanding";
import CampoSenha from "@/components/CampoSenha";
import { useT } from "@/lib/i18n";

export default function LoginPage() {
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <LoginInner />
      </Suspense>
    </AuthProvider>
  );
}

function LoginInner() {
  const router = useRouter();
  const t = useT();
  const { sessao, login } = useAuth();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  // ?next= só é aceito se for um path interno seguro (evita open-redirect)
  const next = searchParams.get("next");
  const destinoNext =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? next
      : null;

  // Se já está logado, vai direto pro destino certo
  useEffect(() => {
    if (sessao) {
      router.replace(
        sessao.tipo === "super-admin" ? "/admin" : destinoNext ?? "/app"
      );
    }
  }, [sessao, router, destinoNext]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    const res = await login(email, senha);
    setEnviando(false);
    if (res.ok) {
      router.replace(
        res.tipo === "super-admin" ? "/admin" : destinoNext ?? "/app"
      );
    } else {
      setErro(res.erro ?? t("Não foi possível entrar."));
    }
  }

  return (
    <>
      {/* Mesmo menu de topo da landing (links viram /#seção; logo → home) */}
      <LandingNav />
      <AuthShell
        titulo={t("Entrar na conta")}
        subtitulo={t("Acesse o painel da sua agência")}
        painelEsquerdo={<PainelVivoLogin comNavExterna />}
        comNavExterna
      >
      {/* OAuth — Google + Facebook */}
      <div className="card mb-3">
        <BotoesOAuth prefixo={t("Entrar com")} />
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

          <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
            {/* E-mail */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-secondary">
                {t("E-mail ou usuário")}
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

            {/* Senha — CampoSenha traz olho (mostrar/ocultar) + aviso de Caps Lock */}
            <CampoSenha
              label={t("Senha")}
              value={senha}
              onChange={setSenha}
              autoComplete="current-password"
              mostrarForca={false}
            />

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
              style={{ backgroundColor: "var(--brand)", color: "#fff" }}
            >
              {enviando ? t("Entrando…") : t("Entrar")}
              {!enviando && <ArrowRight size={14} />}
            </button>

            <div className="text-center">
              <Link
                href="/forgot-password"
                className="text-xs text-muted hover:text-primary transition-colors"
              >
                {t("Esqueci minha senha")}
              </Link>
            </div>

            <div className="text-center flex flex-col gap-1.5 pt-3 border-t border-border">
              <Link
                href="/signup"
                className="text-sm font-medium hover:text-primary transition-colors"
                style={{ color: "var(--brand)" }}
              >
                {t("Criar conta agora →")}
              </Link>
              <Link
                href="/planos"
                className="text-xs text-muted hover:text-secondary transition-colors"
              >
                {t("Ver planos disponíveis")}
              </Link>
            </div>
          </form>
      </AuthShell>
      <FooterLanding />
    </>
  );
}
