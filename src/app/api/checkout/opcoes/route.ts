import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { autenticarComWorkspace } from "@/lib/api/session";
import { resolverPais, gatewayPadraoDe, gatewaysDisponiveis } from "@/lib/gateway";
import { regiaoDe } from "@/lib/regiao";
import { getPlano, valorMensal, valorAnual, type PlanoId } from "@/lib/planos";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * GET /api/checkout/opcoes
 *
 * Devolve o roteamento de gateway (padrão + disponíveis) pro país da
 * requisição + a moeda e os valores (mensal/anual) do plano ATUALMENTE
 * escolhido pelo workspace (workspaces.plano/ciclo) — fonte única pro
 * SeletorGateway montar as abas sem duplicar a regra de país/moeda que já
 * vive em lib/gateway.ts e lib/regiao.ts.
 *
 * Autenticado; qualquer papel pode ler (o BloqueioModal não-admin não
 * chama isso, mas não custa liberar).
 */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  const pais = resolverPais(
    headers().get("x-vercel-ip-country"),
    cookies().get("gc-pais")?.value
  );
  const { moeda } = regiaoDe(pais);

  const admin = criarClienteAdmin();
  const { data: ws } = await admin
    .from("workspaces")
    .select("plano, ciclo")
    .eq("id", r.sessao.workspaceId)
    .maybeSingle<{ plano: string | null; ciclo: string | null }>();

  const planoId = (ws?.plano ?? "individual") as PlanoId;
  const plano = getPlano(planoId);
  const ciclo = ws?.ciclo === "anual" ? "anual" : "mensal";

  return NextResponse.json({
    gatewayPadrao: gatewayPadraoDe(pais),
    gatewaysDisponiveis: gatewaysDisponiveis(pais),
    moeda,
    plano: planoId,
    ciclo,
    valores: {
      mensal: valorMensal(plano, moeda),
      anual: valorAnual(plano, moeda),
    },
  });
}
