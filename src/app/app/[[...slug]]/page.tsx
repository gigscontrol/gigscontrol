/**
 * Página do catch-all /app/[[...slug]].
 *
 * Toda a UI do app logado é renderizada pelo LAYOUT (src/app/app/layout.tsx),
 * que contém os providers + AuthGuard + AppRoot. A tela ativa é derivada da
 * URL (usePathname) dentro do AppRoot. Esta page só precisa existir pra casar
 * qualquer rota /app/** — ela não renderiza nada própria.
 *
 * `force-dynamic`: o app é 100% dinâmico (atrás de login, derivado da URL em
 * runtime). Sem isso, o Next dev tenta "generate static paths" pro catch-all
 * opcional — passo que vinha derrubando o worker no dev (Jest worker error).
 */
export const dynamic = "force-dynamic";

export default function AppCatchAllPage() {
  return null;
}
