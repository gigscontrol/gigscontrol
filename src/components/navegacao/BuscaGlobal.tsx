"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  CalendarCheck2,
  CornerDownLeft,
  FileSignature,
  FileText,
  LayoutGrid,
  Plus,
  Search,
  User,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useNavegacao } from "../NavOverlay";
import { useVendas } from "@/lib/vendas-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useContratos } from "@/lib/contratos-context";
import { useContatos } from "@/lib/contatos-context";
import { useArtistas } from "@/lib/workspace-context";
import { useModulosVisiveis, usePaginasVisiveis } from "@/lib/navegacao/useModulos";
import {
  PAGINAS_DO_MENU,
  ROTULO_MODULO,
  ROTULO_PAGINA,
  urlDaTela,
  urls,
} from "@/lib/navegacao/rotas";
import { buscar, type ItemBusca, type TipoBusca } from "@/lib/navegacao/busca";
import { descreverContrato } from "@/lib/contratoTitulo";
import { formatarDataBR } from "@/lib/formatters";
import { STATUS_ORCAMENTO } from "@/lib/statusUI";
import { useAcoesNovo } from "./acoesNovo";
import type { ActiveTab } from "@/types";

/** Qualquer lugar do app abre a busca disparando este evento (botão da topbar, barra do celular). */
export const EVENTO_ABRIR_BUSCA = "gc:abrir-busca";
export function abrirBusca() {
  window.dispatchEvent(new Event(EVENTO_ABRIR_BUSCA));
}

const GRUPO: Record<TipoBusca, { rotulo: string; icone: LucideIcon }> = {
  acao: { rotulo: "Criar", icone: Plus },
  pagina: { rotulo: "Telas", icone: LayoutGrid },
  venda: { rotulo: "Vendas", icone: CalendarCheck2 },
  orcamento: { rotulo: "Orçamentos", icone: FileText },
  contrato: { rotulo: "Contratos", icone: FileSignature },
  contratante: { rotulo: "Contratantes", icone: User },
  casa: { rotulo: "Casas / Eventos", icone: Building2 },
};

const MODULOS: ActiveTab[] = ["agenda", "vendas", "financeiro", "contratos", "contatos", "agencia"];

/**
 * Busca geral (Ctrl+K / ⌘K): uma caixa só pra achar venda, orçamento,
 * contrato, contratante, casa ou tela — sem saber em qual lista a coisa mora.
 * Procura nos dados que a pessoa já enxerga (os contexts vêm filtrados pela
 * permissão) e só oferece telas/ações que ela consegue abrir. Não aplica o
 * filtro de artistas da barra lateral: busca é pedido explícito.
 */
