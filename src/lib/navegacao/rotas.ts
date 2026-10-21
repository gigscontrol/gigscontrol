/**
 * Fonte ÚNICA dos endereços do painel (/app/**) e dos nomes das telas.
 *
 * Tudo que monta ou lê uma URL do app passa por aqui: o roteador do layout
 * (`resolverRota`), a Sidebar (rótulos), o caminho no topo (`migalhasDaRota`),
 * o sino, a busca e os links cruzados entre fichas. Endereço montado à mão em
 * outro arquivo é o que deixava telas sem volta e links quebrados.
 *
 * Módulo PURO (sem React) — coberto por rotas.test.ts.
 */
import type { ActivePage, ActiveTab, ContatoCategoria } from "@/types";

export const BASE = "/app";

/** Abas da lista de contatos (as 3 categorias + a visão de bloqueados). */
export type AbaContatos = ContatoCategoria | "bloqueados";
const ABAS_CONTATOS: AbaContatos[] = ["contratantes", "casas", "cidades", "bloqueados"];
const CATEGORIAS_CONTATO: ContatoCategoria[] = ["contratantes", "casas", "cidades"];

/**
 * Modais que vivem POR CIMA de qualquer tela e têm endereço próprio via query
 * (`?show=<id>`, `?parcela=<id>`): F5 reabre, o voltar do navegador fecha e o
 * link pode ser mandado pra alguém.
 */
export type Sobreposicao = "show" | "parcela";

export type Rota = {
  activeTab: ActiveTab;
  activePage: ActivePage;
  configAberta: boolean;
  orcamentoId: string | null;
  vendaId: string | null;
  contratoId: string | null;
  /** Só em contatos-lista: qual aba da lista. */
  contatoAba: AbaContatos;
  /** Só em contatos-lista: ficha aberta (categoria vem de `contatoAba`). */
  contatoId: string | null;
};

function rotaBase(activeTab: ActiveTab, activePage: ActivePage): Rota {
  return {
    activeTab,
    activePage,
    configAberta: false,
    orcamentoId: null,
    vendaId: null,
    contratoId: null,
    contatoAba: "contratantes",
    contatoId: null,
  };
}

