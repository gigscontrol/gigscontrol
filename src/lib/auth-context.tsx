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
  type PrivacidadeDj,
} from "./permissoes";
import { privacidadeValida } from "./mappers/artista";
import { DEFAULT_SELECTED_ARTISTA_IDS } from "./artistas-fallback";
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
   * Privacidade do artista (papel === "artista"): o que o admin autorizou o
   * artista a ver/fazer no próprio espaço (artists.privacidade). Alimenta o
   * motor no grey-out para bater com o servidor (session.ts). `undefined` para
   * os demais papéis → o resolver usa o padrão seguro (PRIVACIDADE_DJ_PADRAO).
   */
  privacidade?: PrivacidadeDj;
  /**
   * Booleano LEGADO e global de anotações (profiles.pode_criar_anotacoes).
   * A UI precisa dele para não esconder a tab Agenda de quem alcança
   * Anotações só por ele (ver src/lib/permissoes/modulos.ts).
   */
  podeCriarAnotacoes?: boolean;
  /**
   * A carga dos VÍNCULOS falhou (rede/RLS instável) — `vinculos` está vazio por
   * ERRO, não porque o usuário não tem acesso. Quem esconde UI por permissão
   * DEVE falhar aberto neste caso: mostrar tudo e deixar o servidor barrar é
   * recuperável; esconder o app inteiro por causa de um fetch que caiu manda o
   * usuário ligar pro admin achando que perdeu o acesso.
   */
  vinculosErro?: boolean;
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
  /**
   * @param manter "Manter conectado" — estende a idade máxima da sessão de
   *               7 para 30 dias. Default `false`.
   */
  login: (
    email: string,
    senha: string,
    manter?: boolean
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
  /**
   * Versão do `pode` pra GREY-OUT de botões (UX; o servidor é a autoridade).
   * No MODELO NOVO (legado morto) espelha exatamente o servidor: admin/artista/
   * super passam pelo papel; equipe depende 100% dos vínculos por artista —
   * operacional sem vínculo fica cinza (o servidor nega). Use isto pra
   * desabilitar botões.
   */
  podeUI: (artistaId: string | null, chave: string) => boolean;
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
  /** Cor pessoal do avatar (equipe/admin). Pro artista a identidade é artists.cor. */
  cor: string | null;
  escopo_vendedor: Usuario["escopoVendedor"] | null;
  status: string;
  deletado_em: string | null;
  /** Booleano LEGADO e global de anotações (mesmo campo lido em api/session.ts). */
  pode_criar_anotacoes?: boolean | null;
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

/* ------------------------------------------------------------------ *
 * IDADE MÁXIMA DA SESSÃO (client-side)
 *
 * O @supabase/ssr persiste e auto-renova o token pra sempre — na prática
 * a sessão nunca expirava. Aqui impomos uma IDADE MÁXIMA ABSOLUTA contada
 * a partir do LOGIN explícito:
 *   - padrão .................. 7 dias
 *   - "Manter conectado" ..... 30 dias
 *
 * COMO NÃO RESETA NO REFRESH: o carimbo (`gc-login-ts`) só é gravado (a)
 * num login explícito e (b) no boot quando está AUSENTE. Um TOKEN_REFRESHED
 * do Supabase não mexe no localStorage, então o carimbo continua lá e a
 * idade segue contando desde o login original. Nada no caminho de refresh
 * regrava o timestamp.
 *
 * GRAÇA ANTI-DESLOGUE-EM-MASSA: sessão válida SEM carimbo (sessão legada,
 * de antes desta feature, ou recém-chegada do callback OAuth server-side)
 * NÃO desloga — carimbamos "agora" e a contagem passa a valer daqui.
 * Isso também é o que captura o login OAuth sem precisar tocar o callback:
 * o callback faz navegação de página inteira, e no boot dessa página não há
 * carimbo → a graça carimba. (Não dá pra confiar no evento SIGNED_IN: o
 * @supabase/ssr emite INITIAL_SESSION quando restaura sessão do cookie.)
 * ------------------------------------------------------------------ */
const LOGIN_TS_KEY = "gc-login-ts";
const MANTER_KEY = "gc-manter";
const DIA_MS = 24 * 60 * 60 * 1000;
const MAX_IDADE_PADRAO_MS = 7 * DIA_MS;
const MAX_IDADE_MANTER_MS = 30 * DIA_MS;

/** Grava o carimbo de login. Só deve ser chamado em LOGIN EXPLÍCITO. */
function carimbarLogin(manter: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOGIN_TS_KEY, String(Date.now()));
    localStorage.setItem(MANTER_KEY, manter ? "1" : "0");
  } catch {
    // modo privado / storage bloqueado — sem carimbo a sessão só não expira
    // por idade (erra pro lado de deixar o usuário entrar).
  }
}

/** Limpa o carimbo (logout / sessão encerrada). */
function limparCarimboLogin() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LOGIN_TS_KEY);
    localStorage.removeItem(MANTER_KEY);
  } catch {
    // ignore
  }
}

