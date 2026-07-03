import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarSignatariosDoContrato,
  definirSignatarios,
  preencherUrls,
} from "@/lib/services/contratoSignatarios.service";
import {
  buscarContratoPorId,
  resolverEscopoContrato,
} from "@/lib/services/contratos.service";
import { podeVerContrato, podeEditarContrato } from "@/lib/api/permissoes";
import { definirSignatariosSchema } from "@/lib/validators/contratoSignatarios.schema";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    // Gate por artista ANTES de montar as URLs assinadas (PII: RG/CPF/selfie,
    // IP, geolocalização). Fora do escopo → 404, não vaza a existência.
    const contrato = await buscarContratoPorId(r.sessao.supabase, params.id);
    if (!contrato)
      return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
    const { artistId } = await resolverEscopoContrato(r.sessao.supabase, contrato.vendaId);
    if (!podeVerContrato(r.sessao, artistId))
      return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
    const signatarios = await listarSignatariosDoContrato(
      r.sessao.supabase,
      params.id
    );
    const comUrls = await preencherUrls(criarClienteAdmin(), signatarios);
    return NextResponse.json({ signatarios: comUrls });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar signatários." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  // Definir signatários = editar o contrato → gate por artista.
  const contrato = await buscarContratoPorId(r.sessao.supabase, params.id);
  if (!contrato)
    return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
  const { artistId, criadoPor } = await resolverEscopoContrato(
    r.sessao.supabase,
    contrato.vendaId
  );
  // 404 fora de escopo (coerente com GET/PATCH) — não vaza existência.
  if (!podeEditarContrato(r.sessao, artistId, criadoPor))
    return NextResponse.json(
      { erro: "Contrato não encontrado." },
      { status: 404 }
    );

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = definirSignatariosSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const signatarios = await definirSignatarios(
      r.sessao.supabase,
      r.sessao.workspaceId,
      params.id,
      parsed.data.signatarios.map((s) => ({
        nome: s.nome,
        email: s.email || null,
        papel: s.papel ?? null,
        exige: s.exige,
      }))
    );
    return NextResponse.json({ signatarios }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao definir signatários." },
      { status: 500 }
    );
  }
}
