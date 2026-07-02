import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { pastasValidas, MAX_PASTAS } from "@/lib/mappers/contrato";

/**
 * Pastas de organização de contratos (aba "Meus contratos"), máx. 5/workspace.
 * Guardadas como JSON em `workspaces.contrato_pastas` (migration 47).
 *
 *  GET → lista as pastas do workspace.
 *  PUT { pastas } → salva a lista inteira (admin). Cria/renomeia/reordena/exclui.
 */

export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const { data } = await r.sessao.supabase
    .from("workspaces")
    .select("contrato_pastas")
    .eq("id", r.sessao.workspaceId)
    .maybeSingle<{ contrato_pastas: unknown }>();
  return NextResponse.json({ pastas: pastasValidas(data?.contrato_pastas) });
}

const schema = z.object({
  pastas: z
    .array(
      z.object({
        id: z.string().min(1),
        nome: z.string().min(1).max(40),
        ordem: z.number().optional(),
      })
    )
    .max(MAX_PASTAS),
});

export async function PUT(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas administradores podem organizar as pastas." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Normaliza (cap em 5, ordem, trim) antes de gravar.
  const pastas = pastasValidas(
    parsed.data.pastas.map((p, i) => ({ ...p, ordem: p.ordem ?? i }))
  );
  const admin = criarClienteAdmin();
  const { error } = await admin
    .from("workspaces")
    .update({ contrato_pastas: pastas })
    .eq("id", r.sessao.workspaceId);
  if (error) {
    return NextResponse.json(
      { erro: error.message ?? "Falha ao salvar as pastas." },
      { status: 500 }
    );
  }
  return NextResponse.json({ pastas });
}
