"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Layers,
  CreditCard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { PlataformaProvider } from "@/lib/plataforma-context";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminClientes from "@/components/admin/AdminClientes";
import AdminPlanos from "@/components/admin/AdminPlanos";
import AdminAssinaturas from "@/components/admin/AdminAssinaturas";

type SecaoAdmin = "dashboard" | "clientes" | "planos" | "assinaturas";

const SECOES: Array<{
  id: SecaoAdmin;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "assinaturas", label: "Assinaturas", icon: CreditCard },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "planos", label: "Planos", icon: Layers },
];

export default function AdminPage() {
  return (
    <AuthProvider>
      <PlataformaProvider>
        <AdminGuard>
          <AdminShell />
        </AdminGuard>
      </PlataformaProvider>
    </AuthProvider>
  );
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { sessao, carregando, isSuperAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (carregando) return;
    if (!sessao) router.replace("/login");
    else if (!isSuperAdmin) router.replace("/app");
  }, [carregando, sessao, isSuperAdmin, router]);

  if (carregando || !sessao || !isSuperAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-main">
        <div className="text-sm text-muted">Carregando…</div>
      </div>
    );
  }
  return <>{children}</>;
}

function AdminShell() {
  const { logout } = useAuth();
  const [secao, setSecao] = useState<SecaoAdmin>("dashboard");
  const [menuMobile, setMenuMobile] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuMobile ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuMobile]);

  return (
    <div className="flex h-screen overflow-hidden bg-main text-primary">
      {/* Overlay mobile */}
      {menuMobile && (
        <button
          aria-label="Fechar menu"
          onClick={() => setMenuMobile(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed lg:static z-40 h-full w-60 bg-surface border-r border-border flex flex-col transition-transform ${
          menuMobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between gap-2 px-4 h-16 border-b border-border">
          <div className="flex items-center gap-2">
            <div
              className="rounded-md flex items-center justify-center font-bold text-white h-7 w-7 text-sm"
              style={{ backgroundColor: "var(--module-vendas)" }}
            >
              G
            </div>
            <div>
              <div className="font-bold tracking-tight text-sm leading-tight">
                GIGS<span className="text-muted"> CONTROL</span>
              </div>
              <div className="text-[0.6rem] text-muted uppercase tracking-wider">
                Plataforma
              </div>
            </div>
          </div>
          <button
            onClick={() => setMenuMobile(false)}
            className="lg:hidden btn-ghost p-1.5 rounded"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {SECOES.map((s) => {
            const Icon = s.icon;
            const ativo = secao === s.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setSecao(s.id);
                  setMenuMobile(false);
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left"
                style={{
                  backgroundColor: ativo ? "var(--bg-elevated)" : "transparent",
                  color: ativo ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: ativo ? 600 : 400,
                  borderLeft: ativo
                    ? "2px solid var(--module-vendas)"
                    : "2px solid transparent",
                }}
              >
                <Icon
                  size={16}
                  style={{ color: ativo ? "var(--module-vendas)" : undefined }}
                />
                {s.label}
              </button>
            );
          })}
        </nav>

        {/* Rodapé — sair */}
        <div className="p-3 border-t border-border">
          <button
            onClick={logout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm w-full transition-colors text-secondary hover:text-danger hover:bg-elevated"
          >
            <LogOut size={16} />
            Sair da plataforma
          </button>
        </div>
      </aside>

      {/* CONTEÚDO */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar mobile */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-main flex-shrink-0">
          <button
            onClick={() => setMenuMobile(true)}
            className="btn-ghost p-2 rounded"
          >
            <Menu size={18} />
          </button>
          <span className="font-semibold text-sm">Painel da Plataforma</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-[1400px] mx-auto">
            {secao === "dashboard" && <AdminDashboard />}
            {secao === "assinaturas" && <AdminAssinaturas />}
            {secao === "clientes" && <AdminClientes />}
            {secao === "planos" && <AdminPlanos />}
          </div>
        </main>
      </div>
    </div>
  );
}
