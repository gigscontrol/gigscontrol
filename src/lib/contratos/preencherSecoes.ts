/**
 * Gera os VALORES das variáveis de contrato a partir de uma venda + o artista +
 * a agência, e aplica esses valores nas seções do modelo (substituindo os
 * tokens {{...}}) para produzir o conteúdo final do contrato.
 *
 * Best-effort: o que a venda não tem (forma de pagamento, hospedagem,
 * logística, translado, cidade do evento) fica vazio para o usuário completar
 * na tela de Novo Contrato — todos os valores são editáveis lá.
 */
import type { IdiomaModelo, SecaoModelo } from "@/lib/mappers/contratoModelo";
import type { Artista, Contratante, Moeda, Parcela, Venda } from "@/types";
import { preencher } from "./variaveis";
import { cachePorExtenso, dataPorExtenso } from "./extenso";
import { formatarMoeda } from "@/lib/formatters";
import { configDocumento } from "@/lib/data/documentos";
import { ehEmailInterno } from "@/lib/email-interno";

function juntarRider(itens: string[] | undefined): string {
  return (itens ?? []).filter((s) => s.trim()).join(", ");
}

/** Duração formatada: "2h30" (h+m), "2h" (só h), "45min" (só m), "" (nada). */
function formatarTempo(horas: number | undefined, minutos: number | undefined): string {
  const h = horas ?? 0;
  const m = minutos ?? 0;
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}min`;
  return "";
}

/** Plano de parcelas legível: "1ª parcela: R$ … até DD/MM/AAAA; 2ª: …". Na
 * moeda da venda (as parcelas herdam). */
function formatarParcelas(parcelas: Parcela[] | undefined, moeda: Moeda): string {
  if (!parcelas || parcelas.length === 0) return "";
  return parcelas
    .map((p, i) => `${i + 1}ª parcela: ${formatarMoeda(p.valor, moeda)} até ${dataBR(p.dataVencimento)}`)
    .join("; ");
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
 * Monta o mapa de valores a partir da venda. `artista` vem da lista de artistas
 * (por `venda.artistaId`); `agencia` é o nome do workspace; `numero` é o número
 * do contrato que está sendo gerado.
 */
export function valoresDeVenda(opts: {
  venda: Venda;
  artista: Artista | null;
  agencia: string;
  numero: string;
  /** Idioma do modelo — dirige data_extenso e cache_extenso. Default "pt". */
  idioma?: IdiomaModelo;
  /** Cadastro do contratante — só pro fallback da razão social. */
  contratante?: Contratante | null;
}): Record<string, string> {
  const { venda, artista, agencia, numero, contratante } = opts;
  const idioma = opts.idioma ?? "pt";
  return {
    // Artista / Agência
    artista: artista?.name ?? "",
    agencia,
    artista_nome_civil: artista?.nomeLegal ?? "",
    artista_razao_social: artista?.razaoSocial ?? "",
    // A2 — hoje há UM documento no cadastro do artista (seletor CPF OU CNPJ).
    // Se um dia houver CPF E CNPJ simultâneos, o CNPJ (documentoTipo === "cnpj")
    // tem preferência; a preferência já fica codificada aqui pra esse dia — NÃO
    // adicionamos um segundo campo de documento no cadastro (fora do escopo).
    artista_documento: artista?.documento
      ? configDocumento(artista.pais).format(artista.documento)
      : "",
    // GOTCHA privacidade: pra não-admin, `artistas` do workspace vem REDIGIDO
    // (redigirArtista apaga nomeLegal/documento/razaoSocial/endereco/telefone/
    // email) → estes tokens saem vazios → o A4 imprime "Não informado". Correto.
    // E-mail sintético `@interno.gigscontrol.app` NUNCA aparece (regra do dono).
    artista_email:
      artista?.email && !ehEmailInterno(artista.email) ? artista.email : "",
    artista_endereco: artista?.endereco ?? "",
    artista_telefone: artista?.telefone ?? "",
    // Contratante (já vem denormalizado na venda)
    contratante: venda.contratanteNome ?? "",
    documento: venda.contratanteDocumento ?? "",
    razao_social: venda.contratanteRazaoSocial || contratante?.razaoSocial || "",
    email: venda.contratanteEmail ?? "",
    endereco: venda.contratanteEndereco ?? "",
    telefone: venda.contratanteTelefone ?? "",
    // Evento
    evento: venda.nomeEvento ?? "",
    local: venda.nomeLocal ?? "",
    endereco_local: venda.enderecoLocal ?? "",
    cidade: "", // nome da cidade do evento não vem direto — usuário completa
    capacidade: venda.capacidadePublico
      ? `${venda.capacidadePublico.toLocaleString("pt-BR")} pessoas`
      : "",
    data: dataBR(venda.dataShow),
    data_extenso: dataPorExtenso(venda.dataShow, idioma),
    horario: venda.horario ?? "",
    horario_fim: venda.horarioFim ?? "",
    tempo_apresentacao: formatarTempo(venda.duracaoHoras, venda.duracaoMinutos),
    // Valores (na moeda da venda — snapshot da migração 92)
    cache: typeof venda.cache === "number" ? formatarMoeda(venda.cache, venda.moeda) : "",
    cache_extenso:
      typeof venda.cache === "number" ? cachePorExtenso(venda.cache, idioma, venda.moeda) : "",
    parcelas: formatarParcelas(venda.parcelas, venda.moeda),
    "forma de pagamento": "",
    // Riders (dos dados do artista)
    "rider de camarim": juntarRider(artista?.riderCamarim),
    "rider de efeitos": juntarRider(artista?.riderEfeitos),
    "rider tecnico": juntarRider(artista?.riderTecnico),
    hospedagem: "",
    // Logística
    logistica: "",
    translado: "",
    // Contrato
    numero_contrato: numero,
    data_hoje: hojeBR(),
  };
}

/**
 * A4 — SÓ na GERAÇÃO do contrato: todo valor vazio (""/whitespace) vira
 * "Não informado" no idioma do MODELO (os 6 idiomas do app).
 * NÃO passa por t(): é conteúdo do contrato, não da UI. Tokens fora do catálogo
 * (não presentes em `valores`) continuam `{{crus}}` — `preencher()` intocado.
 * Devolve uma CÓPIA (o state de edição da página fica cru).
 */
const NAO_INFORMADO: Record<IdiomaModelo, string> = {
  pt: "Não informado",
  en: "Not provided",
  es: "No informado",
  fr: "Non renseigné",
  de: "Nicht angegeben",
  it: "Non indicato",
};

export function aplicarFallbackVazios(
  valores: Record<string, string>,
  idioma: IdiomaModelo
): Record<string, string> {
  const vazio = NAO_INFORMADO[idioma] ?? NAO_INFORMADO.pt;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(valores)) {
    out[k] = v.trim() === "" ? vazio : v;
  }
  return out;
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
