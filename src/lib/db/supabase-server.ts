import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente Supabase para uso no SERVIDOR (Route Handlers, Server Components).
 *
 * Lê a sessão do usuário a partir dos cookies da requisição. As queries
 * respeitam o Row Level Security — cada usuário só acessa os dados do
 * próprio workspace.
 *
 * Use este cliente na maior parte do backend.
 */
export function criarClienteServidor() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Chamado de um Server Component — ignorável quando há middleware
            // de sessão cuidando da renovação dos cookies.
          }
        },
      },
    }
  );
}
