import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * PATCH /api/perfil
 *
 * Atualiza os DADOS PESSOAIS do próprio usuário logado (o admin, na
 * Etapa 1 do onboarding; e depois em Configurações). O e-mail NÃO muda por
 * aqui — é a credencial de login. Só grava os campos presentes no body.
 */
const schema = z.object({
  nome: z.string().min(1).max(120).optional(),
  nome_legal: z.string().max(120).nullable().optional(),
  pais: z.string().min(2).max(2).optional(),
  documento_tipo: z.string().max(20).nullable().optional(),
  documento: z.string().max(60).nullable().optional(),
  telefone: z.string().max(40).nullable().optional(),
  data_nascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
    .nullable()
    .optional(),
  // Cidade onde reside (FK cidades). O client resolve a seleção pro UUID do
  // catálogo do próprio workspace antes de mandar; null limpa.
  cidade_id: z.string().uuid().nullable().optional(),
});

export async function PATCH(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

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

  // Só os campos presentes; string vazia vira null (limpa o campo).
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    patch[k] = v === "" ? null : v;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const admin = criarClienteAdmin();
  const { error } = await admin
    .from("profiles")
    .update(patch)
    .eq("id", r.sessao.userId);
  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
