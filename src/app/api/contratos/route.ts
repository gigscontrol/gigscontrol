import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarContratosDoWorkspace,
  criarContratoNoWorkspace,
  resolverEscopoContrato,
  LimiteContratosError,
} from "@/lib/services/contratos.service";
import { verificarCriarContrato } from "@/lib/api/permissoes";
import { contratoCreateSchema } from "@/lib/validators/contratos.schema";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  cobrarExcedente,
  infoSubscription,
  SemCartaoError,
  AutenticacaoRequeridaError,
} from "@/lib/services/stripe.service";
import { PRECO_EXCEDENTE, type PlanoId } from "@/lib/planos";
import { respostaDeErro } from "@/lib/api/erros";

export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const contratos = await listarContratosDoWorkspace(r.sessao.supabase, r.sessao);
    return NextResponse.json({ contratos });
  } catch (e) {
    return respostaDeErro(e, "Falha ao listar contratos.");
  }
}

export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = contratoCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Gate por artista: o artista vem da venda vinculada (avulso → admin-only).
  const { artistId } = await resolverEscopoContrato(
    r.sessao.supabase,
    parsed.data.venda_id ?? null
  );
  const gate = verificarCriarContrato(r.sessao, artistId);
  if (gate) return gate;

  // Plano do workspace — necessário pra validar o limite mensal de contratos.
  const { data: ws, error: wsErr } = await r.sessao.supabase
    .from("workspaces")
    .select("plano")
    .eq("id", r.sessao.workspaceId)
    .single();
  if (wsErr || !ws) {
    return NextResponse.json(
      { erro: "Workspace não encontrado." },
      { status: 404 }
    );
  }

  // Flags do excedente pago (fora do schema do contrato).
  const extra = (raw ?? {}) as { pagarExcedente?: boolean; idem?: string };

  try {
    const contrato = await criarContratoNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      ws.plano as PlanoId,
      parsed.data,
      r.sessao.userId
    );
    return NextResponse.json({ contrato }, { status: 201 });
  } catch (e) {
    if (!(e instanceof LimiteContratosError)) {
      return respostaDeErro(e, "Falha ao criar contrato.");
    }

    // Limite do ciclo atingido. Se há assinatura ativa (cartão), oferece pagar
    // o contrato EXCEDENTE por unidade; senão, só bloqueia.
    const admin = criarClienteAdmin();
    const { data: sub } = await admin
      .from("subscriptions")
      .select("mp_preference_id, status")
      .eq("workspace_id", r.sessao.workspaceId)
      .maybeSingle<{ mp_preference_id: string | null; status: string | null }>();
    const subId = sub?.mp_preference_id ?? null;
    if (!subId || sub?.status !== "ativa") {
      return NextResponse.json({ erro: e.message }, { status: 409 });
    }

    if (!extra.pagarExcedente) {
      // Oferece: devolve o preço na moeda REAL da assinatura.
      let moeda: "brl" | "usd" = "brl";
      try {
        moeda = (await infoSubscription(subId)).moeda;
      } catch {
        /* mantém brl */
      }
      return NextResponse.json(
        {
          excedente: true,
          limite: e.limite,
          plano: e.plano,
          valor: PRECO_EXCEDENTE[moeda],
          moeda,
        },
        { status: 402 }
      );
    }

    // Confirmou o pagamento → cobra o excedente e cria pulando o limite.
    if (!extra.idem) {
      return NextResponse.json({ erro: "Token de pagamento ausente." }, { status: 400 });
    }
    try {
      await cobrarExcedente({
        subscriptionId: subId,
        descricao: `Contrato excedente — plano ${e.plano}`,
        idempotencyKey: `exc_${extra.idem}`,
      });
    } catch (ce) {
      // Sem cartão salvo → o client manda o usuário atualizar o pagamento.
      if (ce instanceof SemCartaoError) {
        return NextResponse.json(
          { semCartao: true, erro: ce.message },
          { status: 402 }
        );
      }
      // 3DS exigido → o client confirma via stripe-js (mesma idem key) e
      // re-submete. Devolve o clientSecret pra concluir a autenticação.
      if (ce instanceof AutenticacaoRequeridaError) {
        return NextResponse.json(
          {
            requiresAction: true,
            clientSecret: ce.clientSecret,
            erro: ce.message,
          },
          { status: 402 }
        );
      }
      return NextResponse.json(
        { erro: (ce as Error).message ?? "Falha ao cobrar o excedente. Verifique o cartão." },
        { status: 402 }
      );
    }
    const contrato = await criarContratoNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      ws.plano as PlanoId,
      parsed.data,
      r.sessao.userId,
      true
    );
    return NextResponse.json({ contrato, excedentePago: true }, { status: 201 });
  }
}
