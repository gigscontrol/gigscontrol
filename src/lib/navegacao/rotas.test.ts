import { describe, it, expect } from "vitest";
import {
  resolverRota,
  segmentosDoPath,
  urls,
  urlDaTela,
  migalhasDaRota,
  linkDaNotificacao,
} from "./rotas";

const rota = (path: string) => resolverRota(segmentosDoPath(path));

describe("resolverRota", () => {
  it("telas que já existiam continuam iguais", () => {
    expect(rota("/app").activeTab).toBe("agenda");
    expect(rota("/app/vendas/vendas/abc").activePage).toBe("vendas-venda-detalhe");
    expect(rota("/app/vendas/vendas/abc").vendaId).toBe("abc");
    expect(rota("/app/vendas/vendas/abc/editar").activePage).toBe("vendas-editar-venda");
    expect(rota("/app/vendas/orcamentos/novo").activePage).toBe("vendas-novo-orcamento");
    expect(rota("/app/financeiro/cobrancas").activePage).toBe("financeiro-cobrancas");
    expect(rota("/app/qualquer/coisa").activePage).toBe("dashboard");
  });

  it("contrato tem endereço próprio", () => {
    const r = rota("/app/contratos/historico/ct-1");
    expect(r.activePage).toBe("contratos-historico");
    expect(r.contratoId).toBe("ct-1");
    expect(rota("/app/contratos/historico").contratoId).toBeNull();
  });

  it("contato tem endereço próprio (aba + ficha)", () => {
    const r = rota("/app/contatos/lista/casas/c-9");
    expect(r.activePage).toBe("contatos-lista");
    expect(r.contatoAba).toBe("casas");
    expect(r.contatoId).toBe("c-9");
    expect(rota("/app/contatos/lista").contatoAba).toBe("contratantes");
    expect(rota("/app/contatos/lista/bloqueados").contatoAba).toBe("bloqueados");
    // "bloqueados" é visão, não tipo — não abre ficha
    expect(rota("/app/contatos/lista/bloqueados/x").contatoId).toBeNull();
    // aba inválida cai na padrão
    expect(rota("/app/contatos/lista/xpto").contatoAba).toBe("contratantes");
  });

  it("configurações não fingem ser a Agenda no caminho", () => {
    const r = rota("/app/configuracoes");
    expect(r.configAberta).toBe(true);
    const m = migalhasDaRota(r, { abaConfig: "plano", ehAdmin: true });
    expect(m.map((x) => x.rotulo)).toEqual(["Configurações", "Plano & Assinatura"]);
    expect(m.some((x) => x.rotulo === "Agenda")).toBe(false);
  });
});

describe("urls", () => {
  it("monta query só com valores presentes", () => {
    expect(urls.novaVenda()).toBe("/app/vendas/vendas/nova");
    expect(urls.novaVenda({ orcamento: "o1" })).toBe("/app/vendas/vendas/nova?orcamento=o1");
    expect(urls.novaVenda({ orcamento: null, data: "2026-10-24" })).toBe(
      "/app/vendas/vendas/nova?data=2026-10-24"
    );
    expect(urls.novoContrato({ venda: "v1" })).toBe("/app/contratos/novo?venda=v1");
    expect(urls.contratos({ status: "assinado" })).toBe("/app/contratos/historico?status=assinado");
    expect(urls.contatos()).toBe("/app/contatos/lista");
    expect(urls.contatos("casas")).toBe("/app/contatos/lista/casas");
    expect(urls.show("s1")).toBe("/app/agenda/shows?show=s1");
    expect(urls.parcela("p1")).toBe("/app/financeiro/pagamentos?parcela=p1");
  });

  it("atalhos com intenção: assinar contrato e cadastrar contato", () => {
    expect(urls.contrato("c1")).toBe("/app/contratos/historico/c1");
    expect(urls.contrato("c1", { assinar: true })).toBe("/app/contratos/historico/c1?assinar=1");
    expect(urls.contatos("casas", { novo: true })).toBe("/app/contatos/lista/casas?novo=1");
    expect(urls.contatos("contratantes", { novo: true })).toBe("/app/contatos/lista?novo=1");
    // a query não atrapalha a leitura do caminho
    expect(rota("/app/contratos/historico/c1").contratoId).toBe("c1");
  });

  it("ida e volta: o que urls monta, resolverRota entende", () => {
    expect(rota(urls.contrato("x")).contratoId).toBe("x");
    expect(rota(urls.contato("cidades", "y")).contatoId).toBe("y");
    expect(rota(urls.venda("z")).vendaId).toBe("z");
    expect(rota(urls.editarVenda("z")).activePage).toBe("vendas-editar-venda");
    expect(rota(urlDaTela("financeiro", "financeiro-pagamentos")).activePage).toBe(
      "financeiro-pagamentos"
    );
  });
});

