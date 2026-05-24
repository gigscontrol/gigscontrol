import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/db/supabase-server";

/**
 * POST /api/auth/logout
 *
 * Encerra a sessão atual. O cookie de sessão é apagado pelo cliente
 * do servidor durante o signOut().
 */
export async function POST() {
  const supabase = criarClienteServidor();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
