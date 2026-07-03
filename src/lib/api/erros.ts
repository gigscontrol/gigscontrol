import { NextResponse } from "next/server";

/**
 * Traduz um erro de banco (Supabase/Postgres) numa resposta HTTP amigável,
 * com status correto e SEM vazar a mensagem crua do Postgres (nomes de
 * constraint, colunas). O detalhe cru é logado só no servidor.
 *
 * Uso no catch das rotas:
 *   } catch (e) { return respostaDeErro(e, "Falha ao criar orçamento."); }
 *
 * Códigos conhecidos:
 *  - 23505 (unique_violation)      → 409 "já existe / número em uso"
 *  - 23503 (foreign_key_violation) → 409 "registro relacionado inválido"
 *  - 23514 (check_violation)       → 400 "dados inválidos"
 *  - PGRST116 (0 linhas no single) → 404 "não encontrado"
 * Qualquer outro → 500 com a `mensagemPadrao`.
 */
export function respostaDeErro(
  e: unknown,
  mensagemPadrao = "Erro interno."
): NextResponse {
  const err = e as { code?: string; message?: string } | null;
  const code = err?.code;

  // Log do detalhe cru só no servidor (nunca vai pro cliente).
  console.error(`[api] erro ${code ?? "?"}:`, err?.message ?? e);

  switch (code) {
    case "23505":
      return NextResponse.json(
        { erro: "Já existe um registro com esse identificador. Tente de novo." },
        { status: 409 }
      );
    case "23503":
      return NextResponse.json(
        { erro: "Registro relacionado inválido ou inexistente." },
        { status: 409 }
      );
    case "23514":
      return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
    case "PGRST116":
      return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });
    default:
      return NextResponse.json({ erro: mensagemPadrao }, { status: 500 });
  }
}
