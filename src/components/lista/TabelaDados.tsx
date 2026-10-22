"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import LinkInterno from "../navegacao/LinkInterno";
import { ordenar, paginar, proximaOrdem, type Ordem, type Pagina, type ValorOrdenavel } from "@/lib/lista";

export type Coluna<T> = {
  chave: string;
  /** Texto do cabeçalho em português (traduzido aqui). Vazio = sem título. */
  titulo: string;
  celula: (item: T) => ReactNode;
  /** Presente = a coluna ordena ao clicar no título. */
  ordenarPor?: (item: T) => ValorOrdenavel;
  /** Datas e valores: o 1º clique já mostra do maior/mais recente. */
  decrescentePrimeiro?: boolean;
  alinhar?: "direita";
  /** Classes extras da célula (cor, truncamento, fonte). */
  classe?: string;
  estilo?: (item: T) => CSSProperties | undefined;
  /** No celular a linha vira cartão; false tira esta coluna do cartão. */
  noCelular?: boolean;
};

/**
 * LISTA PADRÃO do painel: o mesmo jeito de ver, ordenar e paginar em todas
 * as listas (vendas, orçamentos, contratos, contatos).
 *
 * - Clique no título ordena (crescente → decrescente → ordem original).
 * - Paginação com "51–100 de 132".
 * - No celular cada linha vira um CARTÃO (a 1ª coluna é o título) — a tabela
 *   espremida de 9 colunas era ilegível no telefone.
 * - Sem ordem escolhida, mantém a ordem que a tela entregou.
 */
