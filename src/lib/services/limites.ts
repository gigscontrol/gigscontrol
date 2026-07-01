import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PLANOS,
  tierPlano,
  cabeNoPlano,
  type PlanoId,
  type ExcedenteLimite,
} from "@/lib/planos";
import { contarArtistas } from "@/lib/repositories/artistas.repo";
import { contarUsuariosEquipe } from "@/lib/repositories/usuarios.repo";
import { contarModelosDoWorkspace } from "@/lib/repositories/contratoModelos.repo";

/**
 * Plano EFETIVO pra checagem de limites de cadastro.
 *
 * Se há um downgrade AGENDADO (`subscriptions.downgrade_para`) pra um plano
 * MENOR, retorna o menor — assim o admin não consegue cadastrar recursos além
 * do limite do destino enquanto espera a virada. Fecha o abuso "carrega tudo no
 * plano top, agenda downgrade e cai pro barato mantendo os recursos".
 *
 * Fora um downgrade pendente, retorna o próprio plano atual. Defensivo:
 * qualquer erro (ex.: coluna `downgrade_para` ainda não migrada) cai no plano
 * atual, então nada quebra antes da migration 46 ser aplicada.
 */
export async function planoEfetivoParaLimites(
  db: SupabaseClient,
  workspaceId: string,
  planoAtual: PlanoId
): Promise<PlanoId> {
  try {
    const { data, error } = await db
      .from("subscriptions")
      .select("downgrade_para")
      .eq("workspace_id", workspaceId)
      .maybeSingle<{ downgrade_para: string | null }>();
    if (error || !data?.downgrade_para) return planoAtual;
    const alvo = data.downgrade_para as PlanoId;
    if (PLANOS.some((p) => p.id === alvo) && tierPlano(alvo) < tierPlano(planoAtual)) {
      return alvo;
    }
    return planoAtual;
  } catch {
    return planoAtual;
  }
}

/**
 * Conta o uso atual (artistas + usuários da equipe + modelos) e devolve as
 * dimensões que ESTOURAM os limites do plano-destino. Vazio = cabe.
 * Usado pra validar um downgrade ANTES de agendar.
 */
export async function excedentesParaPlano(
  db: SupabaseClient,
  workspaceId: string,
  destino: PlanoId
): Promise<ExcedenteLimite[]> {
  const [artistas, usuarios, modelos] = await Promise.all([
    contarArtistas(db, workspaceId),
    contarUsuariosEquipe(db, workspaceId),
    contarModelosDoWorkspace(db, workspaceId),
  ]);
  return cabeNoPlano({ destino, artistas, usuarios, modelos });
}

/** Rótulos PT das dimensões de limite (pra montar a mensagem de excedente). */
export const ROTULO_DIMENSAO: Record<ExcedenteLimite["dimensao"], string> = {
  artistas: "artistas",
  usuarios: "usuários da equipe",
  modelos: "modelos de contrato",
};

/** Monta a mensagem "Remova X artistas e Y modelos…" a partir dos excedentes. */
export function mensagemExcedentes(
  excedentes: ExcedenteLimite[],
  nomePlanoDestino: string
): string {
  const partes = excedentes.map(
    (e) => `${e.remover} ${ROTULO_DIMENSAO[e.dimensao]}`
  );
  const lista =
    partes.length <= 1
      ? partes.join("")
      : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
  return `Remova ${lista} para caber no plano ${nomePlanoDestino}.`;
}
