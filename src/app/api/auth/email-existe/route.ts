import { NextResponse } from "next/server";
import { z } from "zod";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * POST /api/auth/email-existe
 *
 * Pre-check usado pelo /signup pra avisar "esse email já tem conta"
 * ANTES de chamar supabase.auth.signUp (que, por questões de
 * segurança, devolve sucesso silencioso mesmo quando o email já
 * existe).
 *
 * Aceita corpo `{ email: string }`. Devolve `{ existe: boolean }`.
 *
 * Trade-off: permite enumeration (descobrir se um email tem conta).
 * Esse é o comportamento de quase todo SaaS sério hoje — Gmail,
 * GitHub, Notion etc — porque a UX clara vale o trade-off. Para
 * desencorajar bots tentando milhares de emails, considere rate-limit
 * em produção (Cloudflare WAF / Vercel rate-limit / etc).
 */

const schema = z.object({
  email: z.string().email("E-mail inválido"),
});

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const admin = criarClienteAdmin();

  try {
    // Consulta direto no schema auth (só service_role consegue).
    // O Supabase normaliza o email pra lowercase no insert, então
    // comparar com lowercase é seguro.
    const { data, error } = await admin
      .schema("auth")
      .from("users")
      .select("id")
      .eq("email", email)
      .limit(1);

    if (error) {
      console.error("[email-existe]", error.message);
      // Em caso de falha na consulta, NÃO bloqueamos o signup —
      // melhor deixar o Supabase decidir do que travar com falso erro.
      return NextResponse.json({ existe: false });
    }

    return NextResponse.json({ existe: (data?.length ?? 0) > 0 });
  } catch (e) {
    console.error("[email-existe] exceção:", (e as Error).message);
    return NextResponse.json({ existe: false });
  }
}
