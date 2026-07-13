import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * GET /api/assinatura/estado
 *
 * Estado consolidado da assinatura pra tela de Plano no modelo PRÉ-PAGO por
 * validade. Lê `subscriptions` DIRETO (sem estado recorrente da Stripe):
 * plano/ciclo atuais, status, VALIDADE (`acesso_ate`), dias restantes derivados
 * dela, provider do último pagamento e o downgrade pendente (se houver). A
 * moeda vem do último pagamento registrado (tabela `pagamentos`) — não do IP.
 * Só admin.
 */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Apenas admin." }, { status: 403 });
  }

  const admin = criarClienteAdmin();
  const wsId = r.sessao.workspaceId;

  const { data: ws } = await admin
    .from("workspaces")
    .select("plano, ciclo, status")
    .eq("id", wsId)
    .maybeSingle<{ plano: string | null; ciclo: string | null; status: string | null }>();

  // Subscription (modelo pré-pago): status + validade + provider + downgrade
  // pendente. Defensivo: se colunas novas (acesso_ate/provider) ou de downgrade
  // (mig 46) ainda não migraram, cai no select mínimo sem elas.
  let subStatus: string | null = null;
  let acessoAte: string | null = null;
  let provider: string | null = null;
  let downgradePara: string | null = null;
  let downgradeEfetivoEm: string | null = null;
  const sel = await admin
    .from("subscriptions")
    .select("status, acesso_ate, provider, downgrade_para, downgrade_efetivo_em")
    .eq("workspace_id", wsId)
    .maybeSingle<{
      status: string | null;
      acesso_ate: string | null;
      provider: string | null;
      downgrade_para: string | null;
      downgrade_efetivo_em: string | null;
    }>();
  if (!sel.error && sel.data) {
    subStatus = sel.data.status;
    acessoAte = sel.data.acesso_ate;
    provider = sel.data.provider;
    downgradePara = sel.data.downgrade_para;
    downgradeEfetivoEm = sel.data.downgrade_efetivo_em;
  } else {
    const fb = await admin
      .from("subscriptions")
      .select("status")
      .eq("workspace_id", wsId)
      .maybeSingle<{ status: string | null }>();
    subStatus = fb.data?.status ?? null;
  }

  // Dias restantes derivados da validade (arredonda pra cima; nunca negativo).
  let diasRestantes = 0;
  if (acessoAte) {
    const ms = new Date(acessoAte).getTime() - Date.now();
    diasRestantes = ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
  }

  // Moeda REAL = a do último pagamento (não a do IP). null se nunca pagou.
  let moeda: string | null = null;
  const ultimoPag = await admin
    .from("pagamentos")
    .select("moeda")
    .eq("workspace_id", wsId)
    .not("moeda", "is", null)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle<{ moeda: string | null }>();
  if (ultimoPag.data?.moeda) moeda = ultimoPag.data.moeda;

  return NextResponse.json({
    plano: ws?.plano ?? null,
    ciclo: ws?.ciclo === "anual" ? "anual" : "mensal",
    status: subStatus ?? ws?.status ?? null,
    moeda,
    acessoAte,
    diasRestantes,
    provider,
    downgradePendente: !!downgradePara,
    downgradePara,
    downgradeEfetivoEm,
  });
}
