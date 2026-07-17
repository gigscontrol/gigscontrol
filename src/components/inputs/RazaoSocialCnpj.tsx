"use client";

/**
 * Busca automática da razão social a partir do CNPJ digitado.
 *
 * Dispara quando `ehCnpj` vira true (o documento fechou 14 dígitos, BR) — nunca
 * por tecla: debounce de 400ms + cache em memória por sessão, então redigitar o
 * mesmo CNPJ não gera rede nenhuma. Fora do BR / em CPF o hook fica inerte e o
 * fluxo desses casos segue idêntico ao de hoje.
 *
 * Quem sabe a resposta é o servidor (GET /api/contatos/cnpj): ele olha primeiro
 * os nossos cadastros e só então a Receita. Aqui só consumimos o contrato:
 *   200 { razaoSocial: string|null, fonte: "cadastro"|"receita"|null, situacao: string|null }
 * Qualquer falha (404, 429, timeout, offline) é NÃO-EVENTO: o campo continua
 * editável a mão e a venda nunca trava. Nada de erro na cara do dono.
 *
 * O valor achado é SUGESTÃO, nunca prisão: só preenche campo VAZIO. Se o dono
 * já digitou algo, não sobrescrevemos — apenas avisamos, discretamente, quando
 * a Receita diverge do que está no campo.
 */

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { ehCnpj, normalizarDocumento } from "@/lib/data/documentos";

export type FonteRazaoSocial = "cadastro" | "receita";

type Resposta = {
  razaoSocial: string | null;
  fonte: FonteRazaoSocial | null;
  situacao: string | null;
};

export type BuscaRazaoSocial = {
  /** Consulta em voo — vira o "buscando…" discreto no rótulo. */
  buscando: boolean;
  /** De onde veio o valor que NÓS preenchemos (null quando foi o dono que digitou). */
  fonte: FonteRazaoSocial | null;
  /** Situação cadastral do momento da consulta. Só da Receita; nunca é salva. */
  situacao: string | null;
  /**
   * Razão social ENCONTRADA (aplicada ou não) + de onde ela veio. Serve pro
   * aviso de divergência, que precisa citar a fonte certa — dizer "a Receita"
   * sobre um valor que veio do nosso cadastro seria mentira.
   */
  oficial: { razaoSocial: string; fonte: FonteRazaoSocial } | null;
  /** O dono mexeu no campo: o microtexto de origem deixa de valer. */
  aoEditarManualmente: () => void;
};

