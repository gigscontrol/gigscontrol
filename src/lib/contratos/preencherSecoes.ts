/**
 * Gera os VALORES das variáveis de contrato a partir de uma venda + o DJ +
 * a agência, e aplica esses valores nas seções do modelo (substituindo os
 * tokens {{...}}) para produzir o conteúdo final do contrato.
 *
 * Best-effort: o que a venda não tem (forma de pagamento, hospedagem,
 * logística, translado, cidade do evento) fica vazio para o usuário completar
 * na tela de Novo Contrato — todos os valores são editáveis lá.
 */
import type { SecaoModelo } from "@/lib/mappers/contratoModelo";
import type { DJ, Venda } from "@/types";
import { preencher } from "./variaveis";
import { formatBRL } from "@/lib/contatos-stats";

function juntarRider(itens: string[] | undefined): string {
  return (itens ?? []).filter((s) => s.trim()).join(", ");
}

/** YYYY-MM-DD → DD/MM/AAAA (tolerante a vazio / formato inesperado). */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const partes = iso.slice(0, 10).split("-");
  if (partes.length !== 3) return iso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

/** Data de hoje em DD/MM/AAAA. */
export function hojeBR(): string {
  return dataBR(new Date().toISOString());
}

/**
 * Monta o mapa de valores a partir da venda. `dj` vem da lista de artistas
 * (por `venda.djId`); `agencia` é o nome do workspace; `numero` é o número
 * do contrato que está sendo gerado.
 */
export function valoresDeVenda(opts: {
  venda: Venda;
  dj: DJ | null;
  agencia: string;
  numero: string;
}): Record<string, string> {
  const { venda, dj, agencia, numero } = opts;
  return {
    // Artista / Agência
    artista: dj?.name ?? "",
    agencia,
    // Contratante (já vem denormalizado na venda)
    contratante: venda.contratanteNome ?? "",
    documento: venda.contratanteDocumento ?? "",
    endereco: venda.contratanteEndereco ?? "",
    telefone: venda.contratanteTelefone ?? "",
    // Evento
    evento: venda.nomeEvento ?? "",
    local: venda.nomeLocal ?? "",
    endereco_local: venda.enderecoLocal ?? "",
    cidade: "", // nome da cidade do evento não vem direto — usuário completa
    data: dataBR(venda.dataShow),
    horario: venda.horario ?? "",
    horario_fim: venda.horarioFim ?? "",
    // Valores
    cache: typeof venda.cache === "number" ? formatBRL(venda.cache) : "",
    "forma de pagamento": "",
    // Riders (dos dados do artista)
    "rider de camarim": juntarRider(dj?.riderCamarim),
    "rider de efeitos": juntarRider(dj?.riderEfeitos),
    "rider tecnico": juntarRider(dj?.riderTecnico),
    hospedagem: "",
    // Logística
    logistica: "",
    translado: "",
    // Contrato
    numero_contrato: numero,
    data_hoje: hojeBR(),
  };
}

/** Aplica os valores em todos os campos de texto de cada seção do modelo. */
export function preencherSecoes(
  secoes: SecaoModelo[],
  valores: Record<string, string>
): SecaoModelo[] {
  const p = (t: string) => preencher(t, valores);
  return secoes.map((s): SecaoModelo => {
    switch (s.tipo) {
      case "titulo":
        return { ...s, titulo: p(s.titulo), subtitulo: p(s.subtitulo) };
      case "partes":
        return {
          ...s,
          contratante: p(s.contratante),
          contratado: p(s.contratado),
          paragrafo: p(s.paragrafo),
        };
      case "clausula":
        return {
          ...s,
          titulo: p(s.titulo),
          itens: s.itens.map((i) => ({ ...i, texto: p(i.texto) })),
        };
      case "anexo":
        return { ...s, titulo: p(s.titulo), conteudo: p(s.conteudo) };
      case "assinaturas":
        return s; // testemunhas são manuais — nada a substituir
    }
  });
}
