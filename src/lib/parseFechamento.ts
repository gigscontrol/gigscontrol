import { CATALOGO_CAMARIM, CATALOGO_EFEITOS, CATALOGO_HOTEL } from "@/types";

/**
 * Parser do texto que o CONTRATANTE devolve (a lista de fechamento preenchida).
 * Aceita formatos bagunçados: "Nome: Bruno", "Nome:Bruno", "Nome:\nBruno",
 * com ou sem *negrito*, campos faltando (ignora), ordem variada.
 *
 * Só preenche o que o contratante completa (dados dele + do evento). NÃO mexe em
 * cachê/efeitos/camarim/hotel/logística (termos da agência). Reporta TUDO que
 * veio com valor mas não deu pra usar (`naoPreenchidos`) e os setores fora do
 * padrão (`avisos`), pra o vendedor conferir/preencher manualmente.
 */
export type CamposFechamento = {
  contratanteNome?: string;
  contratanteEmail?: string;
  contratanteDocumento?: string;
  /** Razão social — só faz sentido quando o documento é CNPJ (D2), mas o
   *  parser não sabe disso: quem decide se aplica é quem consome o resultado
   *  (o campo pertence ao DOCUMENTO, não à pessoa — D1). */
  contratanteRazaoSocial?: string;
  contratanteEndereco?: string;
  nomeEvento?: string;
  eventoInstagram?: string;
  nomeLocal?: string;
  capacidadePublico?: string;
  enderecoLocal?: string;
  dataShow?: string; // YYYY-MM-DD (só quando veio com ano)
  /** "DD/MM" — a data veio SEM ano ("17/07", "17-07", "17.07"): o form
   *  pré-preenche dia/mês e o vendedor completa o ano na mão. */
  dataShowParcial?: string;
  horario?: string; // HH:mm (início)
  horarioFim?: string; // HH:mm (término, quando veio intervalo)
  lineUp?: string[];
};

export type ResultadoParse = {
  campos: CamposFechamento;
  /** Vieram com valor mas não deu pra usar (Telefone, Data sem ano, etc.). */
  naoPreenchidos: string[];
  /** Setores da agência fora do padrão — não alterados. */
  avisos: string[];
};

type ChaveCampo = keyof CamposFechamento;

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const NOME_AMIGAVEL: Record<ChaveCampo, string> = {
  contratanteNome: "Nome",
  contratanteEmail: "E-mail",
  contratanteDocumento: "CPF/CNPJ",
  contratanteRazaoSocial: "Razão Social",
  contratanteEndereco: "Endereço",
  nomeEvento: "Evento",
  eventoInstagram: "Instagram",
  nomeLocal: "Local",
  capacidadePublico: "Capacidade",
  enderecoLocal: "Endereço do evento",
  dataShow: "Data",
  dataShowParcial: "Data (sem ano)",
  horario: "Horário",
  horarioFim: "Horário",
  lineUp: "Line-Up",
};

// Rótulos → campo. Match EXATO do rótulo (antes dos ":"), normalizado.
const ROTULOS: { key: ChaveCampo; nomes: string[] }[] = [
  { key: "nomeEvento", nomes: ["nome do evento", "evento"] },
  { key: "nomeLocal", nomes: ["nome do local", "local", "nome da casa", "casa", "balada"] },
  { key: "contratanteNome", nomes: ["nome", "nome do contratante", "nome do contratante/empresa", "contratante"] },
  { key: "contratanteEmail", nomes: ["e-mail", "email"] },
  { key: "contratanteDocumento", nomes: ["cpf/cnpj", "cpf", "cnpj", "documento", "cpf ou cnpj"] },
  // "(se cnpj)" é o rótulo que o texto modelo manda (D4) — o contratante pode
  // devolver com ou sem o parêntese; acento já cai no norm().
  { key: "contratanteRazaoSocial", nomes: ["razao social", "razao social (se cnpj)", "razao social/nome fantasia"] },
  { key: "contratanteEndereco", nomes: ["endereco do contratante/empresa", "endereco do contratante", "endereco da empresa"] },
  { key: "eventoInstagram", nomes: ["instagram", "insta"] },
  { key: "capacidadePublico", nomes: ["capacidade de publico", "capacidade", "publico", "lotacao"] },
  { key: "enderecoLocal", nomes: ["endereco", "endereco do evento", "endereco do local"] },
  { key: "dataShow", nomes: ["data", "data do evento", "data do show"] },
  { key: "horario", nomes: ["horario da apresentacao", "horario", "hora", "horario do show"] },
  { key: "lineUp", nomes: ["line-up", "line up", "lineup"] },
];

