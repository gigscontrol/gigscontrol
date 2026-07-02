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
  calcularPermissoes,
  type Usuario,
  type Workspace,
  type Permissoes,
  type Papel,
} from "./permissoes";
import { DEFAULT_SELECTED_DJ_IDS } from "./djs";
import { criarClienteBrowser } from "./db/supabase-browser";
import { pode as motorPode, type CtxPermissao } from "./permissoes/resolver";

/**
 * Camada de autenticação do GIGS CONTROL — ligada ao Supabase Auth.
 *
 * Dois tipos de acesso:
 *  1. CLIENTE      — dono/usuário de um workspace (uma agência).
 *  2. SUPER-ADMIN  — administrador da plataforma GIGS CONTROL.
 *
 * O Supabase Auth cuida de senha e sessão (cookies). Os dados de papel
 * e workspace vêm da tabela `profiles`.
 */

export type TipoConta = "cliente" | "super-admin";

export type Sessao = {
  tipo: TipoConta;
  /** Dados do usuário (sempre presente) */
  usuario: Usuario;
  /** Workspace ativo. Para super-admin, só existe quando ele "entra" num workspace. */
  workspace: Workspace | null;
  /**
   * Permissões por artista (novo modelo — tabela membros_artista):
   * artist_id → chaves de permissão concedidas. Vazio para admin/artista/
   * super-admin (resolvidos pelo papel no motor).
   */
  vinculos?: Record<string, string[]>;
  /**
   * Quando true, o super-admin está visualizando a dashboard de um cliente
   * em modo somente-leitura — nenhuma ação de escrita é permitida.
   */
  modoVisitante?: boolean;
};

