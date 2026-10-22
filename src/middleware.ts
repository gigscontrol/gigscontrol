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

  // getClaims() lê o cookie e renova a sessão quando o token está pra vencer
  // (o que importa aqui). Era getUser(), que ia ao servidor de login a CADA
  // requisição — inclusive nas /api, que fazem a própria checagem: 2 idas
  // ao Auth por chamada, 34 só pra abrir o painel. Com a chave assimétrica
  // (ES256) do projeto, getClaims confere a assinatura aqui mesmo.
  // Se falhar por outro motivo (chave pública indisponível), volta ao
  // getUser() de antes — sem sessão, nenhum dos dois vai à rede.
  const { error } = await supabase.auth.getClaims();
  if (error) await supabase.auth.getUser();

  return response;
}

export const config = {
  // Aplica em todas as rotas, exceto assets estáticos e otimizações do Next.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
