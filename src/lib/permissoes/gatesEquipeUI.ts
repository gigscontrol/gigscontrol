/**
 * ESPELHO NO CLIENTE dos gates de MUTAÇÃO por autoria (api/permissoes.ts).
 *
 * REGRA DE OURO: o cliente nunca esconde MAIS do que o servidor barra. Cada
 * helper aqui reproduz, chave a chave, o gate correspondente do servidor —
 * incluindo o eixo de AUTORIA: um registro criado pelo próprio usuário
 * (`criadoPor === userId`) consulta a chave "_proprios"; de outro (ou sem autor)
 * consulta "_outros". Se um gate mudar em api/permissoes.ts, muda aqui junto.
 *
 * `podeUI(artistaId, chave)` é a função da sessão (auth-context) — mesma engine
 * (resolver.ts) do servidor. `artistaId` é SEMPRE o artista do registro; toda
 * permissão vale só para aquele artista.
 */

type PodeUI = (artistaId: string | null, chave: string) => boolean;

/** Autoria: o registro é do próprio usuário logado? (sem autor conhecido = de outros) */
function ehProprio(
  criadoPor: string | null | undefined,
  userId: string | null | undefined
): boolean {
  return !!criadoPor && !!userId && criadoPor === userId;
}

// ── VENDAS ─────────────────────────────────────────────────────────────────

/** Editar venda → vendas.editar_proprios | vendas.editar_outros (podeEditarVenda). */
export function podeEditarVendaUI(
  podeUI: PodeUI,
  artistaId: string | null,
  criadoPor: string | null | undefined,
  userId: string | null | undefined
): boolean {
  return podeUI(
    artistaId,
    ehProprio(criadoPor, userId) ? "vendas.editar_proprios" : "vendas.editar_outros"
  );
}

/** Cancelar venda → vendas.cancelar_proprios | vendas.cancelar_outros (podeCancelarVenda). */
export function podeCancelarVendaUI(
  podeUI: PodeUI,
  artistaId: string | null,
  criadoPor: string | null | undefined,
  userId: string | null | undefined
): boolean {
  return podeUI(
    artistaId,
    ehProprio(criadoPor, userId) ? "vendas.cancelar_proprios" : "vendas.cancelar_outros"
  );
}

// ── ORÇAMENTOS ───────────────────────────────────────────────────────────────

/** Editar orçamento → vendas.editar_proprios | vendas.editar_outros (podeEditarOrcamento). */
export function podeEditarOrcamentoUI(
  podeUI: PodeUI,
  artistaId: string | null,
  criadoPor: string | null | undefined,
  userId: string | null | undefined
): boolean {
  return podeUI(
    artistaId,
    ehProprio(criadoPor, userId) ? "vendas.editar_proprios" : "vendas.editar_outros"
  );
}

/**
 * Converter orçamento em venda → o PRÓPRIO usa vendas.criar; o de outro exige
 * vendas.converter_outros (podeConverterOrcamento). Quem cria orçamento pode
 * converter o que criou; converter de terceiro é permissão à parte.
 */
export function podeConverterOrcamentoUI(
  podeUI: PodeUI,
  artistaId: string | null,
  criadoPor: string | null | undefined,
  userId: string | null | undefined
): boolean {
  return podeUI(
    artistaId,
    ehProprio(criadoPor, userId) ? "vendas.criar" : "vendas.converter_outros"
  );
}

// ── FINANCEIRO (autoria via VENDA-mãe: use venda.criadoPor) ───────────────────

/** Informar/registrar pagamento → financeiro.informar_proprios | _outros (verificarMutacaoParcela "informar"). */
export function podeInformarPagamentoUI(
  podeUI: PodeUI,
  artistaId: string | null,
  criadoPor: string | null | undefined,
  userId: string | null | undefined
): boolean {
  return podeUI(
    artistaId,
    ehProprio(criadoPor, userId)
      ? "financeiro.informar_proprios"
      : "financeiro.informar_outros"
  );
}

/** Cancelar/editar pagamento → financeiro.editar_proprios | _outros (verificarMutacaoParcela "editar"). */
export function podeCancelarPagamentoUI(
  podeUI: PodeUI,
  artistaId: string | null,
  criadoPor: string | null | undefined,
  userId: string | null | undefined
): boolean {
  return podeUI(
    artistaId,
    ehProprio(criadoPor, userId)
      ? "financeiro.editar_proprios"
      : "financeiro.editar_outros"
  );
}

// ── CONTRATOS ─────────────────────────────────────────────────────────────────

/** Cancelar contrato → contratos.cancelar_proprios | _outros (podeCancelarContrato). */
export function podeCancelarContratoUI(
  podeUI: PodeUI,
  artistaId: string | null,
  criadoPor: string | null | undefined,
  userId: string | null | undefined
): boolean {
  return podeUI(
    artistaId,
    ehProprio(criadoPor, userId)
      ? "contratos.cancelar_proprios"
      : "contratos.cancelar_outros"
  );
}

// Sem eixo de autoria (a existência da chave basta — igual ao servidor):
//  - Criar venda/orçamento:  podeUI(a, "vendas.criar")
//  - Editar orçamento/venda de quem cria contrato, criar/editar contrato:
//    podeUI(a, "contratos.criar")
//  - Editar contato: podeUI(a, "contatos.editar_proprios") || (…"contatos.editar_outros")
//  - Excluir venda/orçamento/show: ADMIN-ONLY — mantêm a chave legada no podeUI.
