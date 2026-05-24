import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase ADMIN — usa a chave secreta (service_role).
 *
 * ⚠️  ATENÇÃO: este cliente IGNORA o Row Level Security. Ele enxerga e
 * altera QUALQUER dado de QUALQUER workspace.
 *
 * Use APENAS:
 *  - em código de servidor (Route Handlers), nunca no navegador;
 *  - para operações da plataforma (painel super-admin) ou tarefas
 *    administrativas que precisam atravessar workspaces.
 *
 * Para o uso normal (dados de um cliente logado), use sempre o
 * criarClienteServidor() — que respeita o RLS.
 */
export function criarClienteAdmin() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret || secret === "COLE_SUA_SECRET_KEY_AQUI") {
    throw new Error(
      "SUPABASE_SECRET_KEY não configurada. Cole a chave secreta no arquivo .env.local."
    );
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
