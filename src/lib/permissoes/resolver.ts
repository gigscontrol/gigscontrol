/**
 * MOTOR DE PERMISSÕES — a fonte ÚNICA da verdade de acesso.
 *
 * Usado no SERVIDOR (segurança, nas rotas/services) E no CLIENTE (esconder/
 * desabilitar botão). A pergunta é sempre a mesma:
 *
 *   pode(ctx, artistaId, "financeiro.editar_pagamento")  ->  boolean
 *
 * Regras:
 *   - super-admin / admin  → tudo.
 *   - artista (papel)      → só o próprio artista, governado pela privacidade.
 *   - demais (operacional) → o que o VÍNCULO (usuário × artista) concede.
 *   - sem vínculo          → sem acesso (exceto admin).
 *
 * O sistema LEGADO (profiles.funcoes/escopo + fallback) foi REMOVIDO: equipe =
 * 100% vínculos por artista (membros_artista.permissoes). Operacional sem
 * vínculo no artista → negado.
 */

import { PRIVACIDADE_DJ_PADRAO, type Papel, type PrivacidadeDj } from "@/lib/permissoes";

export type CtxPermissao = {
  isSuperAdmin: boolean;
  papel: Papel;
  /** Artista dono, quando papel === "artista". */
  artistaId: string | null;
  /**
   * Privacidade do artista (papel === "artista"): o que o admin AUTORIZOU o
   * artista a ver/fazer no próprio espaço. `undefined` → usa o padrão seguro
   * (PRIVACIDADE_DJ_PADRAO: vê o próprio, NÃO muta nada).
   */
  privacidade?: PrivacidadeDj;
  /**
   * Vínculos por artista → chaves de permissão concedidas. Fonte única de
   * acesso do operacional. Pode vir vazio ({}) ou ausente → operacional é
   * negado em qualquer artista (sem fallback legado).
   */
  vinculos?: Record<string, string[]>;
  /**
   * Booleano LEGADO e GLOBAL de anotações (profiles.pode_criar_anotacoes).
   * Não participa de `pode()` (que é por-artista) — existe só para o espelho de
   * UI (`podeVerModulo`) saber que este usuário alcança Anotações mesmo sem
   * chave `anotacoes.*` em vínculo nenhum. Sem ele, ligar o filtro da Sidebar
   * TIRARIA a única porta pra /app/agenda/anotacoes de quem já trabalha lá.
   */
  podeCriarAnotacoes?: boolean;
  /**
   * É MEMBRO EXPLÍCITO de alguma pasta de anotações (regra (c) do dono:
   * "anotações que quem tem acesso colocou ele nas permissões"). Como o
   * booleano legado acima, não participa de `pode()` — serve só pro espelho de
   * UI (`podeVerAnotacoesUI`) não esconder a porta de quem o servidor
   * (`podeVerAnotacao`, regra c) deixa entrar.
   */
  temPastaCompartilhada?: boolean;
};

/**
 * O que o ARTISTA pode fazer no PRÓPRIO espaço, governado pela privacidade que
 * o admin configurou (artists.privacidade). LEITURA por padrão liberada; toda
 * MUTAÇÃO exige um switch explícito ("só se autorizado"). Sem privacidade
 * carregada → PRIVACIDADE_DJ_PADRAO (vê o próprio, não muta).
 */
function podeArtista(priv: PrivacidadeDj, chave: string): boolean {
  const [modulo, ...rest] = chave.split(".");
  const acao = rest.join(".");
  const ehLeitura = acao.startsWith("ver");
  switch (modulo) {
    case "agenda":
      // "Básico" vê dia/local/horário (agenda.ver = sempre true). O DETALHADO
      // (cachê, contato, hotel, voucher) é governado por agendaVerDetalhado.
      // Criar/editar/excluir os próprios eventos só com agendaTotal.
      if (acao === "ver_detalhado") return priv.agendaVerDetalhado;
      return ehLeitura || priv.agendaTotal;
    case "vendas": {
      // Orçamentos e vendas são governados por FLAGS INDEPENDENTES.
      const ehOrcamento = acao.includes("orcamento");
      if (ehLeitura) {
        // Leitura ESPECÍFICA de orçamentos (vendas.ver_orcamentos) → orcamentosVer.
        // A chave genérica vendas.ver (sem contexto de qual lista) mantém o
        // comportamento de hoje: libera se pode ver vendas OU orçamentos — a
        // lista combinada é filtrada no servidor.
        if (ehOrcamento) return priv.orcamentosVer;
        return priv.vendasVer || priv.orcamentosVer;
      }
      // Mutação: "orcamento" → orcamentosCriar; as demais (criar_venda,
      // editar_venda, converter, cancelar_venda, excluir_venda, editar_todos)
      // → vendasCriar.
      //
      // ⚠️ EFEITO COLATERAL DE L5b, NÃO PEDIDO PELO DONO — decisão pendente.
      // Ao mover a mutação de SHOW de `agenda.*` para `vendas.*`, o switch que
      // governa "o ARTISTA mexe no próprio show" mudou de `priv.agendaTotal`
      // para `priv.vendasCriar` sem que ninguém decidisse. Corta dos dois
      // lados: quem tem agendaTotal+vendasCriar=false PERDE cancelar/editar o
      // próprio show; quem tem vendasCriar+agendaTotal=false GANHA criar/
      // editar/cancelar/excluir. O dono falou de EQUIPE ("esse papel é apenas
      // pra quem tem permissão de vendas"), não de privacidade de artista.
      // Medido em 2026-07-18 contra o banco real: 0 artistas de 6 caem em
      // qualquer um dos dois lados — blast radius ZERO hoje, por isso a
      // correção não foi aplicada às cegas. Se o dono quiser preservar o eixo
      // antigo, `podeArtista` precisa de um caso explícito (mutação de SHOW
      // pelo artista continua em `priv.agendaTotal`).
      return ehOrcamento ? priv.orcamentosCriar : priv.vendasCriar;
    }
    case "financeiro":
      // Leitura financeira (cachês, pagamentos e taxa/líquido) = financeiroVer;
      // mutações (registrar/cancelar/editar_pagamento) = financeiroInformar.
      if (ehLeitura) return priv.financeiroVer;
      return priv.financeiroInformar; // registrar/cancelar/editar_pagamento
    case "contratos":
      // Excluir contrato é ADMIN-ONLY: o artista NUNCA exclui (nem dentro de
      // contratosCriar). criar/editar/editar_todos/cancelar = contratosCriar.
      if (acao === "excluir") return false;
      if (ehLeitura) return priv.contratosVer;
      return priv.contratosCriar;
    case "contatos":
      // Leitura governada por priv.contatos: "nenhum" nega, "proprios"/"todos"
      // liberam VER (a lista é filtrada no servidor por escopoContatosDoArtista).
      // Artista nunca MUTA contatos (não cria/edita/exclui).
      if (ehLeitura) return priv.contatos !== "nenhum";
      return false;
    case "agencia":
    default:
      return false; // artista nunca acessa agência por aqui
  }
}

