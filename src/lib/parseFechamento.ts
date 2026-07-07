import { CATALOGO_CAMARIM, CATALOGO_EFEITOS, CATALOGO_HOTEL } from "@/types";

/**
 * Parser do texto que o CONTRATANTE devolve (a lista de fechamento preenchida).
 * Aceita formatos bagunçados: "Nome: Bruno", "Nome:Bruno", "Nome:\nBruno",
 * com ou sem *negrito*, campos faltando (ignora), ordem variada.
 *
 * Só preenche os campos que o contratante completa (dados dele + do evento).
 * NÃO mexe em Cachê/Efeitos/Camarim/Hotel/Logística (termos da agência). Se
 * algum desses setores vier com conteúdo que não dá pra entender, devolve um
 * aviso (o chamador mostra "não segue o padrão em X — não alterado").
 */
export type CamposFechamento = {
  contratanteNome?: string;
  contratanteEmail?: string;
  contratanteDocumento?: string;
  contratanteEndereco?: string;
  nomeEvento?: string;
  eventoInstagram?: string;
  nomeLocal?: string;
  capacidadePublico?: string;
  enderecoLocal?: string;
  dataShow?: string; // YYYY-MM-DD
  horario?: string; // HH:mm
  lineUp?: string[];
};

export type ResultadoParse = {
  campos: CamposFechamento;
  /** Setores que vieram mas não deram pra entender (não foram alterados). */
  avisos: string[];
};

type ChaveCampo = keyof CamposFechamento;

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Rótulos aceitos → campo. Match EXATO do rótulo (antes dos ":"), normalizado,
// então "nome" não colide com "nome do evento". Ordem não importa (match exato).
const ROTULOS: { key: ChaveCampo; nomes: string[] }[] = [
  { key: "nomeEvento", nomes: ["nome do evento", "evento"] },
  { key: "nomeLocal", nomes: ["nome do local", "local", "nome da casa", "casa", "balada"] },
  { key: "contratanteNome", nomes: ["nome", "nome do contratante", "nome do contratante/empresa", "contratante"] },
  { key: "contratanteEmail", nomes: ["e-mail", "email"] },
  { key: "contratanteDocumento", nomes: ["cpf/cnpj", "cpf", "cnpj", "documento", "cpf ou cnpj"] },
  { key: "contratanteEndereco", nomes: ["endereco do contratante/empresa", "endereco do contratante", "endereco da empresa"] },
  { key: "eventoInstagram", nomes: ["instagram", "insta"] },
  { key: "capacidadePublico", nomes: ["capacidade de publico", "capacidade", "publico", "lotacao"] },
  { key: "enderecoLocal", nomes: ["endereco", "endereco do evento", "endereco do local"] },
  { key: "dataShow", nomes: ["data", "data do evento", "data do show"] },
  { key: "horario", nomes: ["horario da apresentacao", "horario", "hora", "horario do show"] },
  { key: "lineUp", nomes: ["line-up", "line up", "lineup"] },
];

// Setores da agência — não são preenchidos pela colagem, só checados.
const SETORES: { nome: string; nomes: string[]; catalogo: readonly string[] | null }[] = [
  { nome: "Efeitos", nomes: ["efeitos"], catalogo: CATALOGO_EFEITOS },
  { nome: "Consumação/Camarim", nomes: ["consumacao/camarim", "camarim", "consumacao"], catalogo: CATALOGO_CAMARIM },
  { nome: "Hotel", nomes: ["hotel"], catalogo: CATALOGO_HOTEL },
  { nome: "Logística", nomes: ["logistica"], catalogo: null },
];

type Rotulo =
  | { tipo: "campo"; key: ChaveCampo; inline: string }
  | { tipo: "setor"; nome: string; catalogo: readonly string[] | null; inline: string }
  | null;

