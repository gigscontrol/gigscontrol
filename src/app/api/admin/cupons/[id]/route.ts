import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarSuperAdmin } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { alterarCupom, ErroCupomCrud } from "@/lib/services/cupons.service";
import { respostaDeErro } from "@/lib/api/erros";

/**
 * PATCH /api/admin/cupons/[id] — altera um cupom existente (ativar/desativar,
 * mudar limite de uso, mudar validade). SEM DELETE (desativar preserva o
 * ledger `cupom_usos`).
 */

const patchSchema = z.object({
  ativo: z.boolean().optional(),
  limiteUso: z.number().int().min(1).optional(),
  validade: z.string().datetime().nullable().optional(),
});

type RouteCtx = { params: { id: string } };

export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarSuperAdmin();
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const admin = criarClienteAdmin();
    const cupom = await alterarCupom(admin, params.id, parsed.data);
    return NextResponse.json({ cupom });
  } catch (e) {
    if (e instanceof ErroCupomCrud) {
      const status = e.message === "Cupom não encontrado." ? 404 : 400;
      return NextResponse.json({ erro: e.message }, { status });
    }
    return respostaDeErro(e, "Falha ao atualizar cupom.");
  }
}
