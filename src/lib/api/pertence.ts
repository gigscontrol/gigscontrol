import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Guard de isolamento multi-tenant (anti-IDOR).
 *
 * Rotas `/[id]` que operam com o cliente ADMIN (service_role, que IGNORA o RLS)
 * precisam validar À MÃO que o recurso pertence ao workspace do usuário logado —
 * senão um admin do workspace A consegue ler/editar/apagar dados do workspace B
 * só trocando o id na URL. Lê o `workspace_id` real via admin e compara com o do
 * requester.
 *
 * @returns true se o recurso existe E pertence ao workspace informado.
 */
export async function pertenceAoWorkspace(
  admin: SupabaseClient,
  tabela: "artists" | "profiles",
  id: string,
  workspaceId: string
): Promise<boolean> {
  const { data } = await admin
    .from(tabela)
    .select("workspace_id")
    .eq("id", id)
    .maybeSingle();
  return (
    !!data && (data as { workspace_id?: string }).workspace_id === workspaceId
  );
}
