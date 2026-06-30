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
import type { DJ, TaxaAgenciaModo, DocumentoTipo } from "@/types";
import type { Papel, PrivacidadeDj } from "./permissoes";
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

/** Payload do form de novo artista (mandado pra /api/artistas POST). */
export type NovoArtistaInput = {
  nome: string;
  cor?: string;
  /** Parte do username digitada pelo admin — o backend concatena o slug. */
  usernameRaiz: string;
  /** Cidade onde reside (do catálogo IBGE). */
  cidadeIbgeId?: string;
  cidadeNome?: string;
  cidadeUf?: string;
  /** Dados do CONTRATADO (para contratos). */
  nomeLegal?: string;
  documento?: string;
  documentoTipo?: DocumentoTipo;
  razaoSocial?: string;
  endereco?: string;
  telefone?: string;
  /** Taxa de agência. */
  taxaModo?: TaxaAgenciaModo;
  taxaValor?: number;
  /** Rider salvo no artista — só nomes. Quantidade vai no orçamento. */
  riderCamarim?: string[];
  riderEfeitos?: string[];
  riderTecnico?: string[];
  /** Privacidade do DJ — gravada direto no jsonb artists.privacidade. */
  privacidade?: PrivacidadeDj;
  /** Só usado em PATCH — admin pode sobrescrever o email da conta auth. */
  emailConta?: string;
};

export type NovoArtistaResultado = {
  artista: ArtistaWS;
  senhaTemporaria: string;
  usernameCompleto: string;
};

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
  /**
   * Handle de login "raiz-slug". Membros novos nascem com ele; membros
   * antigos (criados por e-mail) têm `null` e logam pelo e-mail real.
   */
  username: string | null;
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

export type ItemLixeiraShow = ItemLixeiraBase & {
  tipo: "show";
  show: import("@/types").Show;
};

