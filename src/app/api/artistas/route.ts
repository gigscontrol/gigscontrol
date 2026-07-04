import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  listarArtistasDoWorkspace,
  criarArtistaCompleto,
  LimitePlanoAtingidoError,
  UsernameEmUsoError,
  ArtistaNaLixeiraError,
} from "@/lib/services/artistas.service";
import { redigirDj } from "@/lib/mappers/artista";
import { artistaCreateSchema } from "@/lib/validators/artistas.schema";
import type { PlanoId } from "@/lib/planos";
import { auditAndNotify } from "@/lib/services/historico.service";

export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const artistas = await listarArtistasDoWorkspace(r.sessao.supabase, r.sessao.workspaceId);
    // Admin/super veem tudo. Demais (operacional/artista) recebem a lista
    // REDIGIDA — sem PII pessoal/legal nem a taxa da agência. O artista vê o
    // PRÓPRIO cadastro completo (precisa dos próprios dados).
    const podeTudo = r.sessao.isSuperAdmin || r.sessao.papel === "admin";
    const saida = podeTudo
      ? artistas
      : artistas.map((dj) =>
          r.sessao.papel === "artista" && dj.id === r.sessao.artistaId
            ? dj
            : redigirDj(dj)
        );
    return NextResponse.json({ artistas: saida });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar artistas." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  // Somente admin pode criar artistas (porque cria auth user + profile)
  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode cadastrar artistas." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = artistaCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Plano do workspace pra checar limite
  const { data: ws, error: wsError } = await r.sessao.supabase
    .from("workspaces")
    .select("plano")
    .eq("id", r.sessao.workspaceId)
    .single();
  if (wsError || !ws) {
    return NextResponse.json(
      { erro: "Workspace não encontrado." },
      { status: 404 }
    );
  }

  // Para criar auth user precisamos do service_role (cliente admin).
  // Após a criação, a leitura volta pelo cliente normal (RLS aplica).
  const admin = criarClienteAdmin();

  try {
    const { artista, senhaTemporaria, usernameCompleto } =
      await criarArtistaCompleto(
        admin,
        r.sessao.workspaceId,
        ws.plano as PlanoId,
        parsed.data
      );
    await auditAndNotify(r.sessao, {
      modulo: "artista",
      tipo: "criar",
      entidadeId: artista.id,
      entidadeNome: artista.name,
      descricao: `Cadastrou o artista ${artista.name} (${usernameCompleto})`,
    });
    return NextResponse.json(
      { artista, senhaTemporaria, usernameCompleto },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof LimitePlanoAtingidoError) {
      return NextResponse.json({ erro: e.message }, { status: 409 });
    }
    if (e instanceof UsernameEmUsoError) {
      return NextResponse.json({ erro: e.message }, { status: 409 });
    }
    if (e instanceof ArtistaNaLixeiraError) {
      return NextResponse.json({ erro: e.message }, { status: 409 });
    }
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao criar artista." },
      { status: 500 }
    );
  }
}
