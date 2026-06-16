/**
 * Página do catch-all /app/[[...slug]].
 *
 * Toda a UI do app logado é renderizada pelo LAYOUT (src/app/app/layout.tsx),
 * que contém os providers + AuthGuard + AppRoot. A tela ativa é derivada da
 * URL (usePathname) dentro do AppRoot. Esta page só precisa existir pra casar
 * qualquer rota /app/** — ela não renderiza nada própria.
 */
export default function AppCatchAllPage() {
  return null;
}
