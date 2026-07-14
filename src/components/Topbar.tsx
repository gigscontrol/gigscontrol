"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Menu,
  LogOut,
  BadgeCheck,
  ChevronDown,
  Settings,
  CalendarClock,
  FileText,
} from "lucide-react";
import { MODULE_THEMES } from "@/types";
import type { ActiveTab } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { LABELS_PAPEL } from "@/lib/permissoes";
import { getPlano } from "@/lib/planos";
import { useContratos } from "@/lib/contratos-context";
import SinoNotificacoes from "./SinoNotificacoes";
import LanguageSwitcher from "./LanguageSwitcher";
import BotaoTema from "./BotaoTema";
import { useT } from "@/lib/i18n";

type Props = {
  onOpenSidebar: () => void;
  activeTab: ActiveTab;
  onAbrirConfiguracoes?: () => void;
};

export default function Topbar({
  onOpenSidebar,
  activeTab,
  onAbrirConfiguracoes,
}: Props) {
  const theme = MODULE_THEMES[activeTab];
  const { sessao, logout } = useAuth();
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const usuario = sessao?.usuario;
  const workspace = sessao?.workspace;
  const papel = usuario ? LABELS_PAPEL[usuario.papel] : null;
  const plano = workspace ? getPlano(workspace.plano) : null;
  const isAdmin = usuario?.papel === "admin";

  // Dias restantes do plano (modelo pré-pago por validade). Só admin — o
  // endpoint /api/assinatura/estado é admin-only e é info de cobrança.
  const [diasRestantes, setDiasRestantes] = useState<number | null>(null);
  useEffect(() => {
    if (!isAdmin) return;
    let ativo = true;
    fetch("/api/assinatura/estado", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (ativo && d && typeof d.diasRestantes === "number") {
          setDiasRestantes(d.diasRestantes);
        }
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [isAdmin]);

  // Contratos que ainda dá pra gerar no mês = limite do plano − gerados no mês
  // (por criadoEm), mesmo cálculo do "Novo contrato".
  const { contratos } = useContratos();
  const limiteContratos = plano?.maxContratosMes ?? 0;
  const contratosRestantes = useMemo(() => {
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const usados = contratos.filter((c) => {
      if (!c.criadoEm) return false;
      const d = new Date(c.criadoEm);
      return !isNaN(d.getTime()) && d >= inicioMes;
    }).length;
    return Math.max(0, limiteContratos - usados);
  }, [contratos, limiteContratos]);

  const iniciais = usuario
    ? usuario.nome
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "—";

  const pillBase =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap";

  return (
    <header className="flex items-center justify-between gap-4 px-4 lg:px-6 h-16 flex-shrink-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden btn-ghost p-3 -ml-1 rounded"
          aria-label={t("Abrir menu")}
        >
          <Menu size={18} />
        </button>

        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.color }} />
          <span className="truncate text-sm font-medium text-secondary">{t(theme.label)}</span>
        </div>

        {/* Status do plano (só admin): dias restantes + contratos do mês */}
        {isAdmin && (
          <div className="hidden md:flex items-center gap-2 ml-1">
            {diasRestantes !== null && (
              <span
                className={pillBase}
                title={t("Dias restantes do seu plano")}
                style={{
                  borderColor: diasRestantes <= 7 ? "var(--warning)" : "var(--border-color)",
                  color: diasRestantes <= 7 ? "var(--warning)" : "var(--text-secondary)",
                }}
              >
                <CalendarClock size={13} />
                {t("{n} dias", { n: diasRestantes })}
              </span>
            )}
            {plano && (
              <span
                className={pillBase}
                title={t("Contratos que você ainda pode gerar neste mês")}
                style={{
                  borderColor: contratosRestantes === 0 ? "var(--danger)" : "var(--border-color)",
                  color: contratosRestantes === 0 ? "var(--danger)" : "var(--text-secondary)",
                }}
              >
                <FileText size={13} />
                {contratosRestantes}/{limiteContratos} {t("contratos")}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <SinoNotificacoes onVerTodas={onAbrirConfiguracoes} />
        <LanguageSwitcher />
        <BotaoTema />

        {/* Menu de perfil */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t("Menu de perfil")}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex h-9 items-center gap-1.5 rounded-md border border-border pl-1 pr-2 text-secondary transition-colors hover:border-border-strong hover:text-primary"
          >
            <span
              className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-primary"
              style={{
                background: papel
                  ? `linear-gradient(135deg, ${papel.cor}, ${papel.cor}99)`
                  : "var(--bg-elevated)",
              }}
            >
              {iniciais}
            </span>
            <ChevronDown
              size={13}
              className={`text-muted transition-transform ${menuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {menuOpen && usuario && (
            <div
              className="absolute right-0 top-full mt-2 w-64 bg-surface border border-border rounded-lg overflow-hidden z-50"
              style={{ boxShadow: "0 12px 30px var(--shadow-color)" }}
            >
              {/* Cabeçalho */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <span
                    className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-primary flex-shrink-0"
                    style={{
                      background: papel
                        ? `linear-gradient(135deg, ${papel.cor}, ${papel.cor}99)`
                        : "var(--bg-elevated)",
                    }}
                  >
                    {iniciais}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-primary truncate">
                      {usuario.nome}
                    </div>
                    <div className="text-xs text-muted truncate">{usuario.email}</div>
                  </div>
                </div>
              </div>

              {/* Papel + Plano */}
              <div className="p-3 border-b border-border flex flex-col gap-2">
                {papel && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">{t("Papel")}</span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{ backgroundColor: `${papel.cor}22`, color: papel.cor }}
                    >
                      {papel.nome}
                    </span>
                  </div>
                )}
                {plano && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">{t("Plano")}</span>
                    <span className="text-xs font-semibold text-primary inline-flex items-center gap-1">
                      <BadgeCheck size={12} style={{ color: "var(--brand)" }} />
                      {plano.nome}
                    </span>
                  </div>
                )}
                {isAdmin && diasRestantes !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">{t("Dias restantes")}</span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: diasRestantes <= 7 ? "var(--warning)" : "var(--text-primary)" }}
                    >
                      {t("{n} dias", { n: diasRestantes })}
                    </span>
                  </div>
                )}
                {isAdmin && plano && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">{t("Contratos no mês")}</span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: contratosRestantes === 0 ? "var(--danger)" : "var(--text-primary)" }}
                    >
                      {contratosRestantes}/{limiteContratos}
                    </span>
                  </div>
                )}
                {workspace && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">{t("Conta")}</span>
                    <span className="text-xs text-secondary truncate max-w-[140px]">
                      {workspace.nome}
                    </span>
                  </div>
                )}
              </div>

              {/* Configurações — admin vê tudo; demais só "Minha conta" (Segurança). */}
              {onAbrirConfiguracoes && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onAbrirConfiguracoes();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-secondary hover:bg-elevated hover:text-primary transition-colors border-b border-border"
                >
                  <Settings size={15} />
                  {usuario?.papel === "admin" ? t("Configurações") : t("Minha conta")}
                </button>
              )}

              {/* Sair */}
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-secondary hover:bg-elevated hover:text-danger transition-colors"
              >
                <LogOut size={15} />
                {t("Sair da conta")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
