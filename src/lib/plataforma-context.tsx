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
import type { KpisPlataforma, ReceitaRealizada } from "./services/plataforma.service";
import type { CupomAdmin } from "./services/cupons.service";
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
  /** Receita REALIZADA (não projetada) — soma de `pagamentos` no período, por moeda. */
  receita: ReceitaRealizada | null;
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

  // Cupons — /api/admin/cupons
  cupons: CupomAdmin[];
  carregandoCupons: boolean;
  recarregarCupons: () => Promise<void>;
  criarCupom: (params: {
    codigo: string;
    planoAlvo: PlanoId;
    limiteUso: number;
    validade?: string | null;
  }) => Promise<void>;
  alterarCupom: (
    id: string,
    patch: { ativo?: boolean; limiteUso?: number; validade?: string | null }
  ) => Promise<void>;
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
  const [receita, setReceita] = useState<ReceitaRealizada | null>(null);

  const [usuarios, setUsuarios] = useState<UsuarioPlataforma[]>([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);

  const [kpis, setKpis] = useState<KpisPlataforma | null>(null);

  // Planos — catálogo TS (não migra pra banco nesta fatia)
  const [planos, setPlanos] = useState<Plano[]>(PLANOS);

  const [cupons, setCupons] = useState<CupomAdmin[]>([]);
  const [carregandoCupons, setCarregandoCupons] = useState(false);

  const recarregarAssinaturas = useCallback(async () => {
    setCarregandoAssinaturas(true);
    try {
      const res = await fetch("/api/admin/assinaturas", { credentials: "include" });
      const body = await jsonOuErro(res);
      setAssinaturas((body.assinaturas as Assinatura[]) ?? []);
      setReceita((body.receita as ReceitaRealizada) ?? null);
    } catch {
      setAssinaturas([]);
      setReceita(null);
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

  const recarregarCupons = useCallback(async () => {
    setCarregandoCupons(true);
    try {
      const res = await fetch("/api/admin/cupons", { credentials: "include" });
      const body = await jsonOuErro(res);
      setCupons((body.cupons as CupomAdmin[]) ?? []);
    } catch {
      setCupons([]);
    } finally {
      setCarregandoCupons(false);
    }
  }, []);

  useEffect(() => {
    void recarregarAssinaturas();
    void recarregarUsuarios();
    void recarregarKpis();
    void recarregarCupons();
  }, [recarregarAssinaturas, recarregarUsuarios, recarregarKpis, recarregarCupons]);

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

  const criarCupom = useCallback(
    async (params: {
      codigo: string;
      planoAlvo: PlanoId;
      limiteUso: number;
      validade?: string | null;
    }) => {
      const res = await fetch("/api/admin/cupons", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      await jsonOuErro(res);
      await recarregarCupons();
    },
    [recarregarCupons]
  );

  const alterarCupom = useCallback(
    async (
      id: string,
      patch: { ativo?: boolean; limiteUso?: number; validade?: string | null }
    ) => {
      const res = await fetch(`/api/admin/cupons/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await jsonOuErro(res);
      await recarregarCupons();
    },
    [recarregarCupons]
  );

  const value = useMemo<PlataformaContextValue>(
    () => ({
      assinaturas,
      carregandoAssinaturas,
      recarregarAssinaturas,
      receita,
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

      cupons,
      carregandoCupons,
      recarregarCupons,
      criarCupom,
      alterarCupom,
    }),
    [
      assinaturas,
      carregandoAssinaturas,
      recarregarAssinaturas,
      receita,
      alterarStatusAssinatura,
      alterarPlanoAssinatura,
      estenderDiasAssinatura,
      usuarios,
      carregandoUsuarios,
      recarregarUsuarios,
      alterarStatusUsuario,
      kpis,
      planos,
      cupons,
      carregandoCupons,
      recarregarCupons,
      criarCupom,
      alterarCupom,
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