function classificar(linha: string): Rotulo {
  const idx = linha.indexOf(":");
  if (idx === -1) return null;
  const rotuloN = norm(linha.slice(0, idx));
  const inline = linha.slice(idx + 1).trim();
  const campo = ROTULOS.find((e) => e.nomes.includes(rotuloN));
  if (campo) return { tipo: "campo", key: campo.key, inline };
  const setor = SETORES.find((s) => s.nomes.includes(rotuloN));
  if (setor) return { tipo: "setor", nome: setor.nome, catalogo: setor.catalogo, inline };
  return null;
}

/** "DD/MM/AAAA" (ou DD-MM-AAAA) → "YYYY-MM-DD". null se não reconhecer. */
function parseDataBR(v: string): string | null {
  const m = v.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (!m) return null;
  const dia = m[1].padStart(2, "0");
  const mes = m[2].padStart(2, "0");
  let ano = m[3];
  if (ano.length === 2) ano = `20${ano}`;
  const d = Number(dia), mm = Number(mes);
  if (d < 1 || d > 31 || mm < 1 || mm > 12) return null;
  return `${ano}-${mes}-${dia}`;
}

/** Extrai o primeiro "HH:mm" (aceita "22h", "22h30", "22:00 — 04:00"). */
function parseHora(v: string): string | null {
  const m = v.match(/(\d{1,2})\s*[:h]\s*(\d{2})/);
  if (m) {
    const h = m[1].padStart(2, "0");
    if (Number(h) > 23 || Number(m[2]) > 59) return null;
    return `${h}:${m[2]}`;
  }
  const so = v.match(/\b(\d{1,2})\s*h\b/i); // "22h"
  if (so && Number(so[1]) <= 23) return `${so[1].padStart(2, "0")}:00`;
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
  const avisos: string[] = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha) continue;
    const c = classificar(linha);
    if (!c) continue;

    if (c.tipo === "setor") {
      // Junta as linhas-item seguintes (até o próximo rótulo).
      const itens: string[] = [];
      if (c.inline) itens.push(c.inline);
      let j = i + 1;
      for (; j < linhas.length; j++) {
        const l = linhas[j];
        if (!l) continue;
        if (classificar(l)) break;
        itens.push(l);
      }
      i = j - 1;
      if (itens.length === 0) continue; // vazio = faltando → ignora
      const ok =
        c.catalogo === null
          ? itens.every(logisticaEntendida)
          : itens.every((it) => itemEntendido(it, c.catalogo as readonly string[]));
      if (!ok) avisos.push(c.nome);
      continue; // nunca altera setores da agência
    }

    // Campo simples — valor inline ou na(s) próxima(s) linha(s).
    let valor = c.inline;
    if (!valor) {
      let j = i + 1;
      while (j < linhas.length && !linhas[j]) j++;
      if (j < linhas.length && !classificar(linhas[j])) {
        valor = linhas[j];
        i = j;
      }
    }
    aplicar(campos, c.key, valor);
  }

  return { campos, avisos };
}

function aplicar(campos: CamposFechamento, key: ChaveCampo, valorBruto: string) {
  const v = valorBruto.trim();
  if (!v) return;
  switch (key) {
    case "contratanteNome":
    case "contratanteEndereco":
    case "nomeEvento":
    case "nomeLocal":
    case "enderecoLocal":
      campos[key] = v;
      break;
    case "contratanteEmail":
      if (v.includes("@")) campos.contratanteEmail = v.replace(/\s+/g, "");
      break;
    case "eventoInstagram":
      campos.eventoInstagram = v.replace(/^@/, "").replace(/\s+/g, "");
      break;
    case "contratanteDocumento": {
      const d = v.replace(/[^\d./-]/g, "");
      if (d) campos.contratanteDocumento = d;
      break;
    }
    case "capacidadePublico": {
      const d = v.replace(/\D/g, "");
      if (d) campos.capacidadePublico = d;
      break;
    }
    case "dataShow": {
      const iso = parseDataBR(v);
      if (iso) campos.dataShow = iso;
      break;
    }
    case "horario": {
      const h = parseHora(v);
      if (h) campos.horario = h;
      break;
    }
    case "lineUp": {
      const arr = v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
      if (arr.length) campos.lineUp = arr;
      break;
    }
  }
}