/** "/app/vendas/orcamentos/123" → ["vendas","orcamentos","123"] */
export function segmentosDoPath(pathname: string): string[] {
  return pathname
    .replace(/^\/app\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
}

/** Mapeia os segmentos da URL para aba / tela / ids. URL desconhecida → Agenda. */
export function resolverRota(seg: string[]): Rota {
  const [a, b, c, d] = seg;

  if (a === "configuracoes") {
    return { ...rotaBase("agenda", "dashboard"), configAberta: true };
  }
  if (a === "vendas") {
    if (b === "orcamentos") {
      if (!c) return rotaBase("vendas", "vendas-historico");
      if (c === "novo") return rotaBase("vendas", "vendas-novo-orcamento");
      return { ...rotaBase("vendas", "vendas-orcamento-detalhe"), orcamentoId: c };
    }
    if (b === "vendas") {
      if (!c) return rotaBase("vendas", "vendas-historico-vendas");
      if (c === "nova") return rotaBase("vendas", "vendas-nova-venda");
      if (d === "editar") return { ...rotaBase("vendas", "vendas-editar-venda"), vendaId: c };
      return { ...rotaBase("vendas", "vendas-venda-detalhe"), vendaId: c };
    }
    return rotaBase("vendas", "dashboard");
  }
  if (a === "financeiro") {
    if (b === "pagamentos") return rotaBase("financeiro", "financeiro-pagamentos");
    if (b === "cobrancas") return rotaBase("financeiro", "financeiro-cobrancas");
    return rotaBase("financeiro", "dashboard");
  }
  if (a === "contratos") {
    if (b === "novo") return rotaBase("contratos", "contratos-novo");
    if (b === "modelos") return rotaBase("contratos", "contratos-modelos");
    if (b === "historico") {
      return { ...rotaBase("contratos", "contratos-historico"), contratoId: c ?? null };
    }
    if (b === "pastas") return rotaBase("contratos", "contratos-pastas");
    return rotaBase("contratos", "dashboard");
  }
  if (a === "contatos") {
    if (b === "lista") {
      const r = rotaBase("contatos", "contatos-lista");
      if (c && (ABAS_CONTATOS as string[]).includes(c)) {
        r.contatoAba = c as AbaContatos;
        // Ficha só existe pras 3 categorias (bloqueados é uma visão, não um tipo).
        if (d && (CATEGORIAS_CONTATO as string[]).includes(c)) r.contatoId = d;
      }
      return r;
    }
    if (b === "mapa") return rotaBase("contatos", "contatos-mapa");
    return rotaBase("contatos", "dashboard");
  }
  if (a === "agencia") {
    if (b === "artistas") return rotaBase("agencia", "agencia-artistas");
    if (b === "equipe") return rotaBase("agencia", "agencia-equipe");
    return rotaBase("agencia", "dashboard");
  }
  if (a === "agenda" && b === "shows") return rotaBase("agenda", "agenda-completa");
  if (a === "agenda" && b === "anotacoes") return rotaBase("agenda", "agenda-anotacoes");
  return rotaBase("agenda", "dashboard");
}

/** Anexa query só com os valores presentes (undefined/null/"" somem). */
function comQuery(caminho: string, params: Record<string, string | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const q = sp.toString();
  return q ? `${caminho}?${q}` : caminho;
}

const enc = encodeURIComponent;

/** URL de uma tela (sem id) — usada pela Sidebar. */
export function urlDaTela(tab: ActiveTab, page: ActivePage): string {
  switch (page) {
    case "agenda-completa":
      return `${BASE}/agenda/shows`;
    case "agenda-anotacoes":
      return `${BASE}/agenda/anotacoes`;
    case "vendas-historico":
    case "vendas-orcamento-detalhe":
      return `${BASE}/vendas/orcamentos`;
    case "vendas-novo-orcamento":
      return `${BASE}/vendas/orcamentos/novo`;
    case "vendas-historico-vendas":
    case "vendas-venda-detalhe":
    case "vendas-editar-venda":
      return `${BASE}/vendas/vendas`;
    case "vendas-nova-venda":
      return `${BASE}/vendas/vendas/nova`;
    case "financeiro-pagamentos":
      return `${BASE}/financeiro/pagamentos`;
    case "financeiro-cobrancas":
      return `${BASE}/financeiro/cobrancas`;
    case "contratos-novo":
      return `${BASE}/contratos/novo`;
    case "contratos-modelos":
      return `${BASE}/contratos/modelos`;
    case "contratos-historico":
      return `${BASE}/contratos/historico`;
    case "contratos-pastas":
      return `${BASE}/contratos/pastas`;
    case "contatos-lista":
      return `${BASE}/contatos/lista`;
    case "contatos-mapa":
      return `${BASE}/contatos/mapa`;
    case "agencia-artistas":
      return `${BASE}/agencia/artistas`;
    case "agencia-equipe":
      return `${BASE}/agencia/equipe`;
    case "dashboard":
    default:
      return `${BASE}/${tab}`;
  }
}

/** Endereços de cada coisa do sistema. Use SEMPRE estes — nunca monte à mão. */
export const urls = {
  modulo: (tab: ActiveTab) => `${BASE}/${tab}`,
  orcamentos: () => `${BASE}/vendas/orcamentos`,
  orcamento: (id: string) => `${BASE}/vendas/orcamentos/${enc(id)}`,
  novoOrcamento: () => `${BASE}/vendas/orcamentos/novo`,
  vendas: () => `${BASE}/vendas/vendas`,
  venda: (id: string) => `${BASE}/vendas/vendas/${enc(id)}`,
  editarVenda: (id: string) => `${BASE}/vendas/vendas/${enc(id)}/editar`,
  /** Nova venda em branco, a partir de um orçamento, ou já num dia da agenda. */
  novaVenda: (o: { orcamento?: string | null; data?: string | null } = {}) =>
    comQuery(`${BASE}/vendas/vendas/nova`, { orcamento: o.orcamento, data: o.data }),
  contratos: (o: { status?: string | null } = {}) =>
    comQuery(`${BASE}/contratos/historico`, { status: o.status }),
  /** `assinar`: abre já rolado até o painel de assinatura (depois de gerar). */
  contrato: (id: string, o: { assinar?: boolean } = {}) =>
    comQuery(`${BASE}/contratos/historico/${enc(id)}`, { assinar: o.assinar ? "1" : null }),
  novoContrato: (o: { venda?: string | null } = {}) =>
    comQuery(`${BASE}/contratos/novo`, { venda: o.venda }),
  /** `novo`: já abre o formulário de cadastro da aba (atalhos "Novo contratante"…). */
  contatos: (aba: AbaContatos = "contratantes", o: { novo?: boolean } = {}) =>
    comQuery(
      aba === "contratantes" ? `${BASE}/contatos/lista` : `${BASE}/contatos/lista/${aba}`,
      { novo: o.novo ? "1" : null }
    ),
  contato: (categoria: ContatoCategoria, id: string) =>
    `${BASE}/contatos/lista/${categoria}/${enc(id)}`,
  pagamentos: () => `${BASE}/financeiro/pagamentos`,
  cobrancas: (o: { busca?: string | null } = {}) =>
    comQuery(`${BASE}/financeiro/cobrancas`, { busca: o.busca }),
  /** Endereço "de casa" do show (pra compartilhar / notificação): calendário + modal. */
  show: (id: string) => comQuery(`${BASE}/agenda/shows`, { show: id }),
  /** Endereço "de casa" da parcela: Pagamentos + modal da parcela. */
  parcela: (id: string) => comQuery(`${BASE}/financeiro/pagamentos`, { parcela: id }),
  configuracoes: (aba?: string | null) => comQuery(`${BASE}/configuracoes`, { aba }),
};

// ---------------- Nomes ----------------

export const ROTULO_MODULO: Record<ActiveTab, string> = {
  agenda: "Agenda",
  vendas: "Vendas",
  financeiro: "Financeiro",
  contratos: "Contratos",
  contatos: "Contatos",
  agencia: "Agência",
};

/**
 * Nome de cada tela — o MESMO no menu, no caminho do topo e no título.
 * Regra: lista = "Todos/Todas os(as) X"; criar = "Novo/Nova X".
 */
export const ROTULO_PAGINA: Record<ActivePage, string> = {
  dashboard: "Dashboard",
  "agenda-completa": "Calendário",
  "agenda-anotacoes": "Anotações",
  "vendas-novo-orcamento": "Novo orçamento",
  "vendas-historico": "Todos os orçamentos",
  "vendas-orcamento-detalhe": "Todos os orçamentos",
  "vendas-nova-venda": "Nova venda",
  "vendas-historico-vendas": "Todas as vendas",
  "vendas-venda-detalhe": "Todas as vendas",
  "vendas-editar-venda": "Todas as vendas",
  "financeiro-pagamentos": "Pagamentos",
  "financeiro-cobrancas": "Cobranças",
  "contratos-novo": "Novo contrato",
  "contratos-modelos": "Modelos",
  "contratos-historico": "Todos os contratos",
  "contratos-pastas": "Pastas",
  "contatos-lista": "Todos os contatos",
  "contatos-mapa": "Mapa",
  "agencia-artistas": "Artistas",
  "agencia-equipe": "Equipe",
};

/** Páginas de cada módulo, na ordem do menu (o "Dashboard" é o módulo em si). */
export const PAGINAS_DO_MENU: Record<ActiveTab, ActivePage[]> = {
  agenda: ["dashboard", "agenda-completa", "agenda-anotacoes"],
  vendas: [
    "dashboard",
    "vendas-novo-orcamento",
    "vendas-historico",
    "vendas-nova-venda",
    "vendas-historico-vendas",
  ],
  financeiro: ["dashboard", "financeiro-pagamentos", "financeiro-cobrancas"],
  contratos: [
    "dashboard",
    "contratos-novo",
    "contratos-historico",
    "contratos-pastas",
    "contratos-modelos",
  ],
  contatos: ["dashboard", "contatos-lista", "contatos-mapa"],
  agencia: ["dashboard", "agencia-artistas", "agencia-equipe"],
};

const ROTULO_ABA_CONTATOS: Record<AbaContatos, string> = {
  contratantes: "Contratantes",
  casas: "Casas / Eventos",
  cidades: "Cidades",
  bloqueados: "Bloqueados",
};

export const ROTULO_ABA_CONFIG: Record<string, string> = {
  perfil: "Perfil",
  agencia: "Agência",
  preferencias: "Preferências",
  plano: "Plano & Assinatura",
  lixeira: "Lixeira",
  historico: "Histórico",
  notificacoes: "Notificações",
};

/** Um passo do caminho no topo. Sem `href` = é a tela atual. */
export type Migalha = { rotulo: string; href?: string; traduzir: boolean };

/**
 * Caminho no topo ("Vendas › Todas as vendas › VND-0063"). `nomes` traz o
 * rótulo das entidades abertas (número da venda, nome do contato…) — quem
 * chama resolve pelos contexts; ausente = ainda carregando → o passo some
 * em vez de mostrar um id cru.
 */
export function migalhasDaRota(
  rota: Rota,
  opts: {
    nomes?: {
      orcamento?: string | null;
      venda?: string | null;
      contrato?: string | null;
      contato?: string | null;
      /** Orçamento de origem quando a "Nova venda" é a concretização dele. */
      orcamentoOrigem?: string | null;
    };
    abaConfig?: string | null;
    ehAdmin?: boolean;
  } = {}
): Migalha[] {
  const nomes = opts.nomes ?? {};
  if (rota.configAberta) {
    const raiz: Migalha = {
      rotulo: opts.ehAdmin === false ? "Minha conta" : "Configurações",
      href: urls.configuracoes(),
      traduzir: true,
    };
    const aba = opts.abaConfig ? ROTULO_ABA_CONFIG[opts.abaConfig] : null;
    return aba ? [raiz, { rotulo: aba, traduzir: true }] : [{ ...raiz, href: undefined }];
  }

  const out: Migalha[] = [
    { rotulo: ROTULO_MODULO[rota.activeTab], href: urls.modulo(rota.activeTab), traduzir: true },
  ];
  const p = rota.activePage;
  out.push({ rotulo: ROTULO_PAGINA[p], href: urlDaTela(rota.activeTab, p), traduzir: true });

  const ent = (rotulo: string | null | undefined, href?: string) => {
    if (rotulo) out.push({ rotulo, href, traduzir: false });
  };
  switch (p) {
    case "vendas-orcamento-detalhe":
      ent(nomes.orcamento);
      break;
    case "vendas-venda-detalhe":
      ent(nomes.venda);
      break;
    case "vendas-editar-venda":
      if (rota.vendaId) ent(nomes.venda, urls.venda(rota.vendaId));
      out.push({ rotulo: "Editar", traduzir: true });
      break;
    case "vendas-nova-venda":
      // Concretizar um orçamento: o caminho mostra de onde a venda vem.
      if (nomes.orcamentoOrigem) {
        out[out.length - 1] = { rotulo: "Concretizar venda", traduzir: true };
        ent(nomes.orcamentoOrigem);
      }
      break;
    case "contratos-historico":
      ent(nomes.contrato);
      break;
    case "contatos-lista":
      if (rota.contatoAba !== "contratantes" || rota.contatoId) {
        out.push({
          rotulo: ROTULO_ABA_CONTATOS[rota.contatoAba],
          href: urls.contatos(rota.contatoAba),
          traduzir: true,
        });
      }
      ent(nomes.contato);
      break;
  }

  // O último passo é a tela atual: sem link.
  const ultimo = out[out.length - 1];
  out[out.length - 1] = { ...ultimo, href: undefined };
  return out;
}

/**
 * Link de uma notificação. Usa o `link` gravado quando existe; senão monta pelo
 * módulo + entidade (as notificações antigas só têm isso). null = não abre nada.
 */
export function linkDaNotificacao(n: {
  link?: string | null;
  modulo?: string | null;
  entidade_id?: string | null;
}): string | null {
  if (n.link && n.link.startsWith(`${BASE}/`)) return n.link;
  const id = n.entidade_id;
  if (!id) return null;
  switch (n.modulo) {
    case "venda":
      return urls.venda(id);
    case "orcamento":
      return urls.orcamento(id);
    case "parcela":
      return urls.parcela(id);
    case "contrato":
      return urls.contrato(id);
    case "show":
      return urls.show(id);
    case "contratante":
      return urls.contato("contratantes", id);
    case "casa":
      return urls.contato("casas", id);
    case "cidade":
      return urls.contato("cidades", id);
    default:
      return null;
  }
}