/**
 * Verifica a idade da sessão no boot.
 * Retorna `true` quando a sessão passou da idade máxima (deve deslogar).
 * Quando não há carimbo, aplica a GRAÇA: carimba agora e retorna `false`.
 */
function sessaoExpirouPorIdade(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ts = localStorage.getItem(LOGIN_TS_KEY);
    if (!ts) {
      // Graça: sessão legada ou recém-vinda do OAuth → carimba, não desloga.
      localStorage.setItem(LOGIN_TS_KEY, String(Date.now()));
      return false;
    }
    const inicio = Number(ts);
    // Carimbo corrompido → não expulsa ninguém; recarimba.
    if (!Number.isFinite(inicio) || inicio <= 0) {
      localStorage.setItem(LOGIN_TS_KEY, String(Date.now()));
      return false;
    }
    const manter = localStorage.getItem(MANTER_KEY) === "1";
    const max = manter ? MAX_IDADE_MANTER_MS : MAX_IDADE_PADRAO_MS;
    return Date.now() - inicio > max;
  } catch {
    // storage indisponível → nunca expulsa.
    return false;
  }
}

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
        // Cor de identidade: profiles.cor por padrão (equipe/admin). Pro artista
        // é sobrescrita pela cor do artista (artists.cor) logo abaixo.
        cor: profile.cor ?? null,
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
      let vinculosErro = false;
      if (
        !profile.is_super_admin &&
        profile.workspace_id &&
        profile.papel !== "admin" &&
        profile.papel !== "artista"
      ) {
        // FALHA ≠ ZERO LINHAS. Descartar o `error` fazia `vinculos = {}` calado;
        // com a UI agora escondendo módulo por permissão, isso viraria "app sem
        // nenhum módulo" numa instabilidade passageira. Tenta de novo e, se
        // ainda assim falhar, marca o erro pra UI falhar ABERTO.
        let vinc: unknown[] | null = null;
        for (let tentativa = 0; tentativa < 2; tentativa++) {
          const { data, error } = await supabase
            .from("membros_artista")
            .select("artist_id, permissoes")
            .eq("user_id", profile.id)
            .is("deletado_em", null);
          if (!error) {
            vinc = data ?? [];
            break;
          }
          if (tentativa === 1) vinculosErro = true;
        }
        for (const v of vinc ?? []) {
          const perms = (v as { permissoes?: unknown }).permissoes;
          vinculos[(v as { artist_id: string }).artist_id] = Array.isArray(perms)
            ? (perms.filter((x) => typeof x === "string") as string[])
            : [];
        }
      }

      // Privacidade do artista (config do admin em artists.privacidade). Só o
      // papel artista precisa — governa o motor no próprio espaço; sem isso o
      // grey-out do cliente usava sempre o padrão e divergia do servidor.
      let privacidade: PrivacidadeDj | undefined;
      if (profile.papel === "artista" && profile.artista_id) {
        const { data: art } = await supabase
          .from("artists")
          .select("privacidade, cor")
          .eq("id", profile.artista_id)
          .maybeSingle<{ privacidade: unknown; cor: string | null }>();
        privacidade = privacidadeValida(art?.privacidade ?? null);
        // A identidade do ARTISTA é a cor do artista (artists.cor) — a mesma da
        // Agenda/roster. Sobrescreve a cor do perfil pro avatar bater com tudo.
        if (art?.cor) usuario.cor = art.cor;
      }

      return {
        tipo,
        usuario,
        workspace,
        vinculos,
        privacidade,
        podeCriarAnotacoes: profile.pode_criar_anotacoes ?? false,
        vinculosErro,
      };
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
        // Idade máxima da sessão (7d, ou 30d com "Manter conectado").
        // Sem carimbo → graça: carimba e segue (ninguém é expulso no deploy).
        // scope "local": a idade é contada POR DISPOSITIVO (o carimbo vive em
        // localStorage). O padrão do supabase-js é "global", que revogaria o
        // refresh token em TODOS os aparelhos — o celular expirando aos 7 dias
        // derrubaria o desktop que tinha 30 contratados.
        if (sessaoExpirouPorIdade()) {
          await supabase.auth.signOut({ scope: "local" });
          limparCarimboLogin();
          if (ativo) {
            setSessao(null);
            setCarregando(false);
          }
          return;
        }
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
        // Sessão encerrada (logout aqui ou em outra aba): zera o carimbo pra
        // que o próximo login comece a contagem do zero.
        limparCarimboLogin();
        try {
          sessionStorage.removeItem(STORAGE_VISITANTE);
        } catch {
          // ignore
        }
      }
    });

    // A idade só era avaliada no boot: uma aba deixada aberta (ou um PWA que
    // não reinicia) nunca reavaliava, e a "idade máxima absoluta" não era
    // absoluta. Reavalia quando a aba volta ao foco. Mesmo caminho de
    // expiração (inclusive scope "local"), então continua sem derrubar
    // os outros dispositivos.
    const aoVoltarPraAba = async () => {
      if (document.visibilityState !== "visible") return;
      const {
        data: { session: s },
      } = await supabase.auth.getSession();
      if (!s?.user) return;
      if (!sessaoExpirouPorIdade()) return;
      await supabase.auth.signOut({ scope: "local" });
      limparCarimboLogin();
      if (ativo) setSessao(null);
    };
    document.addEventListener("visibilitychange", aoVoltarPraAba);

    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", aoVoltarPraAba);
      subscription.unsubscribe();
    };
  }, [supabase, montarSessao]);

  const permissoes = useMemo<Permissoes | null>(() => {
    if (!sessao) return null;
    if (sessao.tipo === "super-admin" && !sessao.workspace) return null;
    return calcularPermissoes(sessao.usuario.papel, {
      artistaId: sessao.usuario.artistaId,
      escopoVendedor: sessao.usuario.escopoVendedor,
      todosArtistasIds: DEFAULT_SELECTED_ARTISTA_IDS,
    });
  }, [sessao]);

  const value = useMemo<AuthContextValue>(
    () => ({
      sessao,
      carregando,
      permissoes,
      isSuperAdmin: sessao?.tipo === "super-admin",
      modoVisitante: !!sessao?.modoVisitante,

      login: async (email, senha, manter = false) => {
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
          // Fallback do login por HANDLE: se o membro cadastrou e verificou
          // um e-mail real, o e-mail de auth deixou de ser o interno
          // determinístico, então a derivação acima não bate. A rota resolve
          // o handle → e-mail atual no servidor e loga (o cookie de sessão é
          // compartilhado com o browser via @supabase/ssr). Só pra handle
          // (sem "@") — login por e-mail real segue direto acima.
          if (!id.includes("@")) {
            try {
              const res = await fetch("/api/auth/login-handle", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ handle: id, senha }),
              });
              if (res.ok) {
                // Sincroniza o cliente com o cookie que o servidor gravou.
                const { data: sess } = await supabase.auth.getSession();
                const uid = sess.session?.user?.id;
                if (uid) {
                  const s = await montarSessao(uid);
                  if (s && !s.usuario.ativo) {
                    await supabase.auth.signOut();
                    return { ok: false, erro: "Esta conta está desativada." };
                  }
                  if (s) {
                    carimbarLogin(manter);
                    setSessao(s);
                    return { ok: true, tipo: s.tipo };
                  }
                }
                // Sessão não propagou pro cliente em memória — recarrega pra
                // reinicializar a partir do cookie já gravado. O carimbo TEM
                // que ir antes do reload, senão o boot pós-reload cairia na
                // graça e ignoraria o "Manter conectado".
                if (typeof window !== "undefined") {
                  carimbarLogin(manter);
                  window.location.reload();
                  return { ok: true, tipo: "cliente" };
                }
              }
            } catch {
              // rede/erro — cai na mensagem de erro padrão abaixo.
            }
          }
          return {
            ok: false,
            erro:
              error?.message === "Invalid login credentials"
                ? "E-mail ou senha incorretos."
                : error?.message ?? "Não foi possível entrar.",
          };
        }

        let s = await montarSessao(data.user.id);
        if (!s) {
          // Auto-cura: conta confirmada no Auth mas sem profile — o callback
          // de confirmação de e-mail não chegou a criar o workspace/profile.
          // Recria a partir do user_metadata do signup e tenta montar de novo.
          try {
            const rep = await fetch("/api/auth/reparar-perfil", {
              method: "POST",
              credentials: "include",
            });
            if (rep.ok) s = await montarSessao(data.user.id);
          } catch {
            // rede/erro — cai no tratamento de "sem perfil" abaixo
          }
        }
        if (!s) {
          // Usuário existe no Auth mas não tem profile (e o reparo não resolveu)
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

        carimbarLogin(manter);
        setSessao(s);
        return { ok: true, tipo: s.tipo };
      },

      logout: async () => {
        await supabase.auth.signOut();
        setSessao(null);
        limparCarimboLogin();
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
          privacidade: sessao.privacidade,
          vinculos: sessao.vinculos,
        };
        return motorPode(ctx, artistaId, chave);
      },

      podeUI: (artistaId, chave) => {
        if (!sessao) return false;
        // Modelo NOVO (legado morto): o grey-out espelha o servidor
        // (session.ts). Não há mais atalho de "legado mostra tudo" — admin/
        // artista/super passam pelo papel; operacional sem vínculo é negado
        // pelo próprio motor (vinculos vazio → cinza).
        const ctx: CtxPermissao = {
          isSuperAdmin: sessao.tipo === "super-admin",
          papel: sessao.usuario.papel,
          artistaId:
            (sessao.usuario.artistaId as unknown as string | undefined) ?? null,
          privacidade: sessao.privacidade,
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
