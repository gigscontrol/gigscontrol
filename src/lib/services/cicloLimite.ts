import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * Início (ISO) da JANELA mensal atual dos limites (contratos, vouchers),
 * ancorada na VIRADA DO PLANO — o dia de cobrança da assinatura — e não no 1º
 * do calendário.
 *
 * Ex.: assinatura no dia 15 → a cota reseta todo dia 15. Plano anual reseta
 * mensal no mesmo dia-âncora. Sem assinatura/data conhecida, cai no 1º do mês
 * de calendário (comportamento antigo).
 */
export async function janelaDoCicloISO(workspaceId: string): Promise<string> {
  const admin = criarClienteAdmin();
  const { data } = await admin
    .from("subscriptions")
    .select("proxima_cobranca, inicio_em")
    .eq("workspace_id", workspaceId)
    .maybeSingle<{ proxima_cobranca: string | null; inicio_em: string | null }>();

  const agora = new Date();
  const ancora = data?.proxima_cobranca || data?.inicio_em || null;
  if (!ancora) {
    // Fallback: 1º do mês corrente.
    return new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  }

  // Dia-âncora (dia de cobrança). Ancorado ao meio-dia pra não escorregar de fuso.
  const diaAncora = new Date(`${ancora.slice(0, 10)}T12:00:00`).getDate();

  const diasNoMes = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const clamp = (y: number, m: number) => Math.min(diaAncora, diasNoMes(y, m));

  // Começa pelo dia-âncora do mês corrente.
  let inicio = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    clamp(agora.getFullYear(), agora.getMonth()),
    0,
    0,
    0
  );
  // Se ainda não chegou o dia-âncora este mês, a janela começou no mês passado.
  if (inicio.getTime() > agora.getTime()) {
    const mAnterior = agora.getMonth() - 1;
    const y = mAnterior < 0 ? agora.getFullYear() - 1 : agora.getFullYear();
    const m = (mAnterior + 12) % 12;
    inicio = new Date(y, m, clamp(y, m), 0, 0, 0);
  }
  return inicio.toISOString();
}
