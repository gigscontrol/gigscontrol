"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { criarClienteBrowser } from "@/lib/db/supabase-browser";
import CampoSenha from "@/components/CampoSenha";
import { avaliarSenha } from "@/lib/senha-forca";

/**
 * Tela de redefinição de senha.
 *
 * O usuário chega aqui clicando no link enviado por email pelo
 * `resetPasswordForEmail`. O Supabase já criou uma sessão temporária
 * de "recovery" antes de redirecionar pra cá, então é possível chamar
 * `updateUser({ password })` direto.
 *
 * Se chegou sem sessão (link expirado / clicado fora do contexto),
 * mostra um aviso e manda voltar pro fluxo de "esqueci a senha".
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [temSessao, setTemSessao] = useState<boolean | null>(null);
  const [senha, setSenha] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  // Confirma se temos uma sessão (de recovery) ativa
  useEffect(() => {
    const supabase = criarClienteBrowser();
    supabase.auth.getSession().then(({ data }) => {
      setTemSessao(!!data.session);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const aval = avaliarSenha(senha);
    if (!aval.podeUsar) {
      setErro(aval.motivos[0] ?? "Escolha uma senha mais segura.");
      return;
    }
    if (senha !== senhaConfirm) {
      setErro("As senhas não coincidem.");
      return;
    }
    setEnviando(true);
    try {
      const supabase = criarClienteBrowser();
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      setSucesso(true);
      // Aguarda 1.5s pra mostrar o checkmark e redireciona pro app
      setTimeout(() => router.replace("/app"), 1500);
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
        </div>
      </nav>

      <div className="relative flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          {temSessao === null ? (
            <div className="card text-center text-sm text-muted py-12">
              Carregando…
            </div>
          ) : !temSessao ? (
            // Link inválido / expirado
            <div className="card text-center">
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{
                  background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))",
                  color: "var(--danger)",
                }}
              >
                <AlertCircle size={28} />
              </div>
              <h1 className="text-xl font-bold tracking-tight">
                Link inválido ou expirado
              </h1>
              <p className="mt-2 text-sm text-secondary">
                Esse link pode ter sido usado ou expirou após 1 hora. Solicite
                um novo.
              </p>
              <Link
                href="/forgot-password"
                className="mt-6 inline-flex items-center gap-1.5 btn btn-primary text-sm"
                style={{ backgroundColor: "var(--module-vendas)", color: "#fff" }}
              >
                Solicitar novo link
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : sucesso ? (
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
                Senha alterada com sucesso
              </h1>
              <p className="mt-2 text-sm text-secondary">
                Redirecionando pro seu painel...
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold tracking-tight">Nova senha</h1>
                <p className="mt-1.5 text-sm text-secondary">
                  Digite a senha que você quer usar de agora em diante.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
                <CampoSenha
                  label="Nova senha"
                  value={senha}
                  onChange={setSenha}
                  autoFocus
                />
                <CampoSenha
                  label="Confirmar nova senha"
                  value={senhaConfirm}
                  onChange={setSenhaConfirm}
                  mostrarForca={false}
                />

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
                  {enviando ? "Salvando..." : "Trocar senha e entrar"}
                  {!enviando && <ArrowRight size={14} />}
                </button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors"
                  >
                    <ArrowLeft size={13} />
                    Cancelar e voltar pro login
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

