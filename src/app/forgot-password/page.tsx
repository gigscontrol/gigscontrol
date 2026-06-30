"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { criarClienteBrowser } from "@/lib/db/supabase-browser";
import { useT } from "@/lib/i18n";

/**
 * Tela "Esqueci minha senha".
 *
 * Usuário digita o email → cliente chama
 * `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
 * Por segurança, devolve a mesma mensagem de "email enviado" mesmo
 * que o endereço não exista (evita enumeração de contas).
 */
export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!email.trim() || !email.includes("@")) {
      setErro(t("Informe um e-mail válido."));
      return;
    }
    setEnviando(true);
    try {
      const supabase = criarClienteBrowser();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        // Mesmo em caso de erro, mostramos "enviado" pra evitar
        // enumeração de contas. Log no console pra debug.
        // eslint-disable-next-line no-console
        console.error("[forgot-password]", error.message);
      }
      setEnviado(true);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setEnviado(true);
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
            <ArrowLeft size={13} />
            {t("Voltar pro login")}
          </Link>
        </div>
      </nav>

      <div className="relative flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          {!enviado ? (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold tracking-tight">
                  {t("Esqueci minha senha")}
                </h1>
                <p className="mt-1.5 text-sm text-secondary">
                  {t("Digite seu e-mail e enviaremos um link pra criar uma nova senha.")}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-secondary">{t("E-mail")}</span>
                  <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong transition-colors">
                    <Mail size={14} className="text-muted flex-shrink-0" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      autoComplete="email"
                      autoFocus
                      className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted"
                    />
                  </div>
                </label>

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
                  {enviando ? t("Enviando...") : t("Enviar link de recuperação")}
                  {!enviando && <ArrowRight size={14} />}
                </button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="text-xs text-muted hover:text-secondary transition-colors"
                  >
                    {t("Lembrei a senha — voltar pro login")}
                  </Link>
                </div>
              </form>
            </>
          ) : (
            <div className="card text-center">
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{
                  background: "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))",
                  color: "var(--success)",
                }}
              >
                <CheckCircle2 size={28} />
              </div>
              <h1 className="text-xl font-bold tracking-tight">
                {t("Se a conta existir, o link foi enviado")}
              </h1>
              <p className="mt-2 text-sm text-secondary">
                {t("Confira a caixa de entrada de")}{" "}
                <strong className="text-primary break-all">{email}</strong>{" "}
                {t("(e a pasta de spam).")}
                <br />
                {t("O link expira em")}{" "}
                <strong>{t("1 hora")}</strong>.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors"
              >
                <ArrowLeft size={13} />
                {t("Voltar pro login")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
