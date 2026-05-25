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
import type { DJ } from "@/types";
import type { Papel } from "./permissoes";
import { useAuth } from "./auth-context";

/**
 * Configurações do workspace (a agência) — módulo de Configurações do admin.
 *
 * Tudo (aparência, artistas, equipe) vem da API. Mutações são async.
 */

// ----------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------

export type Aparencia = {
  nomeAgencia: string;
  logoUrl: string | null;
};

export type ArtistaWS = DJ;

/** Papéis administrativos suportados na aba Equipe. */
export type PapelEquipe = Extract<Papel, "produtor" | "vendedor" | "financeiro">;

/** Flags de privacidade do usuário (escopo). */
export type EscopoUsuario = {
  verTodosContatos: boolean;
  verTodasVendas: boolean;
  editarTodosEventos: boolean;
};

export const ESCOPO_PADRAO: EscopoUsuario = {
  verTodosContatos: true,
  verTodasVendas: true,
  editarTodosEventos: true,
};

/**
 * Funções operacionais e DJs atendidos.
 * Vazio quando o usuário ainda não foi configurado.
 */
export type Funcoes = {
  vendedor?: string[];
  financeiro?: string[];
  produtor?: string[];
};

/**
 * Usuário da equipe.
 *
 * Cada usuário operacional pode acumular múltiplas FUNÇÕES (vendedor /
 * financeiro / produtor) e cada uma carrega sua própria lista de DJs
 * atendidos. O campo `papel` continua existindo como "função primária"
 * pra compatibilidade com policies e código legado.
 */
export type UsuarioEquipe = {
  id: string;
  nome: string;
  email: string;
  papel: PapelEquipe;
  escopo: EscopoUsuario;
  funcoes: Funcoes;
  ativo: boolean;
};

// ----------------------------------------------------------------
// Estado inicial
// ----------------------------------------------------------------

const APARENCIA_INICIAL: Aparencia = {
  nomeAgencia: "",
  logoUrl: null,
};

// ----------------------------------------------------------------
// Context
// ----------------------------------------------------------------

type ResultadoNovoUsuario = {
  usuario: UsuarioEquipe;
  senhaTemporaria: string;
};

export type ItemLixeiraArtista = {
  tipo: "artista";
  artista: ArtistaWS;
  deletadoEm: string;
  diasRestantes: number;
};

export type ItemLixeiraUsuario = {
  tipo: "usuario";
  usuario: UsuarioEquipe;
  deletadoEm: string;
  diasRestantes: number;
};

type WorkspaceContextValue = {
  // Aparência
  aparencia: Aparencia;
  carregandoAparencia: boolean;
  recarregarAparencia: () => Promise<void>;
  atualizarNomeAgencia: (nome: string) => Promise<void>;
  uploadLogo: (arquivo: File | Blob) => Promise<void>;
  removerLogo: () => Promise<void>;
  /** ISO timestamp da criação do workspace (null enquanto carrega/se anônimo). */
  workspaceCriadoEm: string | null;

  // Artistas
  artistas: ArtistaWS[];
  carregandoArtistas: boolean;
  erroArtistas: string | null;
  recarregarArtistas: () => Promise<void>;
  adicionarArtista: (nome: string, cor: string) => Promise<ArtistaWS>;
  removerArtista: (id: string) => Promise<void>;
  alternarSuspensaoArtista: (id: string) => Promise<void>;

  // Equipe
  equipe: UsuarioEquipe[];
  carregandoEquipe: boolean;
  erroEquipe: string | null;
  recarregarEquipe: () => Promise<void>;
  adicionarUsuario: (dados: {
    nome: string;
    email: string;
    papel: PapelEquipe;
    escopo: EscopoUsuario;
    funcoes: Funcoes;
  }) => Promise<ResultadoNovoUsuario>;
  atualizarUsuario: (
    id: string,
    patch: Partial<{
      nome: string;
      papel: PapelEquipe;
      escopo: EscopoUsuario;
      funcoes: Funcoes;
      ativo: boolean;
    }>
  ) => Promise<UsuarioEquipe>;
  removerUsuario: (id: string) => Promise<void>;
  resetarSenhaUsuario: (id: string) => Promise<string>;

  // Lixeira
  lixeiraArtistas: ItemLixeiraArtista[];
  lixeiraUsuarios: ItemLixeiraUsuario[];
  carregandoLixeira: boolean;
  recarregarLixeira: () => Promise<void>;
  restaurarDaLixeira: (tipo: "artista" | "usuario", id: string) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

async function jsonOuErro(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((body.erro as string) ?? `HTTP ${res.status}`);
  }
  return body;
}