export type TipoLixeira =
  | "artista"
  | "usuario"
  | "orcamento"
  | "venda"
  | "contratante"
  | "casa"
  | "cidade"
  | "show";

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
  adicionarArtista: (input: NovoArtistaInput) => Promise<NovoArtistaResultado>;
  atualizarArtista: (id: string, patch: Partial<NovoArtistaInput>) => Promise<ArtistaWS>;
  reordenarArtistas: (idsNaOrdem: string[]) => Promise<void>;
  removerArtista: (id: string) => Promise<void>;
  alternarSuspensaoArtista: (id: string) => Promise<void>;
  resetarSenhaArtista: (id: string) => Promise<string>;

  // Equipe
  equipe: UsuarioEquipe[];
  carregandoEquipe: boolean;
  erroEquipe: string | null;
  recarregarEquipe: () => Promise<void>;
  adicionarUsuario: (dados: {
    nome: string;
    /** Parte do username digitada pelo admin — o backend concatena o slug. */
    username_raiz: string;
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
  lixeiraShows: ItemLixeiraShow[];
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
  const [lixeiraShows, setLixeiraShows] = useState<ItemLixeiraShow[]>([]);
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
    async (input: NovoArtistaInput): Promise<NovoArtistaResultado> => {
      const payload: Record<string, unknown> = {
        nome: input.nome.trim(),
        username_raiz: input.usernameRaiz.trim().toLowerCase(),
      };
      if (input.cor) payload.cor = input.cor;
      if (input.cidadeIbgeId) payload.cidade_ibge_id = input.cidadeIbgeId;
      if (input.cidadeNome) payload.cidade_nome = input.cidadeNome;
      if (input.cidadeUf) payload.cidade_uf = input.cidadeUf;
      if (input.nomeLegal) payload.nome_legal = input.nomeLegal;
      if (input.documento) payload.documento = input.documento;
      if (input.documentoTipo) payload.documento_tipo = input.documentoTipo;
      if (input.razaoSocial) payload.razao_social = input.razaoSocial;
      if (input.endereco) payload.endereco = input.endereco;
      if (input.telefone) payload.telefone = input.telefone;
      if (input.taxaModo) payload.taxa_modo = input.taxaModo;
      if (input.taxaValor !== undefined) payload.taxa_valor = input.taxaValor;
      if (input.riderCamarim) payload.rider_camarim = input.riderCamarim;
      if (input.riderEfeitos) payload.rider_efeitos = input.riderEfeitos;
      if (input.riderTecnico) payload.rider_tecnico = input.riderTecnico;
      if (input.privacidade !== undefined) payload.privacidade = input.privacidade;

      const res = await fetch("/api/artistas", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await jsonOuErro(res);
      const novo = body.artista as ArtistaWS;
      setArtistas((prev) => [...prev, novo]);
      return {
        artista: novo,
        senhaTemporaria: body.senhaTemporaria as string,
        usernameCompleto: body.usernameCompleto as string,
      };
    },
    []
  );

  const atualizarArtista = useCallback(
    async (id: string, patch: Partial<NovoArtistaInput>): Promise<ArtistaWS> => {
      const payload: Record<string, unknown> = {};
      if (patch.nome !== undefined) payload.nome = patch.nome.trim();
      if (patch.cor !== undefined) payload.cor = patch.cor;
      if (patch.usernameRaiz !== undefined)
        payload.username_raiz = patch.usernameRaiz.trim().toLowerCase();
      if (patch.emailConta !== undefined) payload.email_conta = patch.emailConta.trim();
      if (patch.cidadeIbgeId !== undefined) payload.cidade_ibge_id = patch.cidadeIbgeId;
      if (patch.cidadeNome !== undefined) payload.cidade_nome = patch.cidadeNome;
      if (patch.cidadeUf !== undefined) payload.cidade_uf = patch.cidadeUf;
      if (patch.nomeLegal !== undefined) payload.nome_legal = patch.nomeLegal;
      if (patch.documento !== undefined) payload.documento = patch.documento;
      if (patch.documentoTipo !== undefined)
        payload.documento_tipo = patch.documentoTipo;
      if (patch.razaoSocial !== undefined) payload.razao_social = patch.razaoSocial;
      if (patch.endereco !== undefined) payload.endereco = patch.endereco;
      if (patch.telefone !== undefined) payload.telefone = patch.telefone;
      if (patch.taxaModo !== undefined) payload.taxa_modo = patch.taxaModo;
      if (patch.taxaValor !== undefined) payload.taxa_valor = patch.taxaValor;
      if (patch.riderCamarim !== undefined) payload.rider_camarim = patch.riderCamarim;
      if (patch.riderEfeitos !== undefined) payload.rider_efeitos = patch.riderEfeitos;
      if (patch.riderTecnico !== undefined) payload.rider_tecnico = patch.riderTecnico;
      if (patch.privacidade !== undefined) payload.privacidade = patch.privacidade;

      const res = await fetch(`/api/artistas/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await jsonOuErro(res);
      const atualizado = body.artista as ArtistaWS;
      setArtistas((prev) => prev.map((a) => (a.id === id ? atualizado : a)));
      return atualizado;
    },
    []
  );

  const resetarSenhaArtista = useCallback(async (id: string): Promise<string> => {
    const res = await fetch(`/api/artistas/${id}/resetar-senha`, {
      method: "POST",
      credentials: "include",
    });
    const body = await jsonOuErro(res);
    return body.senhaTemporaria as string;
  }, []);

  /**
   * Reordena os artistas — UI otimista. Atualiza local primeiro,
   * dispara API. Se a API falhar, recarrega o estado correto do banco
   * e mostra o erro pro caller.
   */
  const reordenarArtistas = useCallback(
    async (idsNaOrdem: string[]): Promise<void> => {
      // Snapshot pra rollback se a API falhar
      const anterior = artistas;
      // Aplica a nova ordem localmente (otimista)
      const mapa = new Map(artistas.map((a) => [a.id, a]));
      const nova = idsNaOrdem
        .map((id) => mapa.get(id))
        .filter((a): a is ArtistaWS => !!a);
      setArtistas(nova);

      try {
        const res = await fetch("/api/artistas/reordenar", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: idsNaOrdem }),
        });
        await jsonOuErro(res);
      } catch (e) {
        // Rollback no front
        setArtistas(anterior);
        throw e;
      }
    },
    [artistas]
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
      username_raiz: string;
      papel: PapelEquipe;
      escopo: EscopoUsuario;
      funcoes: Funcoes;
    }): Promise<ResultadoNovoUsuario> => {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...dados,
          username_raiz: dados.username_raiz.trim().toLowerCase(),
        }),
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
      setLixeiraShows([]);
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
      setLixeiraShows((body.shows as ItemLixeiraShow[]) ?? []);
    } catch {
      setLixeiraArtistas([]);
      setLixeiraUsuarios([]);
      setLixeiraOrcamentos([]);
      setLixeiraVendas([]);
      setLixeiraContratantes([]);
      setLixeiraCasas([]);
      setLixeiraCidades([]);
      setLixeiraShows([]);
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
        case "show":
          setLixeiraShows((p) => p.filter((i) => i.show.id !== id));
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
      atualizarArtista,
      reordenarArtistas,
      removerArtista,
      alternarSuspensaoArtista,
      resetarSenhaArtista,

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
      lixeiraShows,
      carregandoLixeira,
      recarregarLixeira,
      restaurarDaLixeira,

      carregarHistorico,
    }),
    [
      aparencia, carregandoAparencia, recarregarAparencia,
      atualizarNomeAgencia, uploadLogo, removerLogo, workspaceCriadoEm,
      artistas, carregandoArtistas, erroArtistas, recarregarArtistas,
      adicionarArtista, atualizarArtista, reordenarArtistas, removerArtista,
      alternarSuspensaoArtista, resetarSenhaArtista,
      equipe, carregandoEquipe, erroEquipe, recarregarEquipe,
      adicionarUsuario, atualizarUsuario, removerUsuario, resetarSenhaUsuario,
      lixeiraArtistas, lixeiraUsuarios,
      lixeiraOrcamentos, lixeiraVendas,
      lixeiraContratantes, lixeiraCasas, lixeiraCidades, lixeiraShows,
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
