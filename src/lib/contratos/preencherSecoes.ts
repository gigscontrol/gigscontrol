/**
 * Gera os VALORES das variáveis de contrato a partir de uma venda + o artista +
 * a agência, e aplica esses valores nas seções do modelo (substituindo os
 * tokens {{...}}) para produzir o conteúdo final do contrato.
 *
 * Riders/hospedagem/logística vêm da SELEÇÃO DA VENDA; sem nada selecionado,
 * caem no texto de praxe do idioma do modelo ("já inclusa no cachê" / "Sem
 * efeitos"…). O que a venda não tem (translado, cidade do evento) fica vazio
 * para o usuário completar na tela de Novo Contrato — tudo é editável lá.
 */
import type { IdiomaModelo, SecaoModelo } from "@/lib/mappers/contratoModelo";
import type {
  Artista,
  Contratante,
  ItemQuantidade,
  Moeda,
  Parcela,
  Venda,
} from "@/types";
import { linhasLogistica, temLogistica } from "@/lib/logisticaTexto";
import { pluralizarItemHotel } from "@/lib/quantidades";
import { preencher } from "./variaveis";
import { cachePorExtenso, dataPorExtenso, formatarQuantidade } from "./extenso";
import { formatarMoeda } from "@/lib/formatters";
import { configDocumento } from "@/lib/data/documentos";
import { ehEmailInterno } from "@/lib/email-interno";

function juntarRider(itens: string[] | undefined): string {
  return (itens ?? []).filter((s) => s.trim()).join(", ");
}

/**
 * CPF (11 dígitos) / CNPJ (14) com máscara. Só mascara quando o valor é
 * numérico no padrão BR — documento estrangeiro/atípico passa intacto.
 */
function mascararDocBr(doc: string | null | undefined): string {
  const v = (doc ?? "").trim();
  if (!/^[\d.\-/ ]+$/.test(v)) return v;
  const d = v.replace(/\D/g, "");
  if (d.length === 11)
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return v;
}

/** Itens SELECIONADOS na venda (qtd > 0) → "01 (um) Whisky, 12 (doze) Água". */
function juntarSelecao(
  itens: ItemQuantidade[] | undefined,
  idioma: IdiomaModelo,
  nomeFmt: (i: ItemQuantidade) => string = (i) => i.nome
): string {
  return (itens ?? [])
    .filter((i) => i.qtd > 0 && i.nome.trim())
    .map((i) => `${formatarQuantidade(i.qtd, idioma)} ${nomeFmt(i)}`)
    .join(", ");
}

/**
 * Fallbacks de CONTEÚDO (pedido do dono, 04/09/2026): quando a venda/cadastro
 * não traz nada, o contrato não sai com "Não informado" nesses campos — sai
 * com o texto de praxe, no idioma do MODELO. Editável na tela de Novo
 * Contrato como qualquer valor.
 */
const FALLBACK_CONTEUDO: Record<
  IdiomaModelo,
  { hospedagem: string; logistica: string; efeitos: string; camarim: string }
> = {
  pt: {
    hospedagem: "Hospedagem já inclusa no cachê",
    logistica: "Logística já inclusa no cachê",
    efeitos: "Sem efeitos",
    camarim: "Sem rider de camarim",
  },
  en: {
    hospedagem: "Accommodation already included in the fee",
    logistica: "Logistics already included in the fee",
    efeitos: "No special effects",
    camarim: "No hospitality rider",
  },
  es: {
    hospedagem: "Alojamiento ya incluido en el caché",
    logistica: "Logística ya incluida en el caché",
    efeitos: "Sin efectos",
    camarim: "Sin rider de camerino",
  },
  fr: {
    hospedagem: "Hébergement déjà inclus dans le cachet",
    logistica: "Logistique déjà incluse dans le cachet",
    efeitos: "Sans effets",
    camarim: "Sans rider loge",
  },
  de: {
    hospedagem: "Unterkunft bereits in der Gage enthalten",
    logistica: "Logistik bereits in der Gage enthalten",
    efeitos: "Keine Effekte",
    camarim: "Kein Hospitality-Rider",
  },
  it: {
    hospedagem: "Alloggio già incluso nel cachet",
    logistica: "Logistica già inclusa nel cachet",
    efeitos: "Nessun effetto",
    camarim: "Nessun rider camerino",
  },
};

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
    // CPF/CNPJ com máscara (109.293.599-17) — documento estrangeiro/fora do
    // padrão passa como está.
    documento: mascararDocBr(venda.contratanteDocumento),
    // Sem razão social (pessoa física) → cai no NOME do contratante, nunca
    // num "Não informado" no meio da qualificação das partes.
    razao_social:
      venda.contratanteRazaoSocial ||
      contratante?.razaoSocial ||
      venda.contratanteNome ||
      "",
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
    // Chave PIX do cadastro do artista (substituiu "forma de pagamento";
    // o token antigo é apelido desta — ver variaveis.ts). Redigida pra
    // não-admin → sai "Não informado", igual aos demais dados do artista.
    chave_pix_artista: artista?.pix ?? "",
    // Riders/hospedagem: o que foi SELECIONADO NA VENDA (qtd > 0). Nada
    // selecionado cai no texto de praxe do idioma do modelo.
    "rider de camarim":
      juntarSelecao(venda.camarim, idioma) || FALLBACK_CONTEUDO[idioma].camarim,
    "rider de efeitos":
      juntarSelecao(venda.efeitos, idioma) || FALLBACK_CONTEUDO[idioma].efeitos,
    // Técnico: seleção da venda; venda antiga sem snapshot cai no cadastro.
    "rider tecnico":
      juntarSelecao(venda.tecnico, idioma) || juntarRider(artista?.riderTecnico),
    hospedagem:
      juntarSelecao(venda.hotel, idioma, (i) => pluralizarItemHotel(i.nome, i.qtd)) ||
      FALLBACK_CONTEUDO[idioma].hospedagem,
    // Logística selecionada na venda (aéreas/bagagens/translado) — nada
    // marcado = já inclusa no cachê (mesma regra do resto do app).
    logistica: venda.logistica && temLogistica(venda.logistica)
      ? linhasLogistica(venda.logistica, "contrato").join("; ")
      : FALLBACK_CONTEUDO[idioma].logistica,
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
          titulo: p(s.titulo),
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
      case "localdata":
        // Data do dia CONGELADA na geração (o snapshot do contrato guarda o
        // valor resolvido — não muda quando o documento for reaberto).
        return { ...s, local: p(s.local), data: p("{{data_hoje}}") };
      case "assinaturas": {
        // Nomes/documento dos blocos RESOLVIDOS aqui (o render do contrato
        // gerado não tem transformarTexto — sem isto os tokens saíam crus
        // nas linhas de assinatura). Testemunhas seguem manuais.
        // Contratado assina como "Nome civil (Nome artístico)" + documento.
        const util = (v: string): string =>
          !v ||
          /^\{\{.+\}\}$/.test(v.trim()) ||
          Object.values(NAO_INFORMADO).includes(v)
            ? ""
            : v;
        const civil = util(p("{{artista_nome_civil}}"));
        const artistico = util(p("{{artista}}"));
        const contratadoNome =
          civil && civil !== artistico
            ? `${civil}${artistico ? ` (${artistico})` : ""}`
            : artistico;
        return {
          ...s,
          contratanteNome: p("{{contratante}}"),
          contratanteDoc: p("{{documento}}"),
          contratadoNome,
          contratadoDoc: util(p("{{artista_documento}}")),
        };
      }
    }
  });
}