describe("migalhasDaRota", () => {
  it("venda aberta: módulo › lista › número, só o último sem link", () => {
    const m = migalhasDaRota(rota("/app/vendas/vendas/v1"), { nomes: { venda: "VND-0063" } });
    expect(m.map((x) => x.rotulo)).toEqual(["Vendas", "Todas as vendas", "VND-0063"]);
    expect(m[0].href).toBe("/app/vendas");
    expect(m[1].href).toBe("/app/vendas/vendas");
    expect(m[2].href).toBeUndefined();
  });

  it("nome da entidade ainda carregando: o passo some (nunca mostra id cru)", () => {
    const m = migalhasDaRota(rota("/app/vendas/vendas/v1"));
    expect(m.map((x) => x.rotulo)).toEqual(["Vendas", "Todas as vendas"]);
    expect(m[1].href).toBeUndefined();
  });

  it("editar venda: link de volta pra venda", () => {
    const m = migalhasDaRota(rota("/app/vendas/vendas/v1/editar"), { nomes: { venda: "VND-1" } });
    expect(m.map((x) => x.rotulo)).toEqual(["Vendas", "Todas as vendas", "VND-1", "Editar"]);
    expect(m[2].href).toBe("/app/vendas/vendas/v1");
  });

  it("concretizar orçamento mostra a origem", () => {
    const m = migalhasDaRota(rota("/app/vendas/vendas/nova"), {
      nomes: { orcamentoOrigem: "ORC-0012" },
    });
    expect(m.map((x) => x.rotulo)).toEqual(["Vendas", "Concretizar venda", "ORC-0012"]);
  });

  it("ficha de contato mostra a aba e o nome", () => {
    const m = migalhasDaRota(rota("/app/contatos/lista/casas/c1"), { nomes: { contato: "LVL Club" } });
    expect(m.map((x) => x.rotulo)).toEqual(["Contatos", "Todos os contatos", "Casas / Eventos", "LVL Club"]);
    expect(m[2].href).toBe("/app/contatos/lista/casas");
  });

  it("artista/equipe vê 'Minha conta' em vez de Configurações", () => {
    const m = migalhasDaRota(rota("/app/configuracoes"), { ehAdmin: false });
    expect(m.map((x) => x.rotulo)).toEqual(["Minha conta"]);
  });
});

describe("linkDaNotificacao", () => {
  it("monta pelo módulo + entidade quando o link gravado está vazio", () => {
    expect(linkDaNotificacao({ link: null, modulo: "venda", entidade_id: "v1" })).toBe(
      "/app/vendas/vendas/v1"
    );
    expect(linkDaNotificacao({ modulo: "orcamento", entidade_id: "o1" })).toBe(
      "/app/vendas/orcamentos/o1"
    );
    expect(linkDaNotificacao({ modulo: "parcela", entidade_id: "p1" })).toBe(
      "/app/financeiro/pagamentos?parcela=p1"
    );
  });
  it("prefere o link gravado, mas só se for interno", () => {
    expect(linkDaNotificacao({ link: "/app/contratos/historico/c1", modulo: "venda", entidade_id: "x" })).toBe(
      "/app/contratos/historico/c1"
    );
    expect(linkDaNotificacao({ link: "https://evil.example", modulo: "venda", entidade_id: "v1" })).toBe(
      "/app/vendas/vendas/v1"
    );
  });
  it("sem entidade ou módulo desconhecido não abre nada", () => {
    expect(linkDaNotificacao({ modulo: "venda" })).toBeNull();
    expect(linkDaNotificacao({ modulo: "aparencia", entidade_id: "a" })).toBeNull();
  });
});
