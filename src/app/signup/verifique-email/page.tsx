"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useT } from "@/lib/i18n";

export default function VerifiqueEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifiqueEmailInner />
    </Suspense>
  );
}

function VerifiqueEmailInner() {
  const t = useT();
  const params = useSearchParams();
  const email = params.get("email");

  return (
    <div className="min-h-screen bg-main text-primary flex flex-col">
      <div
        className="fixed inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(500px circle at 50% 0%, rgba(61,123,255,0.15), transparent 60%)",
        }}
      />

      <nav className="relative border-b border-border">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-6 h-16">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="rounded-md flex items-center justify-center font-bold text-white h-7 w-7 text-sm"
              style={{ backgroundColor: "var(--brand)" }}
            >
              G
            </div>
            <span className="font-bold tracking-tight text-base">
              GIGS<span className="text-muted"> CONTROL</span>
            </span>
          </Link>
        </div>
      </nav>

      <div className="relative flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px] card text-center">
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{
              background: "linear-gradient(135deg, rgba(61,123,255,0.2), rgba(61,123,255,0.05))",
              color: "var(--brand)",
            }}
          >
            <Mail size={28} />
          </div>

          <h1 className="text-xl font-bold tracking-tight">{t("Confira seu e-mail")}</h1>
          <p className="mt-2 text-sm text-secondary">
            {t("Enviamos um link de confirmação para")}
            {email ? (
              <>
                {" "}
                <strong className="text-primary break-all">{email}</strong>.
              </>
            ) : (
              <> {t("o e-mail informado.")}</>
            )}
            <br />
            {t("Clique no link pra ativar sua conta e entrar.")}
          </p>

          <div className="mt-6 flex flex-col gap-2 text-left bg-elevated/40 rounded-md p-3 text-xs text-secondary">
            <div className="inline-flex items-start gap-2">
              <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" style={{ color: "var(--success)" }} />
              {t("Não recebeu? Verifique a caixa de spam.")}
            </div>
            <div className="inline-flex items-start gap-2">
              <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" style={{ color: "var(--success)" }} />
              {t("O link expira em 24 horas.")}
            </div>
            <div className="inline-flex items-start gap-2">
              <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" style={{ color: "var(--success)" }} />
              {t("Você pode fechar essa aba — basta clicar no link do email.")}
            </div>
          </div>

          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors"
          >
            <ArrowLeft size={13} />
            {t("Voltar pro login")}
          </Link>
        </div>
      </div>
    </div>
  );
}
