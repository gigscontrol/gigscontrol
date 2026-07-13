import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/db/supabase-server";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * POST /api/auth/senha-trocada
 *
 * Marcado pela aba Perfil (card Acesso) DEPOIS que o usuário trocou a própria senha
 * via `supabase.auth.updateUser({ password })`. Apenas baixa a flag
 * `profiles.senha_padrao = false` pro usuário logado — assim o admin do
 * workspace consegue ver no modal de edição que a senha aleatória inicial
 * já não vale mais.
 *
 * Idempotente. Se a flag já estava `false`, segue sem ruído. Falha em
 * silêncio se não houver sessão (a UI só chama em sucesso, então isso
 * só acontece se a sessão expirou no meio do caminho).
 */
export async function POST() {
  const supabase = criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  // Usa client admin pra garantir o update mesmo se a RLS for restritiva
  // pro próprio profile. O escopo continua limitado ao id do user logado.
  // Também apaga `senha_padrao_valor` — a senha em plaintext só existe
  // enquanto o usuário ainda não trocou; agora trocou, ela some.
  const admin = criarClienteAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ senha_padrao: false, senha_padrao_valor: null })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { erro: error.message ?? "Falha ao atualizar flag de senha." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
