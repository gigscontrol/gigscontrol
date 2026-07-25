/**
 * GATES DE SHOW NO CLIENTE (grey-out) — espelho fiel do servidor.
 *
 * REGRA NOVA (decisão do dono, L5b): a AGENDA virou SÓ VISUALIZAÇÃO.
 * Mexer num SHOW não é mais uma capacidade de agenda — é de VENDAS. Nas chaves
 * v2 (autoria "criado por ele" × "criado por outros"):
 *
 *   criar show    → vendas.criar
 *   editar show   → dele: vendas.editar_proprios | de outros: vendas.editar_outros
 *   cancelar show → dele: vendas.cancelar_proprios | de outros: vendas.cancelar_outros
 *
 * ISTO REVOGA ACESSO DE PROPÓSITO: quem hoje tem `agenda.editar_todos` (ou
 * `agenda.criar`) e NENHUMA chave de vendas PERDE criar/editar/cancelar show.
 * É deliberado — "esse papel é apenas pra quem tem permissão de vendas".
 *
 * As chaves `agenda.criar` / `agenda.editar*` / `agenda.excluir*` CONTINUAM
 * existindo e valendo — só que agora governam exclusivamente os agenda_items
 * (voo, transporte terrestre, evento personalizado), nunca shows.
 *
 * Estes helpers são a ÚNICA fonte de verdade do cliente. O par no servidor
 * vive em `src/lib/api/permissoes.ts` (podeCriarShow/podeEditarShow/
 * podeCancelarShow, que usam `podePorAutoria`) — cliente e servidor têm que
 * dizer a MESMA coisa; o cliente nunca pode ser mais permissivo que a rota.
 */

/** Assinatura do `podeUI` do auth-context. */
export type PodeUI = (artistaId: string | null, chave: string) => boolean;

/**
 * Quem é o usuário logado em relação a ESTE show. `criadoPor` é o
 * `shows.criado_por` (exposto no `Show` pelo mapper); `meuUserId` é o id da
 * sessão. Ambos são obrigatórios porque as chaves "próprios" só valem quando
 * batem — ver `donoConfere` abaixo.
 */
export type DonoDoShow = {
  criadoPor?: string | null;
  meuUserId?: string | null;
};

/**
 * Espelho EXATO de `podePorAutoria` (src/lib/api/permissoes.ts): o eixo v2 é
 * "criado por ele" × "criado por outros" — NÃO "próprios OU escopo total".
 *
 *   criadoPor === userId → exige chaveProprios (a chave "dele");
 *   caso contrário        → exige chaveOutros  (a chave "de outros").
 *
 * O `criadoPor &&` do servidor é reproduzido de propósito: show com
 * `criado_por` NULO (linha antiga) conta como "de outros" → cai em chaveOutros.
 * Sem esta função o cliente ficava MAIS PERMISSIVO que a rota — o vendedor via
 * "Cancelar show" habilitado no show de outro vendedor e tomava 403 no clique.
 */
function podePorAutoriaShowUI(
  podeUI: PodeUI,
  artistaId: string | null,
  dono: DonoDoShow,
  chaveProprios: string,
  chaveOutros: string
): boolean {
  const ehProprio = !!dono.criadoPor && dono.criadoPor === dono.meuUserId;
  return podeUI(artistaId, ehProprio ? chaveProprios : chaveOutros);
}

/**
 * Criar show (Novo Show na agenda, nova venda direta). Não há escopo
 * "próprios" na criação — o show ainda não tem dono. Espelha `podeCriarShow`.
 */
export function podeCriarShowUI(podeUI: PodeUI, artistaId: string | null): boolean {
  return podeUI(artistaId, "vendas.criar");
}

/** Editar show (dados do evento, booking/hospedagem). Espelha `podeEditarShow`. */
export function podeEditarShowUI(
  podeUI: PodeUI,
  artistaId: string | null,
  dono: DonoDoShow = {}
): boolean {
  return podePorAutoriaShowUI(
    podeUI,
    artistaId,
    dono,
    "vendas.editar_proprios",
    "vendas.editar_outros"
  );
}

/**
 * Cancelar / reativar show. Espelha `podeCancelarShow` (autoria:
 * `cancelar_proprios` × `cancelar_outros`).
 */
export function podeCancelarShowUI(
  podeUI: PodeUI,
  artistaId: string | null,
  dono: DonoDoShow = {}
): boolean {
  return podePorAutoriaShowUI(
    podeUI,
    artistaId,
    dono,
    "vendas.cancelar_proprios",
    "vendas.cancelar_outros"
  );
}
