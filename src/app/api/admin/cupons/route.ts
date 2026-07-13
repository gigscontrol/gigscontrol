import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarSuperAdmin } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { PLANO_IDS } from "@/lib/planos";
import { listarCupons, criarCupom, ErroCupomCrud } from "@/lib/services/cupons.service";
import { respostaDeErro } from "@/lib/api/erros";

/**
 * GET/POST /api/admin/cupons — CRUD (sem DELETE) do catálogo de cupons de
 * "1º mês grátis", gated por super-admin. Ver PATCH em `[id]/route.ts`.
 */

const postSchema = z.object({
  codigo: z.string().trim().min(1).max(64),
  planoAlvo: z.enum(PLANO_IDS),
  limiteUso: z.number().int().min(1),
  validade: z.string().datetime().nullable().optional(),
});

export async function GET() {
  const r = await autenticarSuperAdmin();
  if ("response" in r) return r.response;
  try {
    const admin = criarClienteAdmin();
    const cupons = await listarCupons(admin);
    return NextResponse.json({ cupons });
  } catch (e) {
    return respostaDeErro(e, "Falha ao listar cupons.");
  }
}

export async function POST(request: Request) {
  const r = await autenticarSuperAdmin();
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const admin = criarClienteAdmin();
    const cupom = await criarCupom(admin, r.sessao.userId, parsed.data);
    return NextResponse.json({ cupom }, { status: 201 });
  } catch (e) {
    if (e instanceof ErroCupomCrud) {
      return NextResponse.json({ erro: e.message }, { status: 400 });
    }
    return respostaDeErro(e, "Falha ao criar cupom.");
  }
}