/**
 * Escopo de CONTATOS (contratantes/casas) que o ARTISTA enxerga, governado por
 * `artists.privacidade.contatos` (config do admin):
 *   - "nenhum"   → não vê nenhum contato (lista vazia);
 *   - "proprios" → só os contatos ligados aos SHOWS/vendas/orçamentos DELE
 *                  (derivado por artist_id no servidor);
 *   - "todos"    → todos os contatos do workspace.
 * Sem privacidade carregada → PRIVACIDADE_DJ_PADRAO ("proprios", seguro).
 */
export function escopoContatosDoArtista(
  priv?: PrivacidadeDj
): "nenhum" | "proprios" | "todos" {
  return (priv ?? PRIVACIDADE_DJ_PADRAO).contatos;
}

/**
 * O usuário PODE fazer `chave` no `artistaId`?
 */
export function pode(ctx: CtxPermissao, artistaId: string | null, chave: string): boolean {
  if (ctx.isSuperAdmin || ctx.papel === "admin") return true;

  if (ctx.papel === "artista") {
    // Só o próprio artista, e só o que a privacidade (config do admin) autoriza.
    if (!artistaId || artistaId !== ctx.artistaId) return false;
    return podeArtista(ctx.privacidade ?? PRIVACIDADE_DJ_PADRAO, chave);
  }

  // Operacional: só o que o VÍNCULO no artista concede. Sem vínculo = negado.
  if (!artistaId) return false;
  return (ctx.vinculos?.[artistaId] ?? []).includes(chave);
}

/**
 * Quais artistas o usuário pode ALCANÇAR (opcionalmente exigindo `chave`).
 * Retorna "todos" (admin) ou a lista de artist_ids. Use pra filtrar queries
 * (.in("artist_id", ids)).
 */
export function artistasVisiveis(
  ctx: CtxPermissao,
  chave?: string
): "todos" | string[] {
  if (ctx.isSuperAdmin || ctx.papel === "admin") return "todos";
  if (ctx.papel === "artista") {
    if (!ctx.artistaId) return [];
    // Se uma chave de leitura foi exigida e a privacidade nega esse módulo,
    // o artista não alcança nem o próprio (filtro de leitura devolve zero).
    if (chave && !podeArtista(ctx.privacidade ?? PRIVACIDADE_DJ_PADRAO, chave)) {
      return [];
    }
    return [ctx.artistaId];
  }

  // Operacional: os artistas com vínculo (que concedam a chave, se exigida).
  const vinculos = ctx.vinculos ?? {};
  return Object.keys(vinculos).filter(
    (a) => !chave || (vinculos[a] ?? []).includes(chave)
  );
}

/** Açúcar: monta o ctx a partir de uma sessão do servidor. */
export function ctxDaSessao(sessao: {
  isSuperAdmin: boolean;
  papel: Papel;
  artistaId: string | null;
  vinculos?: Record<string, string[]>;
  privacidade?: PrivacidadeDj;
  podeCriarAnotacoes?: boolean;
  temPastaCompartilhada?: boolean;
}): CtxPermissao {
  return {
    isSuperAdmin: sessao.isSuperAdmin,
    papel: sessao.papel,
    artistaId: sessao.artistaId,
    privacidade: sessao.privacidade,
    vinculos: sessao.vinculos,
    podeCriarAnotacoes: sessao.podeCriarAnotacoes,
    temPastaCompartilhada: sessao.temPastaCompartilhada,
  };
}
