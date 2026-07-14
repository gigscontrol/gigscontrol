import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/db/supabase-server";
import type { Papel, PrivacidadeDj } from "@/lib/permissoes";
import type { Funcoes } from "@/lib/mappers/usuario";
import { privacidadeValida } from "@/lib/mappers/artista";
import { workspaceBloqueado, workspaceOnboardingIncompleto } from "@/lib/acesso";
import { listarVinculosDoUsuario, mapaDeVinculos } from "@/lib/repositories/membrosArtista.repo";

/**
 * Helper compartilhado pelos Route Handlers para autenticar uma requisição
 * e devolver o cliente Supabase do servidor + o profile do usuário.
 *
 * Inclui o `papel` e o `artistaId` para que os services apliquem filtros de
 * permissão. O acesso operacional vem 100% dos `vinculos` (membros_artista);
 * o sistema legado (profiles.funcoes/escopo) MORREU.
 */
export type EscopoSessao = {
  verTodosContatos: boolean;
  verTodasVendas: boolean;
  editarTodosEventos: boolean;
};

const ESCOPO_PADRAO: EscopoSessao = {
  verTodosContatos: true,
  verTodasVendas: true,
  editarTodosEventos: true,
};

export type SessaoAutenticada = {
  supabase: ReturnType<typeof criarClienteServidor>;
  userId: string;
  userNome: string | null;
  userEmail: string | null;
  workspaceId: string | null;
  isSuperAdmin: boolean;
  papel: Papel;
  artistaId: string | null;
  /**
   * LEGADO MORTO — não mais lido de `profiles.escopo`; sempre NEUTRO (padrão).
   * Campo preservado só por compatibilidade de shape (a camada
   * `src/lib/api/permissoes.ts` está sendo reescrita em paralelo pra largar
   * essa leitura). Fonte de acesso operacional = `vinculos`. Remover quando
   * nada mais referenciar `sessao.escopo`.
   */
  escopo: EscopoSessao;
  /** Permissão dedicada de criar pastas de anotações (admin sempre pode). */
  podeCriarAnotacoes: boolean;
  /**
   * LEGADO MORTO — não mais lido de `profiles.funcoes`; sempre VAZIO (`{}`).
   * Campo preservado só por compatibilidade de shape (a camada
   * `src/lib/api/permissoes.ts` está sendo reescrita em paralelo pra largar
   * essa leitura). Fonte de acesso operacional = `vinculos`. Remover quando
   * nada mais referenciar `sessao.funcoes`.
   */
  funcoes: Funcoes;
  /**
   * Modelo NOVO: mapa artist_id → chaves de permissão do vínculo
   * (membros_artista). Fonte ÚNICA de acesso do operacional. Fica SEMPRE
   * definido para papéis operacionais ({} quando não há nenhuma linha →
   * negado, sem fallback legado). Carregado só para papéis operacionais
   * (admin/artista/super são resolvidos sem consultar vínculo).
   */
  vinculos?: Record<string, string[]>;
  /**
   * Privacidade do artista (papel === "artista"): o que o admin autorizou o
   * artista a ver/fazer. Governa o motor no papel artista.
   */
  privacidade?: PrivacidadeDj;
};

export async function autenticar(): Promise<
  { sessao: SessaoAutenticada } | { response: NextResponse }