// Reconhecidos mas NUNCA preenchidos automaticamente → sempre vão pro aviso
// "confira manual" quando vierem com valor (ex.: telefone, complexo demais).
const MANUAIS: { rotulo: string; nomes: string[] }[] = [
  { rotulo: "Telefone", nomes: ["telefone", "tel", "celular", "whatsapp", "fone"] },
];

// Setores da agência — não são preenchidos pela colagem, só checados.
const SETORES: { nome: string; nomes: string[]; catalogo: readonly string[] | null }[] = [
  { nome: "Efeitos", nomes: ["efeitos"], catalogo: CATALOGO_EFEITOS },
  { nome: "Consumação/Camarim", nomes: ["consumacao/camarim", "camarim", "consumacao"], catalogo: CATALOGO_CAMARIM },
  { nome: "Hotel", nomes: ["hotel"], catalogo: CATALOGO_HOTEL },
  { nome: "Logística", nomes: ["logistica"], catalogo: null },
];

const MESES_ABREV: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

type Rotulo =
  | { tipo: "campo"; key: ChaveCampo; inline: string }
  | { tipo: "manual"; rotulo: string; inline: string }
  | { tipo: "setor"; nome: string; catalogo: readonly string[] | null; inline: string }
  | null;

// Rótulos aceitos SEM dois-pontos (D4) — a linha inteira precisa ser só o
// rótulo (senão viraria falso-positivo pegando texto solto). Hoje só "Razão
// Social" precisa disso; os demais campos seguem exigindo ":" como sempre.
const ROTULOS_SEM_DOIS_PONTOS = new Set(["razao social", "razao social (se cnpj)", "razao social/nome fantasia"]);

function classificar(linha: string): Rotulo {
  const idx = linha.indexOf(":");
  if (idx === -1) {
    const linhaN = norm(linha);
    if (ROTULOS_SEM_DOIS_PONTOS.has(linhaN)) {
      return { tipo: "campo", key: "contratanteRazaoSocial", inline: "" };
    }
    return null;
  }
  const rotuloN = norm(linha.slice(0, idx));
  const inline = linha.slice(idx + 1).trim();
  const campo = ROTULOS.find((e) => e.nomes.includes(rotuloN));
  if (campo) return { tipo: "campo", key: campo.key, inline };
  const manual = MANUAIS.find((m) => m.nomes.includes(rotuloN));
  if (manual) return { tipo: "manual", rotulo: manual.rotulo, inline };
  const setor = SETORES.find((s) => s.nomes.includes(rotuloN));
  if (setor) return { tipo: "setor", nome: setor.nome, catalogo: setor.catalogo, inline };
  return null;
}

// Linhas do PRÓPRIO template (cabeçalhos de seção + rodapé boilerplate) que
// NUNCA são valor de campo. Sem isso, um campo deixado em branco "puxa" a
// linha seguinte como valor — ex.: Endereço vazio pegando "📌 Informações do
// evento", ou o último campo pegando "OBS: Sua data só será reservada…".
const FRASES_ESTRUTURAIS = [
  "informacoes do contratante",
  "informacoes do evento",
  "apos o preenchimento",
  "sua data so sera reservada",
];
function ehEstrutural(linha: string): boolean {
  const l = linha.trim();
  if (!l) return true;
  // Cabeçalho de seção começa com emoji/pictograma (🖋️, 📌, …) — nenhum valor
  // real de campo (nome, endereço, e-mail…) começa assim.
  if (/^\p{Extended_Pictographic}/u.test(l)) return true;
  const n = norm(l);
  return FRASES_ESTRUTURAIS.some((f) => n.includes(f));
}

