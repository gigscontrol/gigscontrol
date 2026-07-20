import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  listarContratosDoWorkspace,
  criarContratoNoWorkspace,
  resolverEscopoContrato,
  LimiteContratosError,
} from "@/lib/services/contratos.service";
import { verificarCriarContrato } from "@/lib/api/permissoes";
import { contratoCreateSchema } from "@/lib/validators/contratos.schema";
import { PRECO_EXCEDENTE, type PlanoId, type Moeda } from "@/lib/planos";
import { regiaoDe, resolverPais } from "@/lib/regiao";
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

    // Limite do ciclo atingido. MODELO PRÉ-PAGO: o excedente é um checkout
    // avulso (não mais cobrança off-session no cartão salvo). Se JÁ existe um
    // crédito 'excedente_disponivel' pago (registrado pelo webhook), CONSOME-o
    // atomicamente e cria o contrato pulando o limite. Senão, devolve 402 com
    // `checkoutNecessario` pra o front abrir o /api/contratos/excedente-checkout.
    const admin = criarClienteAdmin();
    const creditoId = await consumirCreditoExcedente(admin, r.sessao.workspaceId);
    if (creditoId) {
      try {
        const contrato = await criarContratoNoWorkspace(
          r.sessao.supabase,
          r.sessao.workspaceId,
          ws.plano as PlanoId,
          parsed.data,
          r.sessao.userId,
          true // pularLimite: o excedente pago já foi consumido acima
        );
        return NextResponse.json({ contrato }, { status: 201 });
      } catch (falha) {
        // A criação falhou APÓS consumir o crédito (banco, corrida no número,
        // Storage). Devolve o crédito antes de propagar, senão o admin pagou e
        // ficou sem contrato e sem crédito.
        await reverterCreditoExcedente(admin, creditoId);
        return respostaDeErro(falha, "Falha ao criar contrato.");
      }
    }

    const moeda = moedaDaRegiao();
    return NextResponse.json(
      {
        erro: e.message,
        excedente: true,
        checkoutNecessario: true,
        valor: PRECO_EXCEDENTE[moeda], // centavos
        moeda,
      },
      { status: 402 }
    );
  }
}

/**
 * Consome UM crédito de excedente disponível (pago via checkout avulso e
 * registrado pelo webhook com status 'excedente_disponivel'). Vira
 * 'excedente_usado'. Atômico: o guard `.eq('status','excedente_disponivel')`
 * garante que dois pedidos concorrentes não consumam o MESMO crédito (o
 * segundo update não casa nenhuma linha). Retorna true se consumiu.
 */
async function consumirCreditoExcedente(
  admin: ReturnType<typeof criarClienteAdmin>,
  workspaceId: string
): Promise<string | null> {
  const { data: cred } = await admin
    .from("pagamentos")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("status", "excedente_disponivel")
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!cred) return null;

  const { data: upd, error } = await admin
    .from("pagamentos")
    .update({ status: "excedente_usado" })
    .eq("id", cred.id)
    .eq("status", "excedente_disponivel") // guard: só consome se ainda disponível
    .select("id");
  if (error) return null;
  return (upd?.length ?? 0) > 0 ? cred.id : null;
}

/**
 * Devolve um crédito consumido pra 'excedente_disponivel' — usado quando a
 * criação do contrato falha DEPOIS de consumir. Sem isto o admin pagava o
 * avulso, tomava 500 e ficava sem contrato E sem crédito.
 */
async function reverterCreditoExcedente(
  admin: ReturnType<typeof criarClienteAdmin>,
  creditoId: string
): Promise<void> {
  await admin
    .from("pagamentos")
    .update({ status: "excedente_disponivel" })
    .eq("id", creditoId)
    .eq("status", "excedente_usado");
}

/** Moeda de cobrança pela região (BR → BRL, exterior → USD). */
function moedaDaRegiao(): Moeda {
  const pais = resolverPais(
    headers().get("x-vercel-ip-country"),
    cookies().get("gc-pais")?.value
  );
  return regiaoDe(pais).moeda;
}
