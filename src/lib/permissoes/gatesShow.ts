/**
 * GATES DE SHOW NO CLIENTE (grey-out) — espelho fiel do servidor.
 *
 * REGRA NOVA (decisão do dono, L5b): a AGENDA virou SÓ VISUALIZAÇÃO.
 * Mexer num SHOW não é mais uma capacidade de agenda — é de VENDAS:
 *
 *   criar show    → vendas.criar_venda        (antes: agenda.criar)
 *   editar show   → vendas.editar_venda | vendas.editar_todos
 *                                              (antes: agenda.editar_todos)
 *   cancelar show → vendas.cancelar_venda      (antes: agenda.editar_todos)
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
 * podeCancelarShow) — cliente e servidor têm que dizer a MESMA coisa; o
 * cliente nunca pode ser mais permissivo que a rota.
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
 * Espelho EXATO de `podeMutar` (src/lib/api/permissao.ts:43):
 *
 *   chaveTodos                          → passa em qualquer show;
 *   criadoPor === userId && chaveProprio → passa só no show que ELE lançou;
 *   caso contrário                       → nega.
 *
 * O `criadoPor &&` do servidor é reproduzido de propósito: show com
 * `criado_por` NULO (linha antiga) não passa pela chave "próprios" nem lá nem
 * aqui. Sem esta função o cliente ficava MAIS PERMISSIVO que a rota — o
 * vendedor via "Cancelar show" habilitado no show de outro vendedor e tomava
 * 403 no clique.
 */
function podeMutarShowUI(
  podeUI: PodeUI,
  artistaId: string | null,
  dono: DonoDoShow,
  chaveProprio: string,
  chaveTodos: string
): boolean {
  if (podeUI(artistaId, chaveTodos)) return true;
  if (dono.criadoPor && dono.criadoPor === dono.meuUserId) {
    return podeUI(artistaId, chaveProprio);
  }
  return false;
}

/**
 * Criar show (Novo Show na agenda, nova venda direta). Não há escopo
 * "próprios" na criação — o show ainda não tem dono.
 */
export function podeCriarShowUI(podeUI: PodeUI, artistaId: string | null): boolean {
  return podeUI(artistaId, "vendas.criar_venda");
}

/** Editar show (dados do evento, booking/hospedagem). */
export function podeEditarShowUI(
  podeUI: PodeUI,
  artistaId: string | null,
  dono: DonoDoShow = {}
): boolean {
  return podeMutarShowUI(
    podeUI,
    artistaId,
    dono,
    "vendas.editar_venda",
    "vendas.editar_todos"
  );
}

/**
 * Cancelar / reativar show.
 *
 * `vendas.editar_todos` é a chave de ESCOPO TOTAL porque o servidor
 * (`podeCancelarShow`) usa `podeMutar(..., "vendas.cancelar_venda",
 * "vendas.editar_todos")` — quem tem editar_todos cancela qualquer show.
 */
export function podeCancelarShowUI(
  podeUI: PodeUI,
  artistaId: string | null,
  dono: DonoDoShow = {}
): boolean {
  return podeMutarShowUI(
    podeUI,
    artistaId,
    dono,
    "vendas.cancelar_venda",
    "vendas.editar_todos"
  );
}