/** Dia/mês/ano a partir de vários formatos. `ano` ausente = veio sem ano. */
function parseData(v: string): { dia: string; mes: string; ano?: string } | null {
  const t = norm(v);
  // ISO (AAAA-MM-DD): trata ANTES da regex numérica pra não confundir ano com dia
  // (ex.: "2025-12-20" não pode virar 25/12/2020).
  const iso = t.match(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/);
  if (iso) {
    const [, ano, mes, dia] = iso;
    if (Number(mes) < 1 || Number(mes) > 12 || Number(dia) < 1 || Number(dia) > 31) return null;
    return { dia, mes, ano };
  }
  // Numérico: DD sep MM [sep AAAA|AA]. sep = / - . espaço. Ancorado (?<!\d)…(?!\d)
  // pra não casar no meio de um número maior.
  let m = t.match(/(?<!\d)(\d{1,2})\s*[/\-.\s]\s*(\d{1,2})(?:\s*[/\-.\s]\s*(\d{2,4}))?(?!\d)/);
  if (m) {
    const dia = m[1].padStart(2, "0");
    const mes = m[2].padStart(2, "0");
    if (Number(dia) < 1 || Number(dia) > 31 || Number(mes) < 1 || Number(mes) > 12) return null;
    let ano = m[3];
    if (ano && ano.length === 2) ano = `20${ano}`;
    return { dia, mes, ano };
  }
  // Mês por extenso abreviado: "18/ago", "18 ago", "18-ago" (com ano opcional).
  m = t.match(/(\d{1,2})\s*[/\-.\s]\s*([a-z]{3,})\.?(?:\s*[/\-.\s]\s*(\d{2,4}))?/);
  if (m) {
    const dia = m[1].padStart(2, "0");
    const mes = MESES_ABREV[m[2].slice(0, 3)];
    if (!mes || Number(dia) < 1 || Number(dia) > 31) return null;
    let ano = m[3];
    if (ano && ano.length === 2) ano = `20${ano}`;
    return { dia, mes, ano };
  }
  return null;
}

/** Início (+ término, quando houver intervalo) a partir do texto do horário. */
function parseHorario(v: string): { inicio: string; fim?: string } | null {
  const achados = [...v.matchAll(/(\d{1,2})\s*[:h]\s*(\d{2})/g)]
    .map((m) => ({ h: Number(m[1]), min: Number(m[2]), txt: `${m[1].padStart(2, "0")}:${m[2]}` }))
    .filter((x) => x.h <= 23 && x.min <= 59)
    .map((x) => x.txt);
  if (achados.length > 0) return { inicio: achados[0], fim: achados[1] };
  // Fallback "NNh" — coleta TODOS pra não perder o término num intervalo "22h às 4h".
  const soH = [...v.matchAll(/\b(\d{1,2})\s*h\b/gi)]
    .map((x) => Number(x[1]))
    .filter((h) => h <= 23);
  if (soH.length > 0) {
    return {
      inicio: `${String(soH[0]).padStart(2, "0")}:00`,
      fim: soH[1] !== undefined ? `${String(soH[1]).padStart(2, "0")}:00` : undefined,
    };
  }
  return null;
}

function itemEntendido(linha: string, catalogo: readonly string[]): boolean {
  const m = linha.match(/^\d+\s*x?\s*(.+)$/i);
  if (!m) return false;
  const nome = norm(m[1]);
  if (!nome) return false;
  return catalogo.some((c) => {
    const cn = norm(c);
    return cn === nome || cn.includes(nome) || nome.includes(cn);
  });
}

function logisticaEntendida(linha: string): boolean {
  const n = norm(linha);
  return /logistica aerea|aerea|translado|ida e volta|voo|passagem/.test(n) || /^\d+\s*x/.test(n);
}

