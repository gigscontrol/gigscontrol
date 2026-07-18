import { TEXTO_TRANSLADO, type ItemQuantidade, type LogisticaSelecao, type Moeda } from "@/types";
import { formatarMoeda } from "./formatters";

/** Dados que alimentam o texto de fechamento — subconjunto da Venda, mas aceita
 *  também o estado vivo do formulário de ConcretizarVenda (todos opcionais). */
export type DadosFechamento = {
  contratanteNome?: string;
  contratanteEmail?: string;
  contratanteTelefone?: string;
  contratanteDocumento?: string;
  /** Razão social — só se o documento for CNPJ (D2). O modelo é gerado ANTES
   *  de saber isso, então o rótulo já avisa "(se CNPJ)". */
  contratanteRazaoSocial?: string;
  contratanteEndereco?: string;
  nomeEvento?: string;
  eventoInstagram?: string;
  nomeLocal?: string;
  capacidadePublico?: number;
  enderecoLocal?: string;
  dataShow?: string;
  horario?: string;
  horarioFim?: string;
  cache?: number;
  /** Moeda da venda — o cachê é formatado nela. Ausente → BRL (caminho de ouro). */
  moeda?: Moeda;
  lineUp?: string[];
  efeitos?: ItemQuantidade[];
  camarim?: ItemQuantidade[];
  hotel?: ItemQuantidade[];
  logistica?: LogisticaSelecao;
};

/**
 * Texto "copia e cola" pro WhatsApp (Vendas — Passo 3). Preenche o que já existe
 * e deixa EM BRANCO só o que falta, pro contratante completar. Rótulos em
 * negrito com o valor na linha de baixo; cada campo separado por linha em branco.
 * Hotel e Logística só entram se houver opção selecionada. Em PT (mensagem pro
 * cliente), como o gerarTextoWhatsApp.
 */
export function textoFechamentoVenda(v: DadosFechamento): string {
  // Rótulo em negrito; o valor (quando existe) vai na linha de baixo.
  const campo = (label: string, valor?: string | number | null) => {
    const val =
      valor === undefined || valor === null || `${valor}`.trim() === "" ? "" : `${valor}`;
    return val ? `*${label}:* \n${val}` : `*${label}:* `;
  };

  // Bloco de lista (efeitos/camarim/hotel): cabeçalho em negrito + itens colados.
  // `sempreMostrar=false` → some quando não há itens (caso do Hotel).
  const blocoItens = (titulo: string, itens?: ItemQuantidade[], sempreMostrar = true) => {
    const list = (itens ?? []).filter((i) => i.qtd > 0);
    if (list.length === 0) return sempreMostrar ? `*${titulo}:* ` : null;
    return [`*${titulo}:*`, ...list.map((i) => `${i.qtd}x ${i.nome}`)].join("\n");
  };

  const contratante = [
    campo("Nome", v.contratanteNome),
    campo("E-mail", v.contratanteEmail),
    campo("Telefone", v.contratanteTelefone ? `+${v.contratanteTelefone.replace(/\D/g, "")}` : ""),
    campo("CPF/CNPJ", v.contratanteDocumento),
    // D4 — só faz sentido pra CNPJ; como o modelo é gerado antes de saber o
    // documento, o próprio rótulo deixa isso claro pro contratante.
    campo("Razão Social (se CNPJ)", v.contratanteRazaoSocial),
    campo("Endereço do contratante/empresa", v.contratanteEndereco),
  ];

  const evento = [
    campo("Nome do Evento", v.nomeEvento),
    campo("Instagram", v.eventoInstagram),
    campo("Nome do Local", v.nomeLocal),
    campo("Capacidade de público", v.capacidadePublico),
    campo("Endereço", v.enderecoLocal),
    campo("Data", fmtData(v.dataShow)),
    campo("Horário da apresentação", v.horarioFim ? `${v.horario} — ${v.horarioFim}` : v.horario),
    campo("Cachê", v.cache ? formatarMoeda(v.cache, v.moeda ?? "BRL") : ""),
    campo("Line-UP", v.lineUp && v.lineUp.length ? v.lineUp.join(", ") : ""),
  ];

  // Hotel e Logística: SÓ aparecem se tiverem opção selecionada.
  const blocoHotel = blocoItens("Hotel", v.hotel, false);
  const logLinhas: string[] = [];
  if (v.logistica) {
    if ((v.logistica.aereaQtd ?? 0) > 0) {
      logLinhas.push(`${v.logistica.aereaQtd}x Logística Aérea (Ida e Volta)`);
    }
    if (v.logistica.transladoTerrestre) logLinhas.push(TEXTO_TRANSLADO);
  }
  const blocoLogistica = logLinhas.length ? ["*Logística:*", ...logLinhas].join("\n") : null;

  // Cada item = um "parágrafo" separado por LINHA EM BRANCO (join "\n\n").
  const paragrafos = [
    "🖋️ *Informações do Contratante*",
    ...contratante,
    "📌 *Informações do evento*",
    ...evento,
    blocoItens("Efeitos", v.efeitos),
    blocoItens("Consumação/Camarim", v.camarim),
    blocoHotel,
    blocoLogistica,
    "Após o preenchimento dessas informações a sua data será agendada e em seguida você receberá todos os materiais e vídeo chamada do artista.",
    "*OBS:* Sua data só será reservada após o preenchimento total dessa lista.",
  ].filter((p): p is string => p !== null);

  return paragrafos.join("\n\n");
}

/** "YYYY-MM-DD" → DD/MM/AAAA (vazio se ausente). */
function fmtData(iso?: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
