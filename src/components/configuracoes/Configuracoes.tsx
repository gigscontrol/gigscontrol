"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Settings,
  Music,
  Users,
  Trash2,
  History,
  Bell,
} from "lucide-react";
import AbaGeral from "./AbaGeral";
import AbaArtistas from "./AbaArtistas";
import AbaEquipe from "./AbaEquipe";
import AbaLixeira from "./AbaLixeira";
import AbaHistorico from "./AbaHistorico";
import AbaNotificacoes from "./AbaNotificacoes";
import { useAuth } from "@/lib/auth-context";

/**
 * Tela de Configurações.
 *
 * - Admin do workspace: vê todas as abas — a aba "Geral" reúne logo,
 *   nome, e-mail, username da agência E alteração da própria senha.
 * - Demais usuários (produtor, vendedor, financeiro, artista):
 *   veem só "Geral" (que pra eles só mostra Alterar senha) e
 *   "Notificações".
 */

type AbaConfig = "geral" | "artistas" | "equipe" | "lixeira" | "historico" | "notificacoes";

type AbaDef = { id: AbaConfig; label: string; icon: typeof Settings };

const ABAS_ADMIN: AbaDef[] = [
  { id: "geral", label: "Geral", icon: Settings },
  { id: "artistas", label: "Artistas", icon: Music },
  { id: "equipe", label: "Equipe", icon: Users },
  { id: "lixeira", label: "Lixeira", icon: Trash2 },
  { id: "historico", label: "Histórico", icon: History },
  { id: "notificacoes", label: "Notificações", icon: Bell },
];

// Usuários comuns veem só Geral (= Alterar senha) e Notificações
const ABAS_USUARIO: AbaDef[] = [
  { id: "geral", label: "Geral", icon: Settings },
  { id: "notificacoes", label: "Notificações", icon: Bell },
];

export default function Configuracoes({ onSair }: { onSair: () => void }) {
  const { sessao } = useAuth();
  const isAdmin = sessao?.usuario?.papel === "admin";

  const abas = useMemo(() => (isAdmin ? ABAS_ADMIN : ABAS_USUARIO), [isAdmin]);
  const [aba, setAba] = useState<AbaConfig>(abas[0]?.id ?? "geral");

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto w-full">
      {/* Cabeçalho */}
      <button
        onClick={onSair}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors mb-3"
      >
        <ArrowLeft size={13} />
        Voltar para a dashboard
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold">
          {isAdmin ? "Configurações" : "Minha conta"}
        </h1>
        <p className="text-sm text-muted">
          {isAdmin
            ? "Personalize a dashboard, gerencie artistas e a equipe da sua agência."
            : "Configurações da sua conta."}
        </p>
      </div>

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
                    ? "2px solid var(--module-vendas)"
                    : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                <Icon size={14} />
                {a.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Conteúdo */}
      {aba === "geral" && <AbaGeral />}
      {aba === "artistas" && isAdmin && <AbaArtistas />}
      {aba === "equipe" && isAdmin && <AbaEquipe />}
      {aba === "lixeira" && isAdmin && <AbaLixeira />}
      {aba === "historico" && isAdmin && <AbaHistorico />}
      {aba === "notificacoes" && <AbaNotificacoes />}
    </div>
  );
}
