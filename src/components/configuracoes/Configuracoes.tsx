"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n";
import {
  ArrowLeft,
  User,
  Building2,
  Trash2,
  History,
  Bell,
  SlidersHorizontal,
  CreditCard,
} from "lucide-react";
import PageHeader from "../PageHeader";
import AbaPerfil from "./AbaPerfil";
import AbaAgencia from "./AbaAgencia";
import AbaPreferencias from "./AbaPreferencias";
import AbaPlano from "./AbaPlano";
import AbaLixeira from "./AbaLixeira";
import AbaHistorico from "./AbaHistorico";
import AbaNotificacoes from "./AbaNotificacoes";
import { useAuth } from "@/lib/auth-context";

/**
 * Tela de Configurações.
 *
 * - Admin do workspace: vê todas as abas — "Perfil" (dados pessoais + acesso
 *   + cor do avatar) e "Agência" (nome exibido + username), além de
 *   Preferências, Plano & Assinatura, Lixeira, Histórico e Notificações.
 * - Demais usuários (produtor, vendedor, financeiro, artista): veem só
 *   "Perfil" e "Notificações".
 *
 * A sub-aba ativa persiste na URL via ?aba=... (compartilhável / sobrevive a
 * um refresh), em vez de useState puro.
 */

type AbaConfig =
  | "perfil"
  | "agencia"
  | "preferencias"
  | "plano"
  | "lixeira"
  | "historico"
  | "notificacoes";

type AbaDef = { id: AbaConfig; label: string; icon: typeof User };

const ABAS_ADMIN: AbaDef[] = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "agencia", label: "Agência", icon: Building2 },
  { id: "preferencias", label: "Preferências", icon: SlidersHorizontal },
  { id: "plano", label: "Plano & Assinatura", icon: CreditCard },
  { id: "lixeira", label: "Lixeira", icon: Trash2 },
  { id: "historico", label: "Histórico", icon: History },
  { id: "notificacoes", label: "Notificações", icon: Bell },
];

// Usuários comuns veem só Perfil e Notificações
const ABAS_USUARIO: AbaDef[] = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "notificacoes", label: "Notificações", icon: Bell },
];

function abaValidaParaPapel(id: string | null, abas: AbaDef[]): AbaConfig | null {
  const encontrada = abas.find((a) => a.id === id);
  return encontrada ? encontrada.id : null;
}

export default function Configuracoes({ onSair }: { onSair: () => void }) {
  const t = useT();
  const { sessao } = useAuth();
  const isAdmin = sessao?.usuario?.papel === "admin";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const abas = useMemo(() => (isAdmin ? ABAS_ADMIN : ABAS_USUARIO), [isAdmin]);

  // Fallback local (evita "pisca" antes do primeiro render com searchParams).
  const [abaFallback, setAbaFallback] = useState<AbaConfig>(abas[0]?.id ?? "perfil");
  const aba =
    abaValidaParaPapel(searchParams.get("aba"), abas) ?? abaFallback;

  const setAba = useCallback(
    (novaAba: AbaConfig) => {
      setAbaFallback(novaAba);
      const params = new URLSearchParams(searchParams.toString());
      params.set("aba", novaAba);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <button
        onClick={onSair}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors mb-3"
      >
        <ArrowLeft size={13} />
        {t("Voltar para a dashboard")}
      </button>

      <PageHeader
        title={isAdmin ? "Configurações" : "Minha conta"}
        subtitle={
          isAdmin
            ? "Personalize a aparência e gerencie a conta da sua agência. Artistas e equipe agora ficam no módulo Agência."
            : "Configurações da sua conta."
        }
      />

      {/* Abas — só mostra a barra se houver mais de uma */}
      {abas.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b border-border mb-6">
          {abas.map((a) => {
            const Icon = a.icon;
            const ativa = aba === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm transition-colors"
                style={{
                  color: ativa ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: ativa ? 600 : 400,
                  borderBottom: ativa
                    ? "2px solid var(--brand)"
                    : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                <Icon size={14} />
                {t(a.label)}
              </button>
            );
          })}
        </div>
      )}

      {/* Conteúdo */}
      {aba === "perfil" && <AbaPerfil />}
      {aba === "agencia" && isAdmin && <AbaAgencia />}
      {aba === "preferencias" && isAdmin && <AbaPreferencias />}
      {aba === "plano" && isAdmin && <AbaPlano />}
      {aba === "lixeira" && isAdmin && <AbaLixeira />}
      {aba === "historico" && isAdmin && <AbaHistorico />}
      {aba === "notificacoes" && <AbaNotificacoes />}
    </div>
  );
}