> {
  const supabase = criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, nome, email, workspace_id, is_super_admin, papel, artista_id, status, deletado_em, pode_criar_anotacoes"
    )
    .eq("id", user.id)
    .single<{
      id: string;
      nome: string | null;
      email: string | null;
      workspace_id: string | null;
      is_super_admin: boolean;
      papel: Papel;
      artista_id: string | null;
      status: string;
      deletado_em: string | null;
      pode_criar_anotacoes: boolean;
    }>();

  if (!profile) {
    return {
      response: NextResponse.json(
        { erro: "Conta sem perfil configurado." },
        { status: 403 }
      ),
    };
  }

  if (profile.deletado_em) {
    return {
      response: NextResponse.json(
        { erro: "Esta conta foi removida." },
        { status: 403 }
      ),
    };
  }

  if (profile.status !== "ativo") {
    return {
      response: NextResponse.json(
        { erro: "Conta desativada." },
        { status: 403 }
      ),
    };
  }

  // Modelo NOVO — equipe = 100% vínculos por artista (membros_artista). O
  // sistema legado (profiles.funcoes/escopo + fallback) MORREU: operacional sem
  // vínculo é NEGADO. `vinculos` fica SEMPRE definido para papéis operacionais
  // ({} quando não há nenhuma linha → o motor nega tudo até o admin conceder),
  // nunca `undefined`. admin/artista/super são resolvidos pelo motor sem
  // consultar vínculo.
  let vinculos: Record<string, string[]> | undefined;
  if (
    !profile.is_super_admin &&
    profile.papel !== "admin" &&
    profile.papel !== "artista"
  ) {
    try {
      const rows = await listarVinculosDoUsuario(supabase, profile.id);
      vinculos = mapaDeVinculos(rows); // {} quando não há linhas
    } catch {
      vinculos = {}; // erro de carga → sem vínculo = negado (fail-closed)
    }
  }

  // Privacidade do artista: o que o admin autorizou. Só o papel artista precisa
  // (governa o motor no próprio espaço). Falha → padrão seguro (vê o próprio,
  // não muta) é aplicado pelo resolver quando `privacidade` fica undefined.
  let privacidade: PrivacidadeDj | undefined;
  if (profile.papel === "artista" && profile.artista_id) {
    try {
      const { data: art } = await supabase
        .from("artists")
        .select("privacidade")
        .eq("id", profile.artista_id)
        .maybeSingle<{ privacidade: unknown }>();
      privacidade = privacidadeValida(art?.privacidade ?? null);
    } catch {
      privacidade = undefined;
    }
  }

  return {
    sessao: {
      supabase,
      userId: profile.id,
      userNome: profile.nome,
      userEmail: profile.email,
      workspaceId: profile.workspace_id,
      isSuperAdmin: profile.is_super_admin,
      papel: profile.papel,
      artistaId: profile.artista_id,
      // LEGADO MORTO — neutro (não mais lido de profiles.escopo/funcoes). Só
      // existe porque a camada legada api/permissoes.ts ainda referencia.
      escopo: { ...ESCOPO_PADRAO },
      podeCriarAnotacoes: profile.pode_criar_anotacoes ?? false,
      funcoes: {},
      vinculos,
      privacidade,
    },
  };
}

/**
 * Variante que exige um workspace ativo (cliente). Para super-admin sem
 * workspace selecionado, devolve 400 — chamadas de domínio precisam de
 * tenant.
 */
export async function autenticarComWorkspace(
  opts?: { exigirAcesso?: boolean }
): Promise<
  | { sessao: SessaoAutenticada & { workspaceId: string } }
  | { response: NextResponse }
> {
  const r = await autenticar();
  if ("response" in r) return r;

  if (!r.sessao.workspaceId) {
    return {
      response: NextResponse.json(
        { erro: "Workspace não selecionado." },
        { status: 400 }
      ),
    };
  }

  // Gate de paywall server-side: rotas de MUTAÇÃO passam { exigirAcesso: true }
  // e são barradas quando a assinatura está bloqueada (vencida/suspensa/
  // cancelada além da graça, ou trial sem data nunca pago). Vale pra QUALQUER
  // papel — o estado é do WORKSPACE, não do usuário: se o admin não paga, admin,
  // artista E equipe são barrados igual (cascata). Leitura, onboarding e o fluxo
  // de pagamento NÃO passam esse gate — o bloqueado ainda enxerga a conta e
  // consegue regularizar. 'ok' e 'graca' liberam normalmente.
  if (opts?.exigirAcesso && (await workspaceBloqueado(r.sessao.workspaceId))) {
    // O onboarding NÃO é barrado pelo paywall: no passo Pagamento o checkout cria
    // um stub que deixa 'bloqueado', mas o usuário ainda está regularizando e
    // precisa poder concluir/editar as etapas. Só barra após o onboarding pronto.
    if (!(await workspaceOnboardingIncompleto(r.sessao.workspaceId))) {
      return {
        response: NextResponse.json(
          {
            erro: "Acesso bloqueado: regularize a assinatura para continuar.",
            estadoAcesso: "bloqueado",
          },
          { status: 402 }
        ),
      };
    }
  }

  return {
    sessao: { ...r.sessao, workspaceId: r.sessao.workspaceId },
  };
}

/**
 * Variante que exige super-admin da plataforma. Usado pelos endpoints
 * `/api/admin/*` que listam/alteram todos os workspaces.
 */
export async function autenticarSuperAdmin(): Promise<
  { sessao: SessaoAutenticada } | { response: NextResponse }
> {
  const r = await autenticar();
  if ("response" in r) return r;
  if (!r.sessao.isSuperAdmin) {
    return {
      response: NextResponse.json(
        { erro: "Acesso restrito ao super-admin." },
        { status: 403 }
      ),
    };
  }
  return r;
}
