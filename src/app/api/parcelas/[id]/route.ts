import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { atualizarParcelaPorId } from "@/lib/services/vendas.service";
import { parcelaUpdateSchema } from "@/lib/validators/vendas.schema";
import { verificarInformarPagamento } from "@/lib/api/permissoes";
import { audit } from "@/lib/services/historico.service";

type RouteCtx = { params: { id: string } };

/**
 * PATCH /api/parcelas/:id — informar / desfazer pagamento, ajustar
 * data, observação, etc.
 */
export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const bloqueio = verificarInformarPagamento(r.sessao);
  if (bloqueio) return bloqueio;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = parcelaUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const parcela = await atualizarParcelaPorId(r.sessao.supabase, params.id, parsed.data);
    // Registra apenas mudanças de status_base (pagar/desfazer), que são
    // as ações de auditoria relevantes. Ajustes finos (data, obs) não.
    if (parsed.data.status_base === "pago") {
      await audit(r.sessao, {
        modulo: "parcela",
        tipo: "pagar",
        entidadeId: parcela.id,
        entidadeNome: `parcela ${parcela.percentual}%`,
        descricao: `Marcou parcela como paga (${parcela.percentual}% — R$ ${parcela.valor.toLocaleString("pt-BR")})`,
      });
    } else if (parsed.data.status_base === "pendente") {
      await audit(r.sessao, {
        modulo: "parcela",
        tipo: "desfazer-pagamento",
        entidadeId: parcela.id,
        entidadeNome: `parcela ${parcela.percentual}%`,
        descricao: `Desfez pagamento da parcela (${parcela.percentual}% — R$ ${parcela.valor.toLocaleString("pt-BR")})`,
      });
    }
    return NextResponse.json({ parcela });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar parcela." },
      { status: 500 }
    );
  }
}
