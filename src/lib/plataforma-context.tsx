"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  type Assinatura,
  type StatusAssinatura,
  type UsuarioPlataforma,
  type StatusUsuario,
} from "./plataforma";
import type { KpisPlataforma } from "./services/plataforma.service";
import { PLANOS, type Plano, type PlanoId } from "./planos";

/**
 * Estado da plataforma — usado pelo painel super-admin.
 *
 * Lê de /api/admin/*. Os planos seguem como constante TS (catálogo
 * raramente muda; CRUD de planos em produção seria fatia futura).
 */

type PlataformaContextValue = {
  // Assinaturas
  assinaturas: Assinatura[];
  carregandoAssinaturas: boolean;
  recarregarAssinaturas: () => Promise<void>;
  alterarStatusAssinatura: (
    workspaceId: string,
    status: StatusAssinatura
  ) => Promise<void>;
  alterarPlanoAssinatura: (
    workspaceId: string,
    plano: PlanoId
  ) => Promise<void>;
  estenderDiasAssinatura: (workspaceId: string, dias: number) => Promise<void>;

  // Usuários
  usuarios: UsuarioPlataforma[];
  carregandoUsuarios: boolean;
  recarregarUsuarios: () => Promise<void>;
  alterarStatusUsuario: (
    usuarioId: string,
    status: StatusUsuario
  ) => Promise<void>;

  // KPIs reais da plataforma (dashboard) — /api/admin/kpis
  kpis: KpisPlataforma | null;

  // Planos — leitura de constante; mutação só localmente
  planos: Plano[];
  atualizarPlano: (id: PlanoId, patch: Partial<Plano>) => void;
};

const PlataformaContext = createContext<PlataformaContextValue | null>(null);

async function jsonOuErro(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((body.erro as string) ?? `HTTP ${res.status}`);
  }
  return body;
}

export function PlataformaProvider({ children }: { children: ReactNode }) {
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [carregandoAssinaturas, setCarregandoAssinaturas] = useState(false);

  const [usuarios, setUsuarios] = useState<UsuarioPlataforma[]>([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);

  const [kpis, setKpis] = useState<KpisPlataforma | null>(null);

  // Planos — catálogo TS (não migra pra banco nesta fatia)
  const [planos, setPlanos] = useState<Plano[]>(PLANOS);

  const recarregarAssinaturas = useCallback(async () => {
    setCarregandoAssinaturas(true);
    try {
      const res = await fetch("/api/admin/assinaturas", { credentials: "include" });
      const body = await jsonOuErro(res);
      setAssinaturas((body.assinaturas as Assinatura[]) ?? []);
    } catch {
      setAssinaturas([]);
    } finally {
      setCarregandoAssinaturas(false);
    }
  }, []);

  const recarregarUsuarios = useCallback(async () => {
    setCarregandoUsuarios(true);
    try {
      const res = await fetch("/api/admin/usuarios", { credentials: "include" });
      const body = await jsonOuErro(res);
      setUsuarios((body.usuarios as UsuarioPlataforma[]) ?? []);
    } catch {
      setUsuarios([]);
    } finally {
      setCarregandoUsuarios(false);
    }
  }, []);

  const recarregarKpis = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/kpis", { credentials: "include" });
      const body = await jsonOuErro(res);
      setKpis((body.kpis as KpisPlataforma) ?? null);
    } catch {
      setKpis(null);
    }
  }, []);

  useEffect(() => {
    void recarregarAssinaturas();
    void recarregarUsuarios();
    void recarregarKpis();
  }, [recarregarAssinaturas, recarregarUsuarios, recarregarKpis]);

  const alterarStatusAssinatura = useCallback(
    async (workspaceId: string, status: StatusAssinatura) => {
      const res = await fetch(`/api/admin/assinaturas/${workspaceId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await jsonOuErro(res);
      // Status afeta dias/próximo pagamento — recarrega pra refletir o real.
      await recarregarAssinaturas();
    },
    [recarregarAssinaturas]
  );

  const alterarPlanoAssinatura = useCallback(
    async (workspaceId: string, plano: PlanoId) => {
      const res = await fetch(`/api/admin/assinaturas/${workspaceId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano }),
      });
      await jsonOuErro(res);
      setAssinaturas((prev) =>
        prev.map((a) => (a.workspaceId === workspaceId ? { ...a, plano } : a))
      );
    },
    []
  );

  const estenderDiasAssinatura = useCallback(
    async (workspaceId: string, dias: number) => {
      const res = await fetch(`/api/admin/assinaturas/${workspaceId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dias }),
      });
      await jsonOuErro(res);
      await recarregarAssinaturas();
    },
    [recarregarAssinaturas]
  );

  const alterarStatusUsuario = useCallback(
    async (usuarioId: string, status: StatusUsuario) => {
      const res = await fetch(`/api/admin/usuarios/${usuarioId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await jsonOuErro(res);
      setUsuarios((prev) =>
        prev.map((u) => (u.id === usuarioId ? { ...u, status } : u))
      );
    },
    []
  );

  const value = useMemo<PlataformaContextValue>(
    () => ({
      assinaturas,
      carregandoAssinaturas,
      recarregarAssinaturas,
      alterarStatusAssinatura,
      alterarPlanoAssinatura,
      estenderDiasAssinatura,

      usuarios,
      carregandoUsuarios,
      recarregarUsuarios,
      alterarStatusUsuario,

      kpis,

      planos,
      atualizarPlano: (id, patch) =>
        setPlanos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    }),
    [
      assinaturas,
      carregandoAssinaturas,
      recarregarAssinaturas,
      alterarStatusAssinatura,
      alterarPlanoAssinatura,
      estenderDiasAssinatura,
      usuarios,
      carregandoUsuarios,
      recarregarUsuarios,
      alterarStatusUsuario,
      kpis,
      planos,
    ]
  );

  return (
    <PlataformaContext.Provider value={value}>{children}</PlataformaContext.Provider>
  );
}

export function usePlataforma() {
  const ctx = useContext(PlataformaContext);
  if (!ctx)
    throw new Error("usePlataforma deve ser usado dentro de <PlataformaProvider>");
  return ctx;
}