export default function BuscaGlobal() {
  const t = useT();
  const [aberta, setAberta] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const { navegar } = useNavegacao();
  const podeVer = useModulosVisiveis();
  const paginasVisiveis = usePaginasVisiveis();
  const acoes = useAcoesNovo();
  const { vendas } = useVendas();
  const { orcamentos } = useOrcamentos();
  const { contratos } = useContratos();
  const { contratantes, casas, cidades } = useContatos();
  const artistas = useArtistas();

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberta((v) => !v);
      }
    };
    const abrir = () => setAberta(true);
    window.addEventListener("keydown", tecla);
    window.addEventListener(EVENTO_ABRIR_BUSCA, abrir);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener(EVENTO_ABRIR_BUSCA, abrir);
    };
  }, []);

  useEffect(() => {
    if (!aberta) return;
    setConsulta("");
    setSel(0);
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [aberta]);

  // Monta o índice só com a busca aberta (nada custa enquanto fechada).
  const itens = useMemo<ItemBusca[]>(() => {
    if (!aberta) return [];
    const nomeArtista = (id?: string | null) => (id ? artistas.find((a) => a.id === id)?.name ?? "" : "");
    const out: ItemBusca[] = [];

    for (const a of acoes) {
      out.push({
        id: `acao-${a.id}`,
        tipo: "acao",
        titulo: t(a.rotulo),
        subtitulo: t(a.descricao),
        href: a.href,
        texto: `${t(a.rotulo)} ${a.rotulo} ${t("criar")} criar novo nova`,
      });
    }

    for (const tab of MODULOS) {
      for (const page of paginasVisiveis(tab, PAGINAS_DO_MENU[tab])) {
        const mod = t(ROTULO_MODULO[tab]);
        const pag = t(ROTULO_PAGINA[page]);
        out.push({
          id: `pag-${tab}-${page}`,
          tipo: "pagina",
          titulo: page === "dashboard" ? `${mod}` : pag,
          subtitulo: page === "dashboard" ? t("Dashboard") : mod,
          href: page === "dashboard" ? urls.modulo(tab) : urlDaTela(tab, page),
          texto: `${mod} ${pag} ${ROTULO_MODULO[tab]} ${ROTULO_PAGINA[page]}`,
        });
      }
    }

    if (podeVer("vendas")) {
      for (const v of vendas) {
        const art = nomeArtista(v.artistaId);
        out.push({
          id: `venda-${v.id}`,
          tipo: "venda",
          titulo: v.nomeEvento || v.numero,
          subtitulo: [v.numero, art, formatarDataBR(v.dataShow), v.contratanteNome].filter(Boolean).join(" · "),
          href: urls.venda(v.id),
          codigo: v.numero,
          texto: [v.numero, v.nomeEvento, v.contratanteNome, v.nomeLocal, art, v.contratanteTelefone]
            .filter(Boolean)
            .join(" "),
        });
      }
      for (const o of orcamentos) {
        const contratante = contratantes.find((c) => c.id === o.contratanteId)?.nome ?? "";
        const art = nomeArtista(o.artistaId);
        out.push({
          id: `orc-${o.id}`,
          tipo: "orcamento",
          titulo: contratante ? `${o.numero} · ${contratante}` : o.numero,
          subtitulo: [art, formatarDataBR(o.dataShow), t(STATUS_ORCAMENTO[o.status]?.label ?? "")]
            .filter(Boolean)
            .join(" · "),
          href: urls.orcamento(o.id),
          codigo: o.numero,
          texto: [o.numero, contratante, art].filter(Boolean).join(" "),
        });
      }
    }

    if (podeVer("contratos")) {
      for (const c of contratos) {
        const d = descreverContrato(c, vendas, artistas);
        out.push({
          id: `ctr-${c.id}`,
          tipo: "contrato",
          titulo: d.titulo,
          subtitulo: [d.numero !== d.titulo ? d.numero : null, d.artista].filter(Boolean).join(" · "),
          href: urls.contrato(c.id),
          codigo: c.numero,
          texto: [c.numero, d.titulo, d.artista].filter(Boolean).join(" "),
        });
      }
    }

    if (podeVer("contatos")) {
      for (const c of contratantes) {
        out.push({
          id: `ct-${c.id}`,
          tipo: "contratante",
          titulo: c.nome,
          subtitulo: [c.telefone ? `+${c.telefone.replace(/\D/g, "")}` : "", c.email ?? ""]
            .filter(Boolean)
            .join(" · "),
          href: urls.contato("contratantes", c.id),
          texto: [c.nome, c.telefone, c.email, c.documento].filter(Boolean).join(" "),
        });
      }
      for (const k of casas) {
        const cid = cidades.find((x) => x.id === k.cidadeId);
        out.push({
          id: `casa-${k.id}`,
          tipo: "casa",
          titulo: k.nome,
          subtitulo: cid ? `${cid.nome}${cid.estado ? `/${cid.estado}` : ""}` : undefined,
          href: urls.contato("casas", k.id),
          texto: [k.nome, cid?.nome].filter(Boolean).join(" "),
        });
      }
    }
    return out;
  }, [aberta, acoes, paginasVisiveis, podeVer, vendas, orcamentos, contratos, contratantes, casas, cidades, artistas, t]);

  // Sem texto: atalhos (criar + telas). Com texto: os melhores de cada tipo.
  const resultados = useMemo(() => {
    if (!consulta.trim()) {
      return [
        ...itens.filter((i) => i.tipo === "acao"),
        ...itens.filter((i) => i.tipo === "pagina" && i.subtitulo === t("Dashboard")),
      ];
    }
    return buscar(itens, consulta);
  }, [itens, consulta, t]);

  // Agrupa preservando a relevância: o grupo do melhor resultado vem primeiro.
  const grupos = useMemo(() => {
    const ordem: TipoBusca[] = [];
    const por = new Map<TipoBusca, ItemBusca[]>();
    for (const r of resultados) {
      if (!por.has(r.tipo)) {
        por.set(r.tipo, []);
        ordem.push(r.tipo);
      }
      por.get(r.tipo)!.push(r);
    }
    return ordem.map((tipo) => ({ tipo, itens: por.get(tipo)! }));
  }, [resultados]);
  const plano = useMemo(() => grupos.flatMap((g) => g.itens), [grupos]);

  useEffect(() => setSel(0), [consulta]);
  useEffect(() => {
    listaRef.current
      ?.querySelector<HTMLElement>(`[data-indice="${sel}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!aberta) return null;

  const escolher = (item: ItemBusca | undefined) => {
    if (!item) return;
    setAberta(false);
    navegar(item.href);
  };

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={t("Buscar")}>
      <button
        type="button"
        aria-label={t("Fechar")}
        onClick={() => setAberta(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade"
      />
      <div
        className="relative mx-auto mt-3 w-[calc(100%-24px)] max-w-[620px] overflow-hidden rounded-xl border border-border bg-surface animate-in md:mt-[12vh]"
        style={{ boxShadow: "0 24px 60px var(--shadow-color)" }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search size={16} className="flex-shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, plano.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                escolher(plano[sel]);
              } else if (e.key === "Escape") {
                setAberta(false);
              }
            }}
            placeholder={t("Buscar venda, contratante, contrato, casa ou tela…")}
            className="h-14 flex-1 bg-transparent text-base text-primary outline-none placeholder:text-muted"
            aria-controls="busca-resultados"
            aria-activedescendant={plano[sel] ? `busca-${plano[sel].id}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[0.65rem] text-muted md:inline">Esc</kbd>
        </div>

        <div ref={listaRef} id="busca-resultados" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
          {plano.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted">
              {consulta.trim() ? t("Nada encontrado para “{q}”.", { q: consulta.trim() }) : t("Digite para buscar.")}
            </div>
          ) : (
            grupos.map((g) => {
              const G = GRUPO[g.tipo];
              return (
                <div key={g.tipo} className="mb-1">
                  <div className="px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
                    {t(G.rotulo)}
                  </div>
                  {g.itens.map((item) => {
                    const indice = plano.indexOf(item);
                    const ativo = indice === sel;
                    const Icone = G.icone;
                    return (
                      <button
                        key={item.id}
                        id={`busca-${item.id}`}
                        type="button"
                        role="option"
                        aria-selected={ativo}
                        data-indice={indice}
                        onMouseMove={() => setSel(indice)}
                        onClick={() => escolher(item)}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left"
                        style={ativo ? { backgroundColor: "var(--bg-elevated)" } : undefined}
                      >
                        <Icone size={15} className="flex-shrink-0 text-muted" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-primary">{item.titulo}</span>
                          {item.subtitulo && (
                            <span className="block truncate text-xs text-muted">{item.subtitulo}</span>
                          )}
                        </span>
                        {ativo && <CornerDownLeft size={13} className="flex-shrink-0 text-muted" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        <div className="hidden items-center gap-4 border-t border-border px-4 py-2 text-[0.7rem] text-muted md:flex">
          <span>↑↓ {t("navegar")}</span>
          <span>↵ {t("abrir")}</span>
          <span>Ctrl K {t("abre e fecha a busca")}</span>
        </div>
      </div>
    </div>
  );
}
