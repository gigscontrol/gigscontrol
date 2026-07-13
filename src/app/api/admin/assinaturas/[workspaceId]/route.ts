import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarSuperAdmin } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  alterarStatusAssinatura,
  alterarPlanoAssinatura,
  estenderDiasAssinatura,
  historicoPagamentos,
} from "@/lib/services/plataforma.service";
import { respostaDeErro } from "@/lib/api/erros";

// MODELO PRÉ-PAGO: o painel só liga/desliga o acesso manualmente. "ativa" aqui
// é "reativar" (limpa suspended/cancelled e deixa `acesso_ate` mandar de novo).
// 'trial' não é mais uma ação do painel (ver plataforma.service#alterarStatusAssinatura).
const patchSchema = z.object({
  status: z.enum(["ativa", "suspensa", "cancelada"]).optional(),
  plano: z
    .enum(["individual", "equipe", "time", "agencia", "agencia-plus", "agencia-max"])
    .optional(),
  dias: z.number().int().min(1).max(365).optional(),
});

type RouteCtx = { params: { workspaceId: string } };

/** Histórico de pagamentos (ledger `pagamentos`) do workspace — mais recentes primeiro. */
export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarSuperAdmin();
  if ("response" in r) return r.response;
  try {
    const admin = criarClienteAdmin();
    const pagamentos = await historicoPagamentos(admin, params.workspaceId);
    return NextResponse.json({ pagamentos });
  } catch (e) {
    return respostaDeErro(e, "Falha ao carregar histórico de pagamentos.");
  }
}

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
    if (parsed.data.status) {
      await alterarStatusAssinatura(admin, params.workspaceId, parsed.data.status);
    }
    if (parsed.data.plano) {
      await alterarPlanoAssinatura(admin, params.workspaceId, parsed.data.plano);
    }
    if (parsed.data.dias) {
      await estenderDiasAssinatura(admin, params.workspaceId, parsed.data.dias);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e, "Falha ao atualizar assinatura.");
  }
}
