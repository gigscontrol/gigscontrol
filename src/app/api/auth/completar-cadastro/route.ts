import { NextResponse } from "next/server";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/db/supabase-server";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { setupWorkspaceParaNovoUsuario } from "@/lib/services/signup.service";
import type { PlanoId } from "@/lib/planos";

const PLANOS_VALIDOS: PlanoId[] = [
  "individual",
  "equipe",
  "time",
  "agencia",
  "agencia-plus",
  "agencia-max",
];

const schema = z.object({
  nome_agencia: z.string().min(1).max(120),
  plano: z.enum([
    "individual",
    "equipe",
    "time",
    "agencia",
    "agencia-plus",
    "agencia-max",
  ]),
});

/**
 * POST /api/auth/completar-cadastro
 *
 * Chamado pela tela /signup/completar (mostrada após primeiro login
 * OAuth). Cria workspace + profile pro usuário que ainda não tinha.
 *
 * Se o profile JÁ existe (chamada duplicada / refresh) → devolve OK
 * sem fazer nada destrutivo.
 */
export async function POST(request: Request) {
  const supabase = criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
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
  if (!PLANOS_VALIDOS.includes(parsed.data.plano as PlanoId)) {
    return NextResponse.json({ erro: "Plano inválido." }, { status: 400 });
  }

  // Constrói user_metadata "completo" pra reusar a função que já existe
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const nomeOriginal =
    (meta.full_name as string | undefined) ??
    (meta.name as string | undefined) ??
    (user.email?.split("@")[0] ?? "");

  try {
    const admin = criarClienteAdmin();
    const r = await setupWorkspaceParaNovoUsuario(admin, {
      id: user.id,
      email: user.email ?? "",
      user_metadata: {
        nome: nomeOriginal,
        nome_agencia: parsed.data.nome_agencia,
        plano_escolhido: parsed.data.plano,
      },
    });
    return NextResponse.json({ ok: true, workspaceId: r.workspaceId });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao criar workspace." },
      { status: 500 }
    );
  }
}
