import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarSuperAdmin } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  alterarStatusAssinatura,
  alterarPlanoAssinatura,
} from "@/lib/services/plataforma.service";

const patchSchema = z.object({
  status: z.enum(["ativa", "trial", "suspensa", "cancelada"]).optional(),
  plano: z
    .enum(["individual", "equipe", "time", "agencia", "agencia-plus", "agencia-max"])
    .optional(),
});

type RouteCtx = { params: { workspaceId: string } };

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
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar assinatura." },
      { status: 500 }
    );
  }
}
