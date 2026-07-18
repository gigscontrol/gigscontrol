import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { autenticarComWorkspace } from "@/lib/api/session";
import { verificarAcessoContatos } from "@/lib/api/permissoes";
import { respostaDeErro } from "@/lib/api/erros";
import { consultarCnpjNaReceita } from "@/lib/cnpj-receita";
import type { DocumentoContratante } from "@/types";

export type RespostaCnpj = {
  razaoSocial: string | null;
  fonte: "cadastro" | "receita" | null;
  /** Situação cadastral do MOMENTO da consulta — só quando fonte="receita". */
  situacao: string | null;
};

const VAZIO: RespostaCnpj = { razaoSocial: null, fonte: null, situacao: null };

/**
 * GET /api/contatos/cnpj?documento=<14 dígitos>
 *
 * Descobre a RAZÃO SOCIAL de um CNPJ digitado, em camadas — igual o geocode
 * (endereço → Nominatim → centroide):
 *
 *   1. NOSSO BANCO: o CNPJ já aparece em algum contratante do workspace? Então
 *      já sabemos — de graça, sem rede. Os documentos acumulam (migração 90/91),
 *      então essa base cresce sozinha e é o cache natural. Ela também vence a
 *      Receita de propósito: a razão que o dono já usou num contrato anterior
 *      vale mais que a oficial.
 *   2. RECEITA (BrasilAPI): não conhecemos → busca a razão social oficial.
 *   3. Não achou / API fora → 200 com razaoSocial:null. NUNCA 404, nunca erro:
 *      pro front isso é um não-evento e o campo segue editável a mão.
 *
 * Por que no servidor e não no browser: pra não expor o app a CORS/rate-limit
 * por IP do usuário, pra cachear a chamada externa, e porque a camada 1 precisa
 * do RLS da sessão.
 *
 * NÃO é um consultor aberto de CNPJ: exige sessão e só passa 14 dígitos adiante
 * (senão viraria um scanner da Receita hospedado por nós).
 */
export async function GET(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  // Artista NÃO é barrado aqui — espelha o /existe (contratantes/existe/route.ts:24):
  // ele monta venda e precisa do mesmo auxílio de preenchimento. Não vira browse:
  // sem o CNPJ exato na mão, não devolve nada.
  if (r.sessao.papel !== "artista") {
    const g = verificarAcessoContatos(r.sessao);
    if (g) return g;
  }

  const url = new URL(request.url);
  const documento = (url.searchParams.get("documento") ?? "").replace(/\D/g, "");
  // ANTI-SCANNER: valida ANTES de tocar em qualquer coisa. Só CNPJ completo passa
  // — CPF (11 dígitos), prefixo incompleto ou lixo saem em 200 vazio, sem rede.
  if (!/^\d{14}$/.test(documento)) {
    return NextResponse.json(VAZIO);
  }

  try {
    // ── Camada 1: nossos próprios cadastros ────────────────────────────────
    const doCadastro = await razaoSocialDoCadastro(r.sessao.supabase, documento);
    if (doCadastro) {
      return NextResponse.json({
        razaoSocial: doCadastro,
        fonte: "cadastro",
        situacao: null,
      } satisfies RespostaCnpj);
    }

    // ── Camada 2: Receita ──────────────────────────────────────────────────
    const daReceita = await consultarCnpjNaReceita(documento);
    if (daReceita) {
      return NextResponse.json({
        razaoSocial: daReceita.razaoSocial,
        fonte: "receita",
        situacao: daReceita.situacao,
      } satisfies RespostaCnpj);
    }

    // ── Camada 3: não sabemos. Não é erro. ─────────────────────────────────
    return NextResponse.json(VAZIO);
  } catch (e) {
    return respostaDeErro(e, "Falha ao buscar a razão social.");
  }
}

/**
 * Camada 1 — o CNPJ já é conhecido pelo workspace?
 *
 * Duas tentativas, da mais barata pra mais cara (o RLS escopa por tenant sozinho):
 *   a) `documento` = o principal do contratante → `razao_social` da coluna.
 *   b) o histórico `documentos` (jsonb) → a razão social DAQUELE item.
 *
 * O `@>` do jsonb casa objeto parcial, então `[{documento: X}]` acha o item
 * independente da razão/datas; a extração do campo é em JS (não há índice GIN em
 * `documentos`, e a varredura é sobre as poucas linhas do tenant — mesmo estilo
 * do casas/parecidas).
 */
async function razaoSocialDoCadastro(
  supabase: SupabaseClient,
  documento: string
): Promise<string | null> {
  const principal = await supabase
    .from("contratantes")
    .select("razao_social")
    .eq("documento", documento)
    .not("razao_social", "is", null)
    .is("deletado_em", null)
    .limit(1);
  if (principal.error) throw principal.error;
  const razaoPrincipal = (principal.data ?? [])[0]?.razao_social;
  if (typeof razaoPrincipal === "string" && razaoPrincipal.trim()) {
    return razaoPrincipal.trim();
  }

  // ⚠️ `contains` com ARRAY JS vira `cs.{[object Object]}` no postgrest-js (ele
  // faz value.join(",")) e não casaria nada em silêncio. Pra jsonb, mande a
  // STRING JSON — aí ele emite `cs.[{"documento":"…"}]`, que é o `@>` de verdade.
  // Interpolar aqui é seguro: o `documento` já passou pelo /^\d{14}$/ da rota.
  const historico = await supabase
    .from("contratantes")
    .select("documentos")
    .contains("documentos", JSON.stringify([{ documento }]))
    .is("deletado_em", null)
    .limit(5);
  if (historico.error) throw historico.error;
  for (const linha of historico.data ?? []) {
    const docs = (linha.documentos ?? []) as DocumentoContratante[];
    const item = docs.find((d) => d?.documento === documento);
    const razao = item?.razao_social;
    if (typeof razao === "string" && razao.trim()) return razao.trim();
  }
  return null;
}
