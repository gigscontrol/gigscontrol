import type { Orcamento, Contratante, Casa, Cidade, Artista } from "@/types";
import { formatarMoeda } from "./formatters";
import { linhasLogistica } from "./logisticaTexto";

export function formatarDuracao(horas: number, minutos: number): string {
  const h = Math.max(0, horas);
  const m = Math.max(0, minutos);
  if (h === 0 && m === 0) return "1 hora";
  if (h === 0) return `${m} minutos`;
  if (m === 0) return h === 1 ? "1 hora" : `${h} horas`;
  const partHoras = h === 1 ? "1 hora" : `${h} horas`;
  return `${partHoras} e ${m} minutos`;
}

/**
 * Gera o texto do orçamento.
 * - Asteriscos viram negrito no WhatsApp.
 * - Seções com 0 itens são suprimidas.
 * - Logística: se nada selecionado → "Já inclusa do cachê".
 *              Caso contrário → lista as opções selecionadas.
 */
export function gerarTextoWhatsApp(
  orc: Orcamento,
  ctx: {
    contratante?: Contratante;
    casa?: Casa;
    cidade?: Cidade;
    artista?: Artista;
  }
): string {
  const cidadeNome = ctx.cidade?.nome ?? "—";
  const artistaNome = ctx.artista?.name ?? "—";
  const valor = formatarMoeda(orc.valorCache, orc.moeda);
  const duracao = formatarDuracao(orc.duracaoHoras, orc.duracaoMinutos ?? 0);

  const linhas: string[] = [];
  linhas.push(`*Valores de cachê ${cidadeNome}*`);
  linhas.push("");
  linhas.push(`*${artistaNome}*`);
  linhas.push(`${valor} por ${duracao} de show.`);

  const camarim = orc.camarim.filter((i) => i.qtd > 0);
  if (camarim.length > 0) {
    linhas.push("");
    linhas.push("*Rider de Camarim (não incluso no cachê)*");
    camarim.forEach((i) => linhas.push(`${i.qtd}x ${i.nome}`));
  }

  const efeitos = orc.efeitos.filter((i) => i.qtd > 0);
  if (efeitos.length > 0) {
    linhas.push("");
    linhas.push("*Rider de Efeitos (não incluso no cachê)*");
    efeitos.forEach((i) => linhas.push(`${i.qtd}x ${i.nome}`));
  }

  const tecnico = orc.tecnico.filter((i) => i.qtd > 0);
  if (tecnico.length > 0) {
    linhas.push("");
    linhas.push("*Rider Técnico (não incluso no cachê)*");
    tecnico.forEach((i) => linhas.push(`${i.qtd}x ${i.nome}`));
  }

  const hotel = orc.hotel.filter((i) => i.qtd > 0);
  if (hotel.length > 0) {
    linhas.push("");
    linhas.push("*Hotel (não incluso no cachê)*");
    hotel.forEach((i) => linhas.push(`${i.qtd}x ${i.nome}`));
  }

  // ----- Logística ----- (aéreas ida/volta + aeroportos + bagagens + translado)
  const logistica = linhasLogistica(orc.logistica);
  if (logistica.length === 0) {
    // Nada selecionado = inclusa no cachê
    linhas.push("");
    linhas.push("*Logistica*");
    linhas.push("Já inclusa do cachê");
  } else {
    linhas.push("");
    linhas.push("*Logistica (não incluso no cachê)*");
    logistica.forEach((l) => linhas.push(l));
  }

  // Informações extras opcionais — texto livre do admin. Vai antes do
  // código pra que o contratante leia antes do "tracking number".
  if (orc.infoExtra && orc.infoExtra.trim()) {
    linhas.push("");
    linhas.push("*Informações extras*");
    linhas.push(orc.infoExtra.trim());
  }

  // Código discreto no fim (sem itálico)
  linhas.push("");
  linhas.push(orc.numero);

  return linhas.join("\n");
}

export function normalizarTelefoneWA(telefoneBruto: string): string {
  const apenasNumeros = telefoneBruto.replace(/\D/g, "");
  if (apenasNumeros.length === 0) return "";
  if (apenasNumeros.startsWith("55") && (apenasNumeros.length === 12 || apenasNumeros.length === 13)) {
    return apenasNumeros;
  }
  return `55${apenasNumeros}`;
}

export function montarLinkWhatsApp(telefone: string, texto: string): string {
  const tel = normalizarTelefoneWA(telefone);
  const txt = encodeURIComponent(texto);
  return `https://wa.me/${tel}?text=${txt}`;
}

/** Moeda detalhada (2 casas). Delega no formatador único. */
export const formatBRL = (v: number) => formatarMoeda(v, "BRL", 2);