export function useRazaoSocialDoCnpj(opts: {
  pais: string;
  /** Documento como está no input (pode vir mascarado — normalizamos aqui). */
  documento: string;
  /** Valor atual do campo de razão social. */
  valor: string;
  /** Chamado só quando há o que preencher e o campo está vazio. */
  onPreencher: (razaoSocial: string) => void;
}): BuscaRazaoSocial {
  const { pais, documento, valor, onPreencher } = opts;

  // Refs pra ler o valor/callback mais recentes SEM re-disparar a busca: só o
  // CNPJ é dependência do efeito.
  const valorRef = useRef(valor);
  valorRef.current = valor;
  const onPreencherRef = useRef(onPreencher);
  onPreencherRef.current = onPreencher;

  const cacheRef = useRef<Map<string, Resposta>>(new Map());
  // Último valor que NÓS escrevemos. Enquanto o campo ainda for exatamente ele,
  // não é "digitado a mão" — então corrigir um CNPJ errado troca a razão social
  // pela da empresa certa, em vez de deixar a antiga colada no lugar.
  const nossoValorRef = useRef<string>("");

  const [buscando, setBuscando] = useState(false);
  const [fonte, setFonte] = useState<FonteRazaoSocial | null>(null);
  const [situacao, setSituacao] = useState<string | null>(null);
  const [oficial, setOficial] = useState<BuscaRazaoSocial["oficial"]>(null);

  const cnpj = ehCnpj(pais, documento) ? normalizarDocumento(pais, documento) : "";

  // CNPJ que JÁ chegou com razão social (edição de venda, cadastro existente,
  // snapshot): não temos o que buscar — a resposta já está na tela. Congelado no
  // mount de propósito; trocar o CNPJ depois volta a buscar normalmente.
  const cnpjJaResolvido = useRef<string>(cnpj && valor.trim() ? cnpj : "");

  useEffect(() => {
    // Origem, situação cadastral e valor oficial pertencem a UM CNPJ específico:
    // trocou o CNPJ, o que sabíamos do anterior morre AQUI, antes de qualquer
    // busca. Senão o microtexto "Preenchido pela Receita" (e o aviso de BAIXADA)
    // sobrevivem à troca e passam a creditar a Receita por um CNPJ que ela nunca
    // confirmou — justamente a confiança que o D7 foi feito pra produzir.
    setFonte(null);
    setSituacao(null);
    setOficial(null);

    if (!cnpj || cnpj === cnpjJaResolvido.current) {
      setBuscando(false);
      return;
    }

    // A razão social que estava na tela também era do CNPJ ANTERIOR. Se ela ainda
    // é exatamente o que NÓS escrevemos (o dono não mexeu), some com ela antes de
    // buscar: se a busca nova falhar ou não achar, o dono vê um campo VAZIO — que
    // a validação exige preencher — em vez da razão social de outra empresa colada
    // no CNPJ novo, sem aviso nenhum. O que o DONO digitou nunca é apagado (D2).
    if (valorRef.current.trim() && valorRef.current.trim() === nossoValorRef.current) {
      onPreencherRef.current("");
      // Espelha já: `aplicar` roda SÍNCRONO no caminho do cache, antes do
      // re-render atualizar o ref — sem isso o cache-hit veria o valor velho,
      // acharia que é do dono e não preencheria.
      valorRef.current = "";
      nossoValorRef.current = "";
    }

    let vivo = true;

    const aplicar = (r: Resposta) => {
      if (!vivo) return;
      setSituacao(r.fonte === "receita" ? r.situacao : null);
      setOficial(r.razaoSocial && r.fonte ? { razaoSocial: r.razaoSocial, fonte: r.fonte } : null);
      const atual = valorRef.current.trim();
      // Vazio (caso comum, sem atrito) ou ainda com o que nós mesmos pusemos:
      // preencher não atropela ninguém.
      const nossoAindaIntacto = !!atual && atual === nossoValorRef.current;
      if (r.razaoSocial && (!atual || nossoAindaIntacto)) {
        onPreencherRef.current(r.razaoSocial);
        nossoValorRef.current = r.razaoSocial;
        setFonte(r.fonte);
      } else {
        // Já tem algo digitado: respeita. A divergência (se houver) vira aviso.
        setFonte(null);
      }
    };

    const emCache = cacheRef.current.get(cnpj);
    if (emCache) {
      setBuscando(false);
      aplicar(emCache);
      return;
    }

    setBuscando(true);
    const ctrl = new AbortController();
    const tmr = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contatos/cnpj?documento=${cnpj}`, {
          signal: ctrl.signal,
          credentials: "include",
        });
        if (!res.ok) return;
        const body: unknown = await res.json();
        const r = normalizarResposta(body);
        cacheRef.current.set(cnpj, r);
        aplicar(r);
      } catch {
        // Rede caiu, abortou ou a resposta veio torta: silêncio. O campo já é
        // editável a mão e a busca é conveniência, não requisito.
      } finally {
        if (vivo) setBuscando(false);
      }
    }, 400);

    return () => {
      vivo = false;
      ctrl.abort();
      clearTimeout(tmr);
    };
  }, [cnpj]);

  return {
    buscando,
    fonte,
    situacao,
    oficial,
    aoEditarManualmente: () => {
      setFonte(null);
      // A partir daqui o texto é do dono, não nosso: ninguém mais o substitui.
      nossoValorRef.current = "";
      cnpjJaResolvido.current = cnpj;
    },
  };
}

/** Não confia no payload: campo torto vira null em vez de quebrar a tela. */
function normalizarResposta(body: unknown): Resposta {
  const b = (body ?? {}) as Record<string, unknown>;
  const razao = typeof b.razaoSocial === "string" ? b.razaoSocial.trim() : "";
  const fonte = b.fonte === "cadastro" || b.fonte === "receita" ? b.fonte : null;
  const situacao = typeof b.situacao === "string" && b.situacao.trim() ? b.situacao.trim() : null;
  return { razaoSocial: razao || null, fonte, situacao };
}

/** Rótulo com o "buscando…" discreto pendurado — o campo nunca trava. */
export function LabelRazaoSocial({ busca }: { busca: BuscaRazaoSocial }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-2">
      {t("Razão social / Nome da empresa")}
      {busca.buscando && (
        <span className="text-[0.65rem] font-normal text-muted">{t("buscando…")}</span>
      )}
    </span>
  );
}

/**
 * Microtexto abaixo do campo: de onde veio o valor (senão o dono acha que
 * digitou errado), a divergência com a Receita e a situação cadastral. Tudo
 * informativo — nada aqui bloqueia a venda.
 */
export function DicaRazaoSocial({ busca, valor }: { busca: BuscaRazaoSocial; valor: string }) {
  const t = useT();
  const inativa = !!busca.situacao && busca.situacao.toUpperCase() !== "ATIVA";
  // Achamos um valor mas o campo já tinha outro: não sobrescrevemos (D2) — só
  // contamos o que consta, e o dono decide.
  const divergente =
    !busca.fonte &&
    !!busca.oficial &&
    !!valor.trim() &&
    busca.oficial.razaoSocial.toLowerCase() !== valor.trim().toLowerCase()
      ? busca.oficial
      : null;

  if (!busca.fonte && !inativa && !divergente) return null;

  return (
    <span className="flex flex-col gap-0.5">
      {busca.fonte === "receita" && (
        <span className="text-xs text-muted">{t("Preenchido pela Receita")}</span>
      )}
      {busca.fonte === "cadastro" && (
        <span className="text-xs text-muted">{t("Preenchido de um cadastro anterior")}</span>
      )}
      {divergente && (
        <span className="text-xs text-muted">
          {divergente.fonte === "receita"
            ? t("Na Receita este CNPJ consta como “{oficial}”", { oficial: divergente.razaoSocial })
            : t("Num cadastro anterior este CNPJ consta como “{oficial}”", {
                oficial: divergente.razaoSocial,
              })}
        </span>
      )}
      {inativa && (
        <span className="text-xs text-warning">
          {t("Atenção: este CNPJ consta como {situacao} na Receita", {
            situacao: busca.situacao ?? "",
          })}
        </span>
      )}
    </span>
  );
}
