import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Middleware Next.js — renova os cookies da sessão do Supabase a cada
 * requisição. Sem isto, o token de acesso expira e o usuário "cai"
 * sozinho mesmo com refresh token válido.
 *
 * Esta versão não bloqueia rotas; apenas mantém a sessão fresca. As
 * verificações de autorização ficam nos próprios Route Handlers e
 * páginas (com RLS no banco como rede de segurança).
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Disparar getUser() força a leitura/atualização do cookie de sessão.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Aplica em todas as rotas, exceto assets estáticos e otimizações do Next.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