type WorkspaceApi = { nomeAgencia: string; logoUrl: string | null; criadoEm: string | null };

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { sessao } = useAuth();

  const [aparencia, setAparencia] = useState<Aparencia>(APARENCIA_INICIAL);
  const [carregandoAparencia, setCarregandoAparencia] = useState(false);
  const [workspaceCriadoEm, setWorkspaceCriadoEm] = useState<string | null>(null);

  const [artistas, setArtistas] = useState<ArtistaWS[]>([]);
  const [carregandoArtistas, setCarregandoArtistas] = useState(false);
  const [erroArtistas, setErroArtistas] = useState<string | null>(null);

  const [equipe, setEquipe] = useState<UsuarioEquipe[]>([]);
  const [carregandoEquipe, setCarregandoEquipe] = useState(false);
  const [erroEquipe, setErroEquipe] = useState<string | null>(null);

  const [lixeiraArtistas, setLixeiraArtistas] = useState<ItemLixeiraArtista[]>([]);
  const [lixeiraUsuarios, setLixeiraUsuarios] = useState<ItemLixeiraUsuario[]>([]);
  const [carregandoLixeira, setCarregandoLixeira] = useState(false);

  // -------- Aparência --------

  const recarregarAparencia = useCallback(async () => {
    if (!sessao?.workspace) {
      setAparencia(APARENCIA_INICIAL);
      setWorkspaceCriadoEm(null);
      return;
    }
    setCarregandoAparencia(true);
    try {
      const res = await fetch("/api/workspace", { credentials: "include" });
      const body = await jsonOuErro(res);
      const ws = body.workspace as WorkspaceApi;
      setAparencia({ nomeAgencia: ws.nomeAgencia, logoUrl: ws.logoUrl });
      setWorkspaceCriadoEm(ws.criadoEm);
    } catch {
      setAparencia((prev) => ({
        ...prev,
        nomeAgencia: prev.nomeAgencia || sessao.workspace?.nome || "",
      }));
    } finally {
      setCarregandoAparencia(false);
    }
  }, [sessao?.workspace]);

  useEffect(() => {
    void recarregarAparencia();
  }, [recarregarAparencia]);

  const atualizarNomeAgencia = useCallback(async (nome: string) => {
    const res = await fetch("/api/workspace", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    const body = await jsonOuErro(res);
    const ws = body.workspace as WorkspaceApi;
    setAparencia({ nomeAgencia: ws.nomeAgencia, logoUrl: ws.logoUrl });
    setWorkspaceCriadoEm(ws.criadoEm);
  }, []);

  const uploadLogo = useCallback(async (arquivo: File | Blob) => {
    const form = new FormData();
    const file =
      arquivo instanceof File
        ? arquivo
        : new File([arquivo], "logo.png", { type: arquivo.type || "image/png" });
    form.append("file", file);
    const res = await fetch("/api/workspace/logo", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const body = await jsonOuErro(res);
    const ws = body.workspace as WorkspaceApi;
    setAparencia({ nomeAgencia: ws.nomeAgencia, logoUrl: ws.logoUrl });
  }, []);

  const removerLogo = useCallback(async () => {
    const res = await fetch("/api/workspace/logo", {
      method: "DELETE",
      credentials: "include",
    });
    const body = await jsonOuErro(res);
    const ws = body.workspace as WorkspaceApi;
    setAparencia({ nomeAgencia: ws.nomeAgencia, logoUrl: ws.logoUrl });
  }, []);

  // -------- Artistas --------

  const recarregarArtistas = useCallback(async () => {
    if (!sessao?.workspace) {
      setArtistas([]);
      return;
    }
    setCarregandoArtistas(true);
    setErroArtistas(null);
    try {
      const res = await fetch("/api/artistas", { credentials: "include" });
      const body = await jsonOuErro(res);
      setArtistas((body.artistas as ArtistaWS[]) ?? []);
    } catch (e) {
      setErroArtistas((e as Error).message);
      setArtistas([]);
    } finally {
      setCarregandoArtistas(false);
    }
  }, [sessao?.workspace]);

  useEffect(() => {
    void recarregarArtistas();
  }, [recarregarArtistas]);

  const adicionarArtista = useCallback(
    async (nome: string, cor: string): Promise<ArtistaWS> => {
      const res = await fetch("/api/artistas", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), cor }),
      });
      const body = await jsonOuErro(res);
      const novo = body.artista as ArtistaWS;
      setArtistas((prev) => [...prev, novo]);
      return novo;
    },
    []
  );

  const removerArtista = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/artistas/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await jsonOuErro(res);
    setArtistas((prev) => prev.filter((a) => a.id !== id));
    // Sincroniza a lixeira local — soft delete coloca o item nela agora.
    try {
      const lixRes = await fetch("/api/lixeira", { credentials: "include" });
      const body = await jsonOuErro(lixRes);
      setLixeiraArtistas((body.artistas as ItemLixeiraArtista[]) ?? []);
      setLixeiraUsuarios((body.usuarios as ItemLixeiraUsuario[]) ?? []);
    } catch {
      // não bloqueia o fluxo — a aba completa de Lixeira recarrega ao abrir
    }
  }, []);

  const alternarSuspensaoArtista = useCallback(
    async (id: string): Promise<void> => {
      const res = await fetch(`/api/artistas/${id}/suspender`, {
        method: "POST",
        credentials: "include",
      });
      const body = await jsonOuErro(res);
      const atual = body.artista as ArtistaWS;
      setArtistas((prev) => prev.map((a) => (a.id === id ? atual : a)));
    },
    []
  );

  // -------- Equipe --------

  const recarregarEquipe = useCallback(async () => {
    if (!sessao?.workspace) {
      setEquipe([]);
      return;
    }
    setCarregandoEquipe(true);
    setErroEquipe(null);
    try {
      const res = await fetch("/api/usuarios", { credentials: "include" });
      const body = await jsonOuErro(res);
      setEquipe((body.usuarios as UsuarioEquipe[]) ?? []);
    } catch (e) {
      setErroEquipe((e as Error).message);
      setEquipe([]);
    } finally {
      setCarregandoEquipe(false);
    }
  }, [sessao?.workspace]);

  useEffect(() => {
    void recarregarEquipe();
  }, [recarregarEquipe]);

  const adicionarUsuario = useCallback(
    async (dados: {
      nome: string;
      email: string;
      papel: PapelEquipe;
      escopo: EscopoUsuario;
      funcoes: Funcoes;
    }): Promise<ResultadoNovoUsuario> => {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
      const body = await jsonOuErro(res);
      const usuario = body.usuario as UsuarioEquipe;
      const senhaTemporaria = body.senhaTemporaria as string;
      setEquipe((prev) => [...prev, usuario]);
      return { usuario, senhaTemporaria };
    },
    []
  );

  const atualizarUsuario = useCallback(
    async (
      id: string,
      patch: Partial<{
        nome: string;
        papel: PapelEquipe;
        escopo: EscopoUsuario;
        funcoes: Funcoes;
        ativo: boolean;
      }>
    ): Promise<UsuarioEquipe> => {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await jsonOuErro(res);
      const atual = body.usuario as UsuarioEquipe;
      setEquipe((prev) => prev.map((u) => (u.id === id ? atual : u)));
      return atual;
    },
    []
  );

  const removerUsuario = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/usuarios/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    await jsonOuErro(res);
    setEquipe((prev) => prev.filter((u) => u.id !== id));
    // Sincroniza a lixeira (soft delete acabou de inserir aqui).
    try {
      const lixRes = await fetch("/api/lixeira", { credentials: "include" });
      const body = await jsonOuErro(lixRes);
      setLixeiraArtistas((body.artistas as ItemLixeiraArtista[]) ?? []);
      setLixeiraUsuarios((body.usuarios as ItemLixeiraUsuario[]) ?? []);
    } catch {
      // ignore
    }
  }, []);

  const resetarSenhaUsuario = useCallback(async (id: string): Promise<string> => {
    const res = await fetch(`/api/usuarios/${id}/resetar-senha`, {
      method: "POST",
      credentials: "include",
    });
    const body = await jsonOuErro(res);
    return body.senhaTemporaria as string;
  }, []);

  // -------- Lixeira --------

  const recarregarLixeira = useCallback(async () => {
    if (!sessao?.workspace) {
      setLixeiraArtistas([]);
      setLixeiraUsuarios([]);
      return;
    }
    setCarregandoLixeira(true);
    try {
      const res = await fetch("/api/lixeira", { credentials: "include" });
      const body = await jsonOuErro(res);
      setLixeiraArtistas((body.artistas as ItemLixeiraArtista[]) ?? []);
      setLixeiraUsuarios((body.usuarios as ItemLixeiraUsuario[]) ?? []);
    } catch {
      setLixeiraArtistas([]);
      setLixeiraUsuarios([]);
    } finally {
      setCarregandoLixeira(false);
    }
  }, [sessao?.workspace]);

  const restaurarDaLixeira = useCallback(
    async (tipo: "artista" | "usuario", id: string) => {
      const res = await fetch(`/api/lixeira/${tipo}/${id}/restaurar`, {
        method: "POST",
        credentials: "include",
      });
      await jsonOuErro(res);
      // Remove da lixeira local
      if (tipo === "artista") {
        setLixeiraArtistas((prev) => prev.filter((i) => i.artista.id !== id));
      } else {
        setLixeiraUsuarios((prev) => prev.filter((i) => i.usuario.id !== id));
      }
      // Recarrega listas ativas
      if (tipo === "artista") void recarregarArtistas();
      else void recarregarEquipe();
    },
    [recarregarArtistas, recarregarEquipe]
  );

  // Não há método "apagar definitivamente" cliente — a única remoção
  // permanente é via pg_cron 30 dias após o soft delete.

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      aparencia,
      carregandoAparencia,
      recarregarAparencia,
      atualizarNomeAgencia,
      uploadLogo,
      removerLogo,
      workspaceCriadoEm,

      artistas,
      carregandoArtistas,
      erroArtistas,
      recarregarArtistas,
      adicionarArtista,
      removerArtista,
      alternarSuspensaoArtista,

      equipe,
      carregandoEquipe,
      erroEquipe,
      recarregarEquipe,
      adicionarUsuario,
      atualizarUsuario,
      removerUsuario,
      resetarSenhaUsuario,

      lixeiraArtistas,
      lixeiraUsuarios,
      carregandoLixeira,
      recarregarLixeira,
      restaurarDaLixeira,
    }),
    [
      aparencia, carregandoAparencia, recarregarAparencia,
      atualizarNomeAgencia, uploadLogo, removerLogo, workspaceCriadoEm,
      artistas, carregandoArtistas, erroArtistas, recarregarArtistas,
      adicionarArtista, removerArtista, alternarSuspensaoArtista,
      equipe, carregandoEquipe, erroEquipe, recarregarEquipe,
      adicionarUsuario, atualizarUsuario, removerUsuario, resetarSenhaUsuario,
      lixeiraArtistas, lixeiraUsuarios, carregandoLixeira,
      recarregarLixeira, restaurarDaLixeira,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error("useWorkspace deve ser usado dentro de <WorkspaceProvider>");
  return ctx;
}

export function useArtistas(): DJ[] {
  return useWorkspace().artistas;
}

export const LABELS_PAPEL_EQUIPE: Record<
  PapelEquipe,
  { nome: string; descricao: string; cor: string }
> = {
  produtor: {
    nome: "Produtor",
    descricao: "Cuida da logística e operação dos shows",
    cor: "#f59e0b",
  },
  vendedor: {
    nome: "Vendedor",
    descricao: "Cria orçamentos e fecha vendas",
    cor: "#22c55e",
  },
  financeiro: {
    nome: "Financeiro",
    descricao: "Acompanha pagamentos e recebimentos",
    cor: "#3b82f6",
  },
};

export type { Papel };
