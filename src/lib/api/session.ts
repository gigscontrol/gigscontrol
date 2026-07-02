import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/db/supabase-server";
import type { Papel } from "@/lib/permissoes";
import { funcoesValido, type Funcoes } from "@/lib/mappers/usuario";
import { workspaceBloqueado } from "@/lib/acesso";
import { listarVinculosDoUsuario, mapaDeVinculos } from "@/lib/repositories/membrosArtista.repo";

/**
 * Helper compartilhado pelos Route Handlers para autenticar uma requisição
 * e devolver o cliente Supabase do servidor + o profile do usuário.
 *
 * Inclui o `papel`, `escopo` e `artistaId` para que os services apliquem
 * filtros de permissão (Etapa 10).
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
  escopo: EscopoSessao;
  /**
   * Funções operacionais e DJs atendidos. Vazio quando o papel é admin
   * ou artista, ou quando o operacional ainda não foi configurado.
   */
  funcoes: Funcoes;
  /**
   * Modelo NOVO (Fase 4): mapa artist_id → chaves de permissão do vínculo
   * (membros_artista). `undefined` quando o usuário não tem NENHUM vínculo →
   * o motor cai no fallback legado (funcoes/escopo). Carregado só para papéis
   * operacionais (admin/artista/super são resolvidos sem consultar vínculo).
   */
  vinculos?: Record<string, string[]>;
};

function normalizarEscopo(raw: unknown): EscopoSessao {
  if (!raw || typeof raw !== "object") return { ...ESCOPO_PADRAO };
  const r = raw as Record<string, unknown>;
  return {
    verTodosContatos:
      typeof r.verTodosContatos === "boolean"
        ? r.verTodosContatos
        : ESCOPO_PADRAO.verTodosContatos,
    verTodasVendas:
      typeof r.verTodasVendas === "boolean"
        ? r.verTodasVendas
        : ESCOPO_PADRAO.verTodasVendas,
    editarTodosEventos:
      typeof r.editarTodosEventos === "boolean"
        ? r.editarTodosEventos
        : ESCOPO_PADRAO.editarTodosEventos,
  };
}

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
      "id, nome, email, workspace_id, is_super_admin, papel, artista_id, escopo, funcoes, status, deletado_em"
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
      escopo: unknown;
      funcoes: unknown;
      status: string;
      deletado_em: string | null;
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

  // Modelo novo (Fase 4): carrega os vínculos por artista para papéis
  // operacionais. admin/artista/super são resolvidos pelo motor sem consultar
  // vínculo, então economizamos a query. Falha ou zero vínculos → deixa
  // `undefined` (motor usa o fallback legado), pra não trancar ninguém.
  let vinculos: Record<string, string[]> | undefined;
  if (
    !profile.is_super_admin &&
    profile.papel !== "admin" &&
    profile.papel !== "artista"
  ) {
    try {
      const rows = await listarVinculosDoUsuario(supabase, profile.id);
      if (rows.length > 0) vinculos = mapaDeVinculos(rows);
    } catch {
      vinculos = undefined;
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
      escopo: normalizarEscopo(profile.escopo),
      funcoes: funcoesValido(
        (profile.funcoes ?? null) as Record<string, unknown> | null
      ),
      vinculos,
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
  // cancelada além da graça). Leitura, onboarding e o fluxo de pagamento NÃO
  // passam esse gate — o bloqueado ainda enxerga a conta e consegue regularizar.
  // 'ok' e 'graca' liberam normalmente.
  if (opts?.exigirAcesso && (await workspaceBloqueado(r.sessao.workspaceId))) {
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
