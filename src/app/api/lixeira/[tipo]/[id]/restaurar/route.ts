import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  restaurarArtistaDaLixeira,
  restaurarUsuarioDaLixeira,
  restaurarOrcamentoDaLixeira,
  restaurarVendaDaLixeira,
  restaurarContratanteDaLixeira,
  restaurarCasaDaLixeira,
  restaurarCidadeDaLixeira,
  type TipoLixeira,
} from "@/lib/services/lixeira.service";
import type { PlanoId } from "@/lib/planos";
import { auditAndNotify } from "@/lib/services/historico.service";

type RouteCtx = { params: { tipo: string; id: string } };

const TIPOS_VALIDOS: TipoLixeira[] = [
  "artista",
  "usuario",
  "orcamento",
  "venda",
  "contratante",
  "casa",
  "cidade",
];

/** Tabela e coluna de nome usadas pra montar o snapshot da auditoria. */
const META_POR_TIPO: Record<TipoLixeira, { tabela: string; colNome: string }> = {
  artista:     { tabela: "artists",      colNome: "name" },
  usuario:     { tabela: "profiles",     colNome: "nome" },
  orcamento:   { tabela: "orcamentos",   colNome: "numero" },
  venda:       { tabela: "vendas",       colNome: "numero" },
  contratante: { tabela: "contratantes", colNome: "nome" },
  casa:        { tabela: "casas",        colNome: "nome" },
  cidade:      { tabela: "cidades",      colNome: "nome" },
};

/**
 * POST /api/lixeira/:tipo/:id/restaurar — tira da lixeira.
 * Tipos suportados: artista, usuario, orcamento, venda, contratante, casa, cidade.
 *
 * Artistas e usuários respeitam o limite do plano (409 quando estourar);
 * os outros tipos não têm limite.
 */
export async function POST(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  if (!TIPOS_VALIDOS.includes(params.tipo as TipoLixeira)) {
    return NextResponse.json(
      { erro: `Tipo inválido: ${params.tipo}` },
      { status: 400 }
    );
  }
  const tipo = params.tipo as TipoLixeira;

  const admin = criarClienteAdmin();

  // Plano (necessário só pra artista/usuário, mas resolvemos antes)
  const { data: ws, error: errWs } = await admin
    .from("workspaces")
    .select("plano")
    .eq("id", r.sessao.workspaceId)
    .maybeSingle();
  if (errWs || !ws) {
    return NextResponse.json(
      { erro: "Workspace não encontrado." },
      { status: 500 }
    );
  }
  const planoId = ws.plano as PlanoId;

  // Snapshot do nome pra auditoria (faz antes de restaurar)
  const meta = META_POR_TIPO[tipo];
  const { data: snap } = await admin
    .from(meta.tabela)
    .select(`id, ${meta.colNome}`)
    .eq("id", params.id)
    .maybeSingle();
  const entidadeNome = (snap as Record<string, unknown> | null)?.[meta.colNome] as
    | string
    | null
    | undefined ?? null;

  try {
    switch (tipo) {
      case "artista":
        await restaurarArtistaDaLixeira(admin, params.id, planoId);
        break;
      case "usuario":
        await restaurarUsuarioDaLixeira(admin, params.id, r.sessao.workspaceId, planoId);
        break;
      case "orcamento":
        await restaurarOrcamentoDaLixeira(admin, params.id);
        break;
      case "venda":
        await restaurarVendaDaLixeira(admin, params.id);
        break;
      case "contratante":
        await restaurarContratanteDaLixeira(admin, params.id);
        break;
      case "casa":
        await restaurarCasaDaLixeira(admin, params.id);
        break;
      case "cidade":
        await restaurarCidadeDaLixeira(admin, params.id);
        break;
    }
    await auditAndNotify(r.sessao, {
      modulo: "lixeira",
      tipo: "restaurar",
      entidadeId: params.id,
      entidadeNome,
      descricao: `Restaurou ${tipo} ${entidadeNome ?? params.id} da lixeira`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as Error & { status?: number };
    const status = typeof err.status === "number" ? err.status : 500;
    return NextResponse.json(
      { erro: err.message ?? "Falha ao restaurar." },
      { status }
    );
  }
}
