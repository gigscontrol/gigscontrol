/**
 * Ponte entre a SESSÃO do servidor e o MOTOR de permissões (resolver).
 *
 * As rotas/services chamam estes helpers para decidir acesso no modelo novo
 * (vínculos por artista), com fallback automático pro legado quando o usuário
 * ainda não tem vínculo. É a única forma de perguntar "pode?" no servidor.
 */

import type { SessaoAutenticada } from "./session";
import { pode, artistasVisiveis, ctxDaSessao } from "@/lib/permissoes/resolver";

/** O usuário da sessão PODE fazer `chave` no `artistaId`? */
export function podeNaSessao(
  sessao: SessaoAutenticada,
  artistaId: string | null,
  chave: string
): boolean {
  return pode(ctxDaSessao(sessao), artistaId, chave);
}

/**
 * Lista de artist_ids que o usuário alcança (opcionalmente exigindo `chave`),
 * ou "todos" (admin/super). Use pra filtrar queries: `.in("artist_id", ids)`.
 */
export function artistasVisiveisNaSessao(
  sessao: SessaoAutenticada,
  chave?: string
): "todos" | string[] {
  return artistasVisiveis(ctxDaSessao(sessao), chave);
}

/**
 * Pode MUTAR (editar/excluir) uma linha respeitando o escopo "próprios × todos".
 *
 *   - tem `chaveTodos` no artista           → pode em qualquer linha;
 *   - é o dono (criadoPor === userId) e tem  → pode só na própria;
 *     `chaveProprio`
 *   - senão                                  → não pode.
 *
 * Linha com `criadoPor` nulo (legado, sem dono) exige `chaveTodos`.
 */
export function podeMutar(
  sessao: SessaoAutenticada,
  artistaId: string | null,
  criadoPor: string | null | undefined,
  chaveProprio: string,
  chaveTodos: string
): boolean {
  if (podeNaSessao(sessao, artistaId, chaveTodos)) return true;
  if (criadoPor && criadoPor === sessao.userId) {
    return podeNaSessao(sessao, artistaId, chaveProprio);
  }
  return false;
}
