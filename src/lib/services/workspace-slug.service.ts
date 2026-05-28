import type { SupabaseClient } from "@supabase/supabase-js";
import { emailEhInternoFake } from "./artistas.service";

/**
 * Service de troca do `slug` da agência.
 *
 * O slug vai pro fim do username de cada artista/equipe do workspace
 * (ex: `dudu-twobookings`). Trocar o slug do workspace tem efeito
 * cascata: todos os profiles do workspace que terminam em
 * `-slugAntigo` precisam virar `-slugNovo`. E o email fake interno
 * de cada um (gerado no signup, formato `{username}@interno.gigscontrol.app`)
 * também precisa ser regerado se ainda for o fake.
 *
 * Limites:
 *  - Máximo 3 trocas nos últimos 30 dias por workspace (janela móvel)
 *  - Slug deve ser globalmente único (constraint UNIQUE na tabela)
 *  - Formato: 3-30 chars [a-z0-9-]
 */

export const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 30;
export const SLUG_LIMITE_30D = 3;

export class SlugInvalidoError extends Error {
  status = 400;
  constructor(public detalhe: string) {
    super(detalhe);
    this.name = "SlugInvalidoError";
  }
}

export class SlugEmUsoError extends Error {
  status = 409;
  constructor(public slug: string) {
    super(`O username "${slug}" já está em uso por outra agência.`);
    this.name = "SlugEmUsoError";
  }
}

export class LimiteTrocaSlugError extends Error {
  status = 429;
  constructor() {
    super(
      `Limite de ${SLUG_LIMITE_30D} trocas em 30 dias atingido. Tente novamente depois.`
    );
    this.name = "LimiteTrocaSlugError";
  }
}

/** Valida formato do slug. Lança `SlugInvalidoError` se inválido. */
export function validarFormatoSlug(slug: string): void {
  if (slug.length < SLUG_MIN_LENGTH) {
    throw new SlugInvalidoError(
      `Username muito curto (mínimo ${SLUG_MIN_LENGTH} chars).`
    );
  }
  if (slug.length > SLUG_MAX_LENGTH) {
    throw new SlugInvalidoError(
      `Username muito longo (máximo ${SLUG_MAX_LENGTH} chars).`
    );
  }
  if (!SLUG_REGEX.test(slug)) {
    throw new SlugInvalidoError(
      "Use apenas letras minúsculas, números e hífen."
    );
  }
}

/**
 * Verifica se um slug está disponível globalmente. Retorna `false` se
 * algum outro workspace já está usando.
 */
export async function slugDisponivel(
  supabase: SupabaseClient,
  slug: string,
  workspaceIdAtual: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .neq("id", workspaceIdAtual)
    .maybeSingle();
  if (error) throw error;
  return !data; // disponível se não achou outro workspace
}

/**
 * Quantas trocas o workspace já fez nos últimos 30 dias.
 */
export async function trocasSlug30d(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<number> {
  const { data, error } = await supabase.rpc("trocas_slug_ultimos_30d", {
    p_workspace_id: workspaceId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/**
 * Troca o slug do workspace e propaga em cascata pra todos os
 * profiles (username + email fake se ainda for interno).
 *
 * Operação não transacional (Supabase JS não expõe BEGIN/COMMIT em
 * múltiplas tabelas). Em caso de falha parcial, o estado pode ficar
 * inconsistente — log e o admin pode tentar novamente. Em produção
 * seria ideal usar uma função PL/pgSQL com BEGIN; deixei pra evoluir
 * depois se houver pressão.
 */
export async function trocarSlugDoWorkspace(
  admin: SupabaseClient,
  params: {
    workspaceId: string;
    novoSlug: string;
    alteradoPor: string; // profile.id do admin que disparou
  }
): Promise<{ slugAntigo: string; slugNovo: string; usuariosAtualizados: number }> {
  const { workspaceId, novoSlug, alteradoPor } = params;
  const slug = novoSlug.trim().toLowerCase();

  // 1. Validações
  validarFormatoSlug(slug);

  // 2. Pega slug atual
  const { data: ws, error: errWs } = await admin
    .from("workspaces")
    .select("id, slug")
    .eq("id", workspaceId)
    .single<{ id: string; slug: string }>();
  if (errWs || !ws) throw new Error("Workspace não encontrado.");
  if (ws.slug === slug) {
    return { slugAntigo: ws.slug, slugNovo: slug, usuariosAtualizados: 0 };
  }

  // 3. Unicidade global
  if (!(await slugDisponivel(admin, slug, workspaceId))) {
    throw new SlugEmUsoError(slug);
  }

  // 4. Limite de 3 trocas em 30 dias
  if ((await trocasSlug30d(admin, workspaceId)) >= SLUG_LIMITE_30D) {
    throw new LimiteTrocaSlugError();
  }

  const slugAntigo = ws.slug;
  const sufixoAntigo = `-${slugAntigo}`;
  const sufixoNovo = `-${slug}`;

  // 5. Lista profiles do workspace cujo username termina em -slugAntigo
  const { data: profiles, error: errProfs } = await admin
    .from("profiles")
    .select("id, username, email")
    .eq("workspace_id", workspaceId)
    .not("username", "is", null);
  if (errProfs) throw errProfs;

  const afetados = (profiles ?? []).filter((p) =>
    typeof p.username === "string" && p.username.endsWith(sufixoAntigo)
  );

  // 6. Atualiza o slug do workspace (faz primeiro porque tem constraint UNIQUE
  //    — se falhar aqui, nada na cascata precisou rodar)
  const { error: errUp } = await admin
    .from("workspaces")
    .update({ slug })
    .eq("id", workspaceId);
  if (errUp) throw errUp;

  // 7. Cascata em cada profile + auth user se email for fake interno
  for (const p of afetados) {
    const usernameAtual = p.username as string;
    const usernameNovo =
      usernameAtual.slice(0, -sufixoAntigo.length) + sufixoNovo;

    const updates: Record<string, unknown> = { username: usernameNovo };

    if (emailEhInternoFake(p.email as string | null)) {
      const novoEmailFake = `${usernameNovo}@interno.gigscontrol.app`;
      // Atualiza auth.users (admin client)
      const { error: errAuth } = await admin.auth.admin.updateUserById(p.id, {
        email: novoEmailFake,
        email_confirm: true,
      });
      if (errAuth) {
        // Não falha tudo — loga e segue. O admin pode ver no histórico.
        console.error(
          `[trocar-slug] falha ao atualizar email auth do profile ${p.id}:`,
          errAuth.message
        );
      } else {
        updates.email = novoEmailFake;
      }
    }

    await admin.from("profiles").update(updates).eq("id", p.id);
  }

  // 8. Registra no histórico
  await admin.from("workspace_slug_history").insert({
    workspace_id: workspaceId,
    slug_anterior: slugAntigo,
    slug_novo: slug,
    alterado_por: alteradoPor,
  });

  return {
    slugAntigo,
    slugNovo: slug,
    usuariosAtualizados: afetados.length,
  };
}
