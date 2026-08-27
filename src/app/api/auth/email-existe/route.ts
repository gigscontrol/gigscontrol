import { NextResponse } from "next/server";
import { ipDe, rateLimit } from "@/lib/api/rate-limit";
import { z } from "zod";

/**
 * POST /api/auth/email-existe
 *
 * Pre-check usado pelo /signup pra avisar "esse email já tem conta"
 * ANTES de chamar supabase.auth.signUp (que devolve sucesso silencioso
 * mesmo quando o email já existe, pra evitar enumeration).
 *
 * Faz uma chamada direta na GoTrue Admin API:
 *   GET {SUPABASE_URL}/auth/v1/admin/users?email=...
 * Esse endpoint requer service_role e aceita filtro por email.
 *
 * Trade-off: permite enumeration (descobrir se um email tem conta).
 * Esse é o comportamento de quase todo SaaS sério (Gmail, GitHub,
 * Notion etc) porque a UX clara vale o trade-off. Para desencorajar
 * bots, considerar rate-limit em produção.
 */

const schema = z.object({
  email: z.string().email("E-mail inválido"),
});

export async function POST(request: Request) {
  // Freio anti-enumeração (auditoria 27/08/2026): a rota é oráculo intencional
  // de UX ("este e-mail tem conta?"), mas sem limite virava enumeração em
  // massa via Admin API. 15/min por IP cobre o uso legítimo do formulário.
  const limitado = rateLimit("email-existe", ipDe(request), 15, 60_000);
  if (limitado) return limitado;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!baseUrl || !serviceKey) {
    console.error("[email-existe] env vars faltando");
    return NextResponse.json({ existe: false });
  }

  try {
    // GoTrue Admin API: ?email=foo aceita filtro server-side
    const url = `${baseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      // Não cachear — sempre query fresca
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[email-existe] HTTP", res.status, await res.text());
      return NextResponse.json({ existe: false });
    }
    const body = (await res.json()) as { users?: Array<{ email?: string }> };
    // Confirma comparação case-insensitive (GoTrue normaliza, mas
    // garantia explícita não custa nada).
    const existe = (body.users ?? []).some(
      (u) => (u.email ?? "").toLowerCase() === email
    );
    return NextResponse.json({ existe });
  } catch (e) {
    console.error("[email-existe] exceção:", (e as Error).message);
    // Falha do lado servidor: NÃO bloqueia signup — melhor deixar
    // passar do que travar com falso erro.
    return NextResponse.json({ existe: false });
  }
}
