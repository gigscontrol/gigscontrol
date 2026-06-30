"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { criarClienteBrowser } from "@/lib/db/supabase-browser";
import { useT } from "@/lib/i18n";

type Provider = "google" | "facebook";

/**
 * Botões de "Continuar com Google" e "Continuar com Facebook".
 *
 * Usado em /login e /signup. Dispara `signInWithOAuth` que redireciona
 * o usuário pro provider, faz o consent, e volta pra /auth/callback
 * onde o handler decide: se já tem profile → /app; se não → manda
 * pra /signup/completar pra preencher nome da agência + plano.
 *
 * Os providers só funcionam quando habilitados no painel do Supabase
 * com Client ID/Secret próprios. Se não estiverem, o botão dispara
 * erro retornado pelo Supabase e mostra mensagem amigável.
 */
type Props = {
  /** Texto antes do nome do provider. Ex: "Continuar com" ou "Entrar com". */
  prefixo?: string;
};

export default function BotoesOAuth({ prefixo = "Continuar com" }: Props) {
  const t = useT();
  const [carregando, setCarregando] = useState<Provider | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function entrarCom(provider: Provider) {
    setErro(null);
    setCarregando(provider);
    try {
      const supabase = criarClienteBrowser();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      // Sucesso: o navegador já foi redirecionado pra Google/Facebook.
      // Esse setCarregando(null) provavelmente nem chega a rodar.
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.toLowerCase().includes("not enabled") || msg.toLowerCase().includes("disabled")) {
        const providerNome = provider === "google" ? "Google" : "Facebook";
        setErro(
          t("Login com {provider} ainda está sendo configurado. Use email e senha por enquanto.", { provider: providerNome })
        );
      } else {
        setErro(msg);
      }
      setCarregando(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => entrarCom("google")}
        disabled={carregando !== null}
        className="flex items-center justify-center gap-2.5 w-full py-2.5 rounded-md border border-border bg-elevated hover:border-border-strong transition-colors text-sm font-medium disabled:opacity-60"
      >
        <IconeGoogle />
        {carregando === "google" ? t("Conectando...") : `${prefixo} Google`}
      </button>

      <button
        type="button"
        onClick={() => entrarCom("facebook")}
        disabled={carregando !== null}
        className="flex items-center justify-center gap-2.5 w-full py-2.5 rounded-md border border-border bg-elevated hover:border-border-strong transition-colors text-sm font-medium disabled:opacity-60"
      >
        <IconeFacebook />
        {carregando === "facebook" ? t("Conectando...") : `${prefixo} Facebook`}
      </button>

      {erro && (
        <div className="flex items-center gap-2 text-xs text-danger bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.3)] rounded-md px-3 py-2">
          <AlertCircle size={13} className="flex-shrink-0" />
          {erro}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Ícones SVG inline (cores oficiais dos providers)
// ============================================================

function IconeGoogle() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

function IconeFacebook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#1877F2"
        d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.022 1.793-4.694 4.533-4.694 1.312 0 2.686.234 2.686.234v2.969h-1.514c-1.49 0-1.955.926-1.955 1.876v2.255h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
      />
    </svg>
  );
}
