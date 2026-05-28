"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  AlertCircle,
  LogOut,
} from "lucide-react";
import { criarClienteBrowser } from "@/lib/db/supabase-browser";
import { PLANOS, formatarPreco, type PlanoId } from "@/lib/planos";

/**
 * Tela "Complete seu cadastro" — mostrada após primeiro login OAuth.
 *
 * Quando o usuário entra com Google ou Facebook pela primeira vez,
 * o /auth/callback redireciona pra cá. Aqui ele preenche o que faltou
 * (nome da agência + plano), e a API cria workspace + profile.
 */
export default function CompletarCadastroPage() {
  const router = useRouter();
  const [carregandoUser, setCarregandoUser] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [nomeUser, setNomeUser] = useState<string | null>(null);
  const [nomeAgencia, setNomeAgencia] = useState("");
  const [planoId, setPlanoId] = useState<PlanoId | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Confere se há sessão; se não, manda pro login
  useEffect(() => {
    const supabase = criarClienteBrowser();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setEmail(data.user.email ?? null);
      const meta = data.user.user_metadata ?? {};
      const fullName =
        (meta.full_name as string | undefined) ??
        (meta.name as string | undefined) ??
        (data.user.email?.split("@")[0] ?? null);
      setNomeUser(fullName);
      setCarregandoUser(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!nomeAgencia.trim()) {
      setErro("Informe o nome da agência.");
      return;
    }
    if (!planoId) {
      setErro("Escolha um plano.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/auth/completar-cadastro", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome_agencia: nomeAgencia.trim(),
          plano: planoId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.erro ?? `Falha (${res.status}).`);
      }
      // Primeiro acesso (veio do OAuth) — passa pelo /pagamento → /onboarding → /app
      router.replace("/pagamento");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function sair() {
    const supabase = criarClienteBrowser();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (carregandoUser) {
    return (
      <div className="min-h-screen bg-main text-primary flex items-center justify-center">
        <div className="text-sm text-muted">Carregando…</div>
      </div>
    );
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
          <button
            onClick={sair}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors"
          >
            <LogOut size={13} />
            Sair
          </button>
        </div>
      </nav>

      <div className="relative flex-1 flex items-start justify-center px-6 py-10">
        <div className="w-full max-w-[640px]">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight">
              {nomeUser ? `Bem-vindo, ${nomeUser.split(" ")[0]}!` : "Bem-vindo!"}
            </h1>
            <p className="mt-2 text-sm text-secondary">
              Estamos quase lá. Só precisamos do nome da sua agência e do plano
              que faz sentido pro seu time.
              {email && (
                <>
                  <br />
                  <span className="text-xs text-muted">
                    Logado como <strong className="text-secondary">{email}</strong>
                  </span>
                </>
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Nome da agência */}
            <div className="card">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-secondary">
                  Nome da agência
                </span>
                <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong transition-colors">
                  <Building2 size={14} className="text-muted flex-shrink-0" />
                  <input
                    type="text"
                    value={nomeAgencia}
                    onChange={(e) => setNomeAgencia(e.target.value)}
                    placeholder="Agência Estrela"
                    autoComplete="organization"
                    autoFocus
                    className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted"
                  />
                </div>
              </label>
            </div>

            {/* Plano */}
            <div>
              <div className="text-xs font-medium text-secondary mb-2">
                Plano
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {PLANOS.map((p) => {
                  const sel = planoId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlanoId(p.id)}
                      className="card text-left transition-all hover:border-border-strong relative p-3"
                      style={{
                        borderColor: sel ? "var(--module-vendas)" : undefined,
                        boxShadow: sel ? "0 0 0 1px var(--module-vendas)" : undefined,
                      }}
                    >
                      {p.destaque && (
                        <span
                          className="absolute -top-2 left-3 text-[0.55rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                          style={{ backgroundColor: "var(--module-vendas)" }}
                        >
                          Popular
                        </span>
                      )}
                      <div className="text-sm font-bold text-primary">{p.nome}</div>
                      <div className="text-base font-bold text-primary mt-1">
                        {formatarPreco(p.precoMensal)}
                        <span className="text-xs text-muted font-normal">/mês</span>
                      </div>
                      <div className="text-[0.65rem] text-muted mt-1">
                        {p.maxArtistas} artista{p.maxArtistas === 1 ? "" : "s"} ·{" "}
                        {p.maxUsuariosAdicionais} usuário{p.maxUsuariosAdicionais === 1 ? "" : "s"}
                      </div>
                      {sel && (
                        <div
                          className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: "var(--module-vendas)" }}
                        >
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

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
              {enviando ? "Criando..." : "Finalizar cadastro e entrar"}
              {!enviando && <ArrowRight size={14} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
