import { z } from "zod";

/**
 * Validador de UUID mais permissivo que o `z.string().uuid()` padrão.
 *
 * O `.uuid()` do zod exige a versão (1-5) e o variant bits conforme RFC 4122
 * — `xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx`, onde M ∈ [1-5] e N ∈ [8,9,a,b].
 *
 * Como Postgres aceita qualquer hex de 32 dígitos formatado no padrão
 * `8-4-4-4-12` no tipo `uuid` (a coluna sequer guarda os bits de versão
 * em si — é só armazenamento binário), nossos seeds usam IDs como
 * `d0000001-0000-0000-0000-000000000001` que NÃO passariam o `.uuid()`
 * do zod, mas existem no banco e são válidos para a coluna.
 *
 * Usamos este helper em qualquer schema que precise referenciar um id
 * vindo do banco.
 */
const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const uuidLike = z
  .string()
  .regex(UUID_LIKE, "id deve estar no formato uuid (32 hex separados por -)");