export function parseFechamento(texto: string): ResultadoParse {
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\*/g, "").trim());
  const campos: CamposFechamento = {};
  const naoPreenchidos: string[] = [];
  const avisos: string[] = [];
  const addNaoPreenchido = (nome: string) => {
    if (!naoPreenchidos.includes(nome)) naoPreenchidos.push(nome);
  };

  // Valor de um campo: inline, ou (se vazio) na próxima linha não-rótulo —
  // desde que ela NÃO seja uma linha estrutural do template (cabeçalho/rodapé).
  const valorDe = (i: number, inline: string): { valor: string; ate: number } => {
    if (inline) return { valor: inline, ate: i };
    let j = i + 1;
    while (j < linhas.length && !linhas[j]) j++;
    if (j < linhas.length && !classificar(linhas[j]) && !ehEstrutural(linhas[j])) {
      return { valor: linhas[j], ate: j };
    }
    return { valor: "", ate: i };
  };

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha) continue;
    const c = classificar(linha);
    if (!c) continue;

    if (c.tipo === "setor") {
      const itens: string[] = [];
      if (c.inline) itens.push(c.inline);
      let j = i + 1;
      for (; j < linhas.length; j++) {
        const l = linhas[j];
        if (!l) continue;
        if (classificar(l) || ehEstrutural(l)) break; // não engole cabeçalho/rodapé
        itens.push(l);
      }
      i = j - 1;
      if (itens.length === 0) continue; // vazio = faltando → ignora
      const ok =
        c.catalogo === null
          ? itens.every(logisticaEntendida)
          : itens.every((it) => itemEntendido(it, c.catalogo as readonly string[]));
      if (!ok && !avisos.includes(c.nome)) avisos.push(c.nome);
      continue; // nunca altera setores da agência
    }

    if (c.tipo === "manual") {
      const { valor, ate } = valorDe(i, c.inline);
      i = ate;
      if (valor) addNaoPreenchido(c.rotulo);
      continue;
    }

    // campo simples
    const { valor, ate } = valorDe(i, c.inline);
    i = ate;
    if (!valor) continue; // vazio = faltando → ignora
    const ok = aplicar(campos, c.key, valor);
    if (!ok) addNaoPreenchido(NOME_AMIGAVEL[c.key]);
  }

  return { campos, naoPreenchidos, avisos };
}

/** Aplica o valor no campo. Retorna false quando veio valor mas não deu pra usar. */
function aplicar(campos: CamposFechamento, key: ChaveCampo, valorBruto: string): boolean {
  const v = valorBruto.trim();
  if (!v) return false;
  switch (key) {
    case "contratanteNome":
    case "contratanteEndereco":
    case "nomeEvento":
    case "nomeLocal":
    case "enderecoLocal":
      campos[key] = v;
      return true;
    case "contratanteEmail":
      if (!v.includes("@")) return false;
      campos.contratanteEmail = v.replace(/\s+/g, "");
      return true;
    case "eventoInstagram":
      campos.eventoInstagram = v.replace(/^@/, "").replace(/\s+/g, "");
      return true;
    case "contratanteDocumento": {
      const d = v.replace(/[^\d./-]/g, "");
      if (!d) return false;
      campos.contratanteDocumento = d;
      return true;
    }
    case "contratanteRazaoSocial":
      campos.contratanteRazaoSocial = v;
      return true;
    case "capacidadePublico": {
      const d = v.replace(/\D/g, "");
      if (!d) return false;
      campos.capacidadePublico = d;
      return true;
    }
    case "dataShow": {
      const p = parseData(v);
      if (!p) return false;
      if (!p.ano) {
        // Sem ano ("17/07"): entendemos dia/mês e o form pré-preenche o campo
        // pro vendedor completar só o ano.
        campos.dataShowParcial = `${p.dia}/${p.mes}`;
        return true;
      }
      campos.dataShow = `${p.ano}-${p.mes}-${p.dia}`;
      return true;
    }
    case "horario":
    case "horarioFim": {
      const h = parseHorario(v);
      if (!h) return false;
      campos.horario = h.inicio;
      if (h.fim) campos.horarioFim = h.fim;
      return true;
    }
    case "lineUp": {
      const arr = v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
      if (!arr.length) return false;
      campos.lineUp = arr;
      return true;
    }
    default:
      return false;
  }
}