type AuthContextValue = {
  sessao: Sessao | null;
  carregando: boolean;
  permissoes: Permissoes | null;
  /** true quando o usuário logado é o super-admin da plataforma */
  isSuperAdmin: boolean;
  /** true quando o super-admin está visualizando a dashboard de um cliente */
  modoVisitante: boolean;
  login: (
    email: string,
    senha: string
  ) => Promise<{ ok: boolean; erro?: string; tipo?: TipoConta }>;
  logout: () => Promise<void>;
  /** Super-admin entra na dashboard de um cliente em modo somente-leitura */
  entrarComoVisitante: (ws: Workspace) => void;
  /** Super-admin sai do modo visitante e volta ao painel da plataforma */
  sairDoModoVisitante: () => void;
  /**
   * Motor de permissões no cliente: o usuário pode `chave` no `artistaId`?
   * (Novo modelo por-artista. Ainda NÃO consumido pelos componentes legados —
   * disponível pra UI nova; hoje os componentes usam `permissoes`.)
   */
  pode: (artistaId: string | null, chave: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Linha da tabela `profiles` no banco.
 */
type ProfileRow = {
  id: string;
  workspace_id: string | null;
  nome: string;
  email: string;
  papel: Papel;
  is_super_admin: boolean;
  artista_id: string | null;
  escopo_vendedor: Usuario["escopoVendedor"] | null;
  status: string;
  deletado_em: string | null;
};

type WorkspaceRow = {
  id: string;
  nome: string;
  plano: string;
  slug: string | null;
  criado_em: string;
};

/** Chave usada só para lembrar o modo-visitante entre navegações. */
const STORAGE_VISITANTE = "gigscontrol.visitante";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [carregando, setCarregando] = useState(true);

  const supabase = useMemo(() => criarClienteBrowser(), []);

  /**
   * Monta o objeto Sessao a partir do usuário autenticado:
   * busca o profile e (se houver) o workspace.
   */
  const montarSessao = useCallback(
    async (userId: string): Promise<Sessao | null> => {
      // Busca o profile
      const { data: profile, error: errProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single<ProfileRow>();

      if (errProfile || !profile) return null;

      // Profile na lixeira: trata como deletado (não permite login).
      if (profile.deletado_em) return null;

      const usuario: Usuario = {
        id: profile.id,
        nome: profile.nome,
        email: profile.email,
        papel: profile.papel,
        ativo: profile.status === "ativo",
        // artista_id no banco é uuid (string); o tipo legado usa number.
        // Mantido opcional aqui — será unificado quando os IDs do projeto
        // migrarem para uuid (fase futura). Por ora não é usado para o
        // super-admin nem para o admin de workspace.
        artistaId: profile.artista_id
          ? (profile.artista_id as unknown as Usuario["artistaId"])
          : undefined,
        escopoVendedor: profile.escopo_vendedor ?? undefined,
        criadoEm: "",
      };

      const tipo: TipoConta = profile.is_super_admin
        ? "super-admin"
        : "cliente";

      // Cliente: carrega o workspace dele. Super-admin: workspace nulo.
      let workspace: Workspace | null = null;
      if (!profile.is_super_admin && profile.workspace_id) {
        const { data: ws } = await supabase
          .from("workspaces")
          .select("id, nome, plano, slug, criado_em")
          .eq("id", profile.workspace_id)
          .single<WorkspaceRow>();
        if (ws) {
          workspace = {
            id: ws.id,
            nome: ws.nome,
            plano: ws.plano as Workspace["plano"],
            slug: ws.slug ?? "",
            criadoEm: ws.criado_em,
          };
        }
      }

      // Vínculos por artista (novo modelo de permissões). Só operacionais
      // precisam carregar — admin/artista/super são resolvidos pelo papel.
      const vinculos: Record<string, string[]> = {};
      if (
        !profile.is_super_admin &&
        profile.workspace_id &&
        profile.papel !== "admin" &&
        profile.papel !== "artista"
      ) {
        const { data: vinc } = await supabase
          .from("membros_artista")
          .select("artist_id, permissoes")
          .eq("user_id", profile.id)
          .is("deletado_em", null);
        for (const v of vinc ?? []) {
          const perms = (v as { permissoes?: unknown }).permissoes;
          vinculos[(v as { artist_id: string }).artist_id] = Array.isArray(perms)
            ? (perms.filter((x) => typeof x === "string") as string[])
            : [];
        }
      }

      return { tipo, usuario, workspace, vinculos };
    },
    [supabase]
  );

  // Carga inicial — recupera a sessão do Supabase (se houver)
  useEffect(() => {
    let ativo = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (ativo && session?.user) {
        const s = await montarSessao(session.user.id);
        if (ativo) setSessao(s);
      }
      if (ativo) setCarregando(false);
    })();

    // Reage a login/logout em outras abas ou expiração de sessão
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!session?.user) {
        setSessao(null);
        try {
          sessionStorage.removeItem(STORAGE_VISITANTE);
        } catch {
          // ignore
        }
      }
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, [supabase, montarSessao]);

  const permissoes = useMemo<Permissoes | null>(() => {
    if (!sessao) return null;
    if (sessao.tipo === "super-admin" && !sessao.workspace) return null;
    return calcularPermissoes(sessao.usuario.papel, {
      artistaId: sessao.usuario.artistaId,
      escopoVendedor: sessao.usuario.escopoVendedor,
      todosArtistasIds: DEFAULT_SELECTED_DJ_IDS,
    });
  }, [sessao]);

  const value = useMemo<AuthContextValue>(
    () => ({
      sessao,
      carregando,
      permissoes,
      isSuperAdmin: sessao?.tipo === "super-admin",
      modoVisitante: !!sessao?.modoVisitante,

      login: async (email, senha) => {
        // Aceita handle (username) OU e-mail. Sem "@" → e-mail interno
        // determinístico (handle@interno.gigscontrol.app), o mesmo que o
        // backend gera pra artistas e equipe. Com "@" passa direto (login
        // por e-mail real do admin segue intacto).
        const id = email.trim();
        const emailAuth = id.includes("@")
          ? id
          : `${id.toLowerCase()}@interno.gigscontrol.app`;
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailAuth,
          password: senha,
        });

        if (error || !data.user) {
          return {
            ok: false,
            erro:
              error?.message === "Invalid login credentials"
                ? "E-mail ou senha incorretos."
                : error?.message ?? "Não foi possível entrar.",
          };
        }

        const s = await montarSessao(data.user.id);
        if (!s) {
          // Usuário existe no Auth mas não tem profile no banco
          await supabase.auth.signOut();
          return {
            ok: false,
            erro: "Conta sem perfil configurado. Contate o suporte.",
          };
        }
        if (!s.usuario.ativo) {
          await supabase.auth.signOut();
          return { ok: false, erro: "Esta conta está desativada." };
        }

        setSessao(s);
        return { ok: true, tipo: s.tipo };
      },

      logout: async () => {
        await supabase.auth.signOut();
        setSessao(null);
        try {
          sessionStorage.removeItem(STORAGE_VISITANTE);
        } catch {
          // ignore
        }
      },

      entrarComoVisitante: (ws) => {
        setSessao((prev) => {
          if (!prev) return prev;
          return { ...prev, workspace: ws, modoVisitante: true };
        });
        try {
          sessionStorage.setItem(STORAGE_VISITANTE, JSON.stringify(ws));
        } catch {
          // ignore
        }
      },

      sairDoModoVisitante: () => {
        setSessao((prev) => {
          if (!prev) return prev;
          return { ...prev, workspace: null, modoVisitante: false };
        });
        try {
          sessionStorage.removeItem(STORAGE_VISITANTE);
        } catch {
          // ignore
        }
      },

      pode: (artistaId, chave) => {
        if (!sessao) return false;
        const ctx: CtxPermissao = {
          isSuperAdmin: sessao.tipo === "super-admin",
          papel: sessao.usuario.papel,
          artistaId:
            (sessao.usuario.artistaId as unknown as string | undefined) ?? null,
          vinculos: sessao.vinculos,
        };
        return motorPode(ctx, artistaId, chave);
      },
    }),
    [sessao, carregando, permissoes, supabase, montarSessao]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
