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
import type { HistoricoAcao } from "./mappers/historico";
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

type ItemLixeiraBase = {
  deletadoEm: string;
  diasRestantes: number;
};

export type ItemLixeiraArtista = ItemLixeiraBase & {
  tipo: "artista";
  artista: ArtistaWS;
};

export type ItemLixeiraUsuario = ItemLixeiraBase & {
  tipo: "usuario";
  usuario: UsuarioEquipe;
};

export type ItemLixeiraOrcamento = ItemLixeiraBase & {
  tipo: "orcamento";
  orcamento: import("@/types").Orcamento;
};

export type ItemLixeiraVenda = ItemLixeiraBase & {
  tipo: "venda";
  venda: import("@/types").Venda;
};

export type ItemLixeiraContratante = ItemLixeiraBase & {
  tipo: "contratante";
  contratante: import("@/types").Contratante;
};

export type ItemLixeiraCasa = ItemLixeiraBase & {
  tipo: "casa";
  casa: import("@/types").Casa;
};

export type ItemLixeiraCidade = ItemLixeiraBase & {
  tipo: "cidade";
  cidade: import("@/types").Cidade;
};

export type TipoLixeira =
  | "artista"
  | "usuario"
  | "orcamento"
  | "venda"
  | "contratante"
  | "casa"
  | "cidade";

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
  lixeiraOrcamentos: ItemLixeiraOrcamento[];
  lixeiraVendas: ItemLixeiraVenda[];
  lixeiraContratantes: ItemLixeiraContratante[];
  lixeiraCasas: ItemLixeiraCasa[];
  lixeiraCidades: ItemLixeiraCidade[];
  carregandoLixeira: boolean;
  recarregarLixeira: () => Promise<void>;
  restaurarDaLixeira: (tipo: TipoLixeira, id: string) => Promise<void>;

  // Histórico
  carregarHistorico: (filtros?: {
    modulo?: string;
    actor?: string;
    periodo?: "24h" | "7d" | "30d";
    limit?: number;
    offset?: number;
  }) => Promise<HistoricoAcao[]>;
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
  const [lixeiraOrcamentos, setLixeiraOrcamentos] = useState<ItemLixeiraOrcamento[]>([]);
  const [lixeiraVendas, setLixeiraVendas] = useState<ItemLixeiraVenda[]>([]);
  const [lixeiraContratantes, setLixeiraContratantes] = useState<ItemLixeiraContratante[]>([]);
  const [lixeiraCasas, setLixeiraCasas] = useState<ItemLixeiraCasa[]>([]);
  const [lixeiraCidades, setLixeiraCidades] = useState<ItemLixeiraCidade[]>([]);
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
      setLixeiraOrcamentos([]);
      setLixeiraVendas([]);
      setLixeiraContratantes([]);
      setLixeiraCasas([]);
      setLixeiraCidades([]);
      return;
    }
    setCarregandoLixeira(true);
    try {
      const res = await fetch("/api/lixeira", { credentials: "include" });
      const body = await jsonOuErro(res);
      setLixeiraArtistas((body.artistas as ItemLixeiraArtista[]) ?? []);
      setLixeiraUsuarios((body.usuarios as ItemLixeiraUsuario[]) ?? []);
      setLixeiraOrcamentos((body.orcamentos as ItemLixeiraOrcamento[]) ?? []);
      setLixeiraVendas((body.vendas as ItemLixeiraVenda[]) ?? []);
      setLixeiraContratantes((body.contratantes as ItemLixeiraContratante[]) ?? []);
      setLixeiraCasas((body.casas as ItemLixeiraCasa[]) ?? []);
      setLixeiraCidades((body.cidades as ItemLixeiraCidade[]) ?? []);
    } catch {
      setLixeiraArtistas([]);
      setLixeiraUsuarios([]);
      setLixeiraOrcamentos([]);
      setLixeiraVendas([]);
      setLixeiraContratantes([]);
      setLixeiraCasas([]);
      setLixeiraCidades([]);
    } finally {
      setCarregandoLixeira(false);
    }
  }, [sessao?.workspace]);

  const restaurarDaLixeira = useCallback(
    async (tipo: TipoLixeira, id: string) => {
      const res = await fetch(`/api/lixeira/${tipo}/${id}/restaurar`, {
        method: "POST",
        credentials: "include",
      });
      await jsonOuErro(res);
      // Remove da lixeira local (atualização otimista)
      switch (tipo) {
        case "artista":
          setLixeiraArtistas((p) => p.filter((i) => i.artista.id !== id));
          void recarregarArtistas();
          break;
        case "usuario":
          setLixeiraUsuarios((p) => p.filter((i) => i.usuario.id !== id));
          void recarregarEquipe();
          break;
        case "orcamento":
          setLixeiraOrcamentos((p) => p.filter((i) => i.orcamento.id !== id));
          break;
        case "venda":
          setLixeiraVendas((p) => p.filter((i) => i.venda.id !== id));
          break;
        case "contratante":
          setLixeiraContratantes((p) => p.filter((i) => i.contratante.id !== id));
          break;
        case "casa":
          setLixeiraCasas((p) => p.filter((i) => i.casa.id !== id));
          break;
        case "cidade":
          setLixeiraCidades((p) => p.filter((i) => i.cidade.id !== id));
          break;
      }
      // Listas ativas de orçamentos/vendas/contatos recarregam quando o
      // usuário voltar para a respectiva tela (useEffect on-mount dos
      // contexts daqueles módulos).
    },
    [recarregarArtistas, recarregarEquipe]
  );

  // Não há método "apagar definitivamente" cliente — a única remoção
  // permanente é via pg_cron 30 dias após o soft delete.

  // -------- Histórico --------

  const carregarHistorico = useCallback(
    async (filtros?: {
      modulo?: string;
      actor?: string;
      periodo?: "24h" | "7d" | "30d";
      limit?: number;
      offset?: number;
    }): Promise<HistoricoAcao[]> => {
      const qs = new URLSearchParams();
      if (filtros?.modulo) qs.set("modulo", filtros.modulo);
      if (filtros?.actor) qs.set("actor", filtros.actor);
      if (filtros?.periodo) qs.set("periodo", filtros.periodo);
      if (filtros?.limit !== undefined) qs.set("limit", String(filtros.limit));
      if (filtros?.offset !== undefined) qs.set("offset", String(filtros.offset));
      const url = `/api/historico${qs.size > 0 ? `?${qs.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      const body = await jsonOuErro(res);
      return (body.historico as HistoricoAcao[]) ?? [];
    },
    []
  );

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
      lixeiraOrcamentos,
      lixeiraVendas,
      lixeiraContratantes,
      lixeiraCasas,
      lixeiraCidades,
      carregandoLixeira,
      recarregarLixeira,
      restaurarDaLixeira,

      carregarHistorico,
    }),
    [
      aparencia, carregandoAparencia, recarregarAparencia,
      atualizarNomeAgencia, uploadLogo, removerLogo, workspaceCriadoEm,
      artistas, carregandoArtistas, erroArtistas, recarregarArtistas,
      adicionarArtista, removerArtista, alternarSuspensaoArtista,
      equipe, carregandoEquipe, erroEquipe, recarregarEquipe,
      adicionarUsuario, atualizarUsuario, removerUsuario, resetarSenhaUsuario,
      lixeiraArtistas, lixeiraUsuarios,
      lixeiraOrcamentos, lixeiraVendas,
      lixeiraContratantes, lixeiraCasas, lixeiraCidades,
      carregandoLixeira, recarregarLixeira, restaurarDaLixeira,
      carregarHistorico,
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