export default function TabelaDados<T>({
  itens,
  colunas,
  chaveDe,
  onAbrir,
  hrefDe,
  acoes,
  linhaClasse,
  porPagina = 50,
  rotuloItens,
}: {
  itens: readonly T[];
  colunas: Coluna<T>[];
  chaveDe: (item: T) => string;
  /** Clique na linha (ou no cartão). */
  onAbrir?: (item: T) => void;
  /**
   * Endereço da ficha. Com ele, a 1ª coluna (o título do cartão no celular)
   * vira link de verdade: Tab + Enter abre, Ctrl/Cmd + clique e clique do
   * meio abrem em outra aba, "copiar link" funciona. Ctrl + clique em
   * qualquer ponto da linha também abre em outra aba.
   */
  hrefDe?: (item: T) => string;
  /** Botões da linha (ícones) — o clique neles não abre a linha. */
  acoes?: (item: T) => ReactNode;
  linhaClasse?: (item: T) => string;
  porPagina?: number;
  /** "vendas", "contratos"… pro rodapé "1–50 de 132 vendas". */
  rotuloItens?: string;
}) {
  const t = useT();
  const [ordem, setOrdem] = useState<Ordem>(null);
  const [pagina, setPagina] = useState(1);

  const ordenados = useMemo(() => {
    if (!ordem) return itens as T[];
    const col = colunas.find((c) => c.chave === ordem.chave);
    if (!col?.ordenarPor) return itens as T[];
    return ordenar(itens, col.ordenarPor, ordem.direcao);
  }, [itens, colunas, ordem]);

  // Mudou o tamanho da lista (busca, filtro) ou a ordem → volta pra 1ª
  // página. Pelo tamanho, não pela identidade do array: tela que entregue um
  // array novo a cada render não pode prender a paginação na página 1.
  useEffect(() => setPagina(1), [itens.length, ordem]);
  const idSeletor = useId();

  const pag = paginar(ordenados, pagina, porPagina);

  const cabecalho = (c: Coluna<T>) => {
    const ativa = ordem?.chave === c.chave;
    if (!c.ordenarPor || !c.titulo) return c.titulo ? t(c.titulo) : null;
    const Icone = !ativa ? ArrowUpDown : ordem!.direcao === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => setOrdem((o) => proximaOrdem(o, c.chave, c.decrescentePrimeiro))}
        className={`inline-flex items-center gap-1 uppercase transition-colors hover:text-primary ${
          ativa ? "text-primary" : ""
        }`}
        title={t("Ordenar por {coluna}", { coluna: t(c.titulo) })}
      >
        {t(c.titulo)}
        <Icone size={11} className={ativa ? "" : "opacity-40"} />
      </button>
    );
  };

  const ariaSort = (c: Coluna<T>): "ascending" | "descending" | "none" | undefined => {
    if (!c.ordenarPor) return undefined;
    if (ordem?.chave !== c.chave) return "none";
    return ordem.direcao === "asc" ? "ascending" : "descending";
  };

  const [titulo, ...resto] = colunas;

  // Clique na linha fora do link: abre a ficha (Ctrl/Cmd: em outra aba). O
  // clique no próprio link ou num botão da linha já foi tratado por ele.
  const clicarLinha = (e: MouseEvent, item: T) => {
    if ((e.target as HTMLElement).closest("a, button, input, select, label")) return;
    const href = hrefDe?.(item);
    if (href && (e.ctrlKey || e.metaKey || e.button === 1)) {
      window.open(href, "_blank", "noopener");
      return;
    }
    if (e.button === 0) onAbrir?.(item);
  };
  // `cartao`: no celular o link "estica" (::after cobrindo o cartão inteiro).
  // O título sozinho tinha 16 px de altura — o alvo de verdade passa a ser o
  // cartão todo, e o Ctrl/toque longo continua sendo de um link real.
  const comLink = (item: T, conteudo: ReactNode, cartao = false) =>
    hrefDe && onAbrir ? (
      <LinkInterno
        href={hrefDe(item)}
        onAbrir={() => onAbrir(item)}
        className={`block min-w-0 rounded-sm ${cartao ? "after:absolute after:inset-0 after:content-['']" : ""}`}
      >
        {conteudo}
      </LinkInterno>
    ) : (
      conteudo
    );
  const colunasCelular = resto.filter((c) => c.noCelular !== false && c.titulo);
  const ordenaveis = colunas.filter((c) => c.ordenarPor && c.titulo);

  return (
    <>
      {/* Computador: tabela */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/40">
              {colunas.map((c) => (
                <th
                  key={c.chave}
                  aria-sort={ariaSort(c)}
                  className={`px-4 py-3 stat-label font-semibold whitespace-nowrap ${
                    c.alinhar === "direita" ? "text-right" : "text-left"
                  }`}
                >
                  {cabecalho(c)}
                </th>
              ))}
              {acoes && <th className="w-[1%] px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {pag.itens.map((item) => (
              <tr
                key={chaveDe(item)}
                onClick={onAbrir ? (e) => clicarLinha(e, item) : undefined}
                onAuxClick={onAbrir ? (e) => clicarLinha(e, item) : undefined}
                className={`border-b border-border last:border-0 transition-colors ${
                  onAbrir ? "cursor-pointer hover:bg-elevated/40" : ""
                } ${linhaClasse?.(item) ?? ""}`}
              >
                {colunas.map((c) => {
                  // `max-w-*` e `truncate` não valem num <td> (a célula estica até
                  // caber o texto e a tabela alarga): vão numa div dentro dela.
                  const partes = (c.classe ?? "").split(/\s+/).filter(Boolean);
                  const corte = partes.filter((x) => x === "truncate" || x.startsWith("max-w-")).join(" ");
                  const resto = partes.filter((x) => x !== "truncate" && !x.startsWith("max-w-")).join(" ");
                  const valor = c.celula(item);
                  const conteudo = c === titulo ? comLink(item, valor) : valor;
                  return (
                    <td
                      key={c.chave}
                      className={`px-4 py-3 align-middle ${c.alinhar === "direita" ? "text-right" : ""} ${resto}`}
                      style={c.estilo?.(item)}
                    >
                      {corte ? (
                        <div className={corte} title={typeof valor === "string" ? valor : undefined}>
                          {conteudo}
                        </div>
                      ) : (
                        conteudo
                      )}
                    </td>
                  );
                })}
                {acoes && (
                  <td className="px-4 py-3 align-middle">
                    <div
                      className="flex items-center justify-end gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {acoes(item)}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Celular: cartões (+ ordenar por um seletor, já que não há cabeçalho) */}
      <div className="md:hidden">
        {ordenaveis.length > 0 && (
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs text-muted">
            <label htmlFor={idSeletor}>{t("Ordenar por")}</label>
            <select
              id={idSeletor}
              value={ordem ? `${ordem.chave}:${ordem.direcao}` : ""}
              onChange={(e) => {
                const [chave, direcao] = e.target.value.split(":");
                setOrdem(chave ? { chave, direcao: direcao as "asc" | "desc" } : null);
              }}
              className="campo-input h-8 w-auto flex-1 py-0 text-xs"
            >
              <option value="">{t("Padrão")}</option>
              {ordenaveis.map((c) => (
                <optgroup key={c.chave} label={t(c.titulo)}>
                  <option value={`${c.chave}:${c.decrescentePrimeiro ? "desc" : "asc"}`}>
                    {t(c.titulo)} {c.decrescentePrimeiro ? "↓" : "↑"}
                  </option>
                  <option value={`${c.chave}:${c.decrescentePrimeiro ? "asc" : "desc"}`}>
                    {t(c.titulo)} {c.decrescentePrimeiro ? "↑" : "↓"}
                  </option>
                </optgroup>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col">
          {pag.itens.map((item) => (
            <div
              key={chaveDe(item)}
              onClick={onAbrir ? (e) => clicarLinha(e, item) : undefined}
              className={`relative flex flex-col gap-1.5 border-b border-border px-4 py-3 last:border-0 ${
                onAbrir ? "cursor-pointer active:bg-elevated/40" : ""
              } ${linhaClasse?.(item) ?? ""}`}
            >
              <div className={`text-sm font-semibold text-primary ${titulo.classe ?? ""}`} style={titulo.estilo?.(item)}>
                {comLink(item, titulo.celula(item), true)}
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                {colunasCelular.map((c) => (
                  <div key={c.chave} className="contents">
                    <dt className="text-muted">{t(c.titulo)}</dt>
                    <dd className="m-0 min-w-0 text-secondary">{c.celula(item)}</dd>
                  </div>
                ))}
              </dl>
              {acoes && (
                // Acima do link esticado: as ações continuam recebendo o toque.
                <div className="relative z-10 flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                  {acoes(item)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Paginacao pag={pag} porPagina={porPagina} rotuloItens={rotuloItens} onPagina={setPagina} />
    </>
  );
}

/** Rodapé "51–100 de 132 · ‹ Anterior · Página 2 de 3 · Próxima ›". Some com 1 página só. */
export function Paginacao({
  pag,
  porPagina,
  rotuloItens,
  onPagina,
}: {
  pag: Pagina<unknown>;
  porPagina: number;
  rotuloItens?: string;
  onPagina: (p: number) => void;
}) {
  const t = useT();
  if (pag.total <= porPagina) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted">
      <span className="tabular-nums">
        {t("{ini}–{fim} de {total}", { ini: pag.inicio, fim: pag.fim, total: pag.total })}
        {rotuloItens ? ` ${t(rotuloItens)}` : ""}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPagina(pag.pagina - 1)}
          disabled={pag.pagina <= 1}
          className="btn-ghost inline-flex items-center gap-1 rounded px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={14} />
          {t("Anterior")}
        </button>
        <span className="px-2 tabular-nums">
          {t("Página {p} de {n}", { p: pag.pagina, n: pag.totalPaginas })}
        </span>
        <button
          type="button"
          onClick={() => onPagina(pag.pagina + 1)}
          disabled={pag.pagina >= pag.totalPaginas}
          className="btn-ghost inline-flex items-center gap-1 rounded px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("Próxima")}
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
