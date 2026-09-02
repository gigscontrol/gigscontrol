/**
 * Sistema de variáveis de contrato.
 *
 * Um modelo "editável" é um texto com tokens no formato `{{ token }}`.
 * Na hora de gerar o contrato, cada token é substituído pelo valor
 * correspondente. Tokens sem valor permanecem visíveis (não são apagados),
 * para que o usuário perceba o que ainda falta preencher.
 *
 * Atenção: alguns tokens têm espaços internos (ex.: `rider de camarim`),
 * mantidos exatamente como escritos.
 */

export type VariavelContrato = {
  token: string;
  label: string;
  grupo: string;
};

/**
 * Catálogo de variáveis disponíveis, agrupadas para exibição no editor.
 */
export const VARIAVEIS_CONTRATO: VariavelContrato[] = [
  // Artista/Agência
  // NB: `artista` é o nome ARTÍSTICO (stage name) — o token continua "artista".
  { token: "artista", label: "Nome artístico", grupo: "Artista/Agência" },
  { token: "agencia", label: "Agência", grupo: "Artista/Agência" },
  { token: "artista_nome_civil", label: "Nome civil", grupo: "Artista/Agência" },
  { token: "artista_razao_social", label: "Razão social do artista", grupo: "Artista/Agência" },
  { token: "artista_documento", label: "Documento do artista", grupo: "Artista/Agência" },
  { token: "artista_email", label: "E-mail do artista", grupo: "Artista/Agência" },
  { token: "artista_endereco", label: "Endereço do artista", grupo: "Artista/Agência" },
  { token: "artista_telefone", label: "Telefone do artista", grupo: "Artista/Agência" },

  // Contratante
  { token: "contratante", label: "Contratante", grupo: "Contratante" },
  { token: "documento", label: "Documento", grupo: "Contratante" },
  { token: "razao_social", label: "Razão social", grupo: "Contratante" },
  { token: "email", label: "E-mail", grupo: "Contratante" },
  { token: "endereco", label: "Endereço do contratante", grupo: "Contratante" },
  { token: "telefone", label: "Telefone", grupo: "Contratante" },

  // Evento
  { token: "evento", label: "Nome do evento", grupo: "Evento" },
  { token: "local", label: "Local", grupo: "Evento" },
  { token: "endereco_local", label: "Endereço do evento", grupo: "Evento" },
  { token: "cidade", label: "Cidade", grupo: "Evento" },
  { token: "capacidade", label: "Capacidade do local", grupo: "Evento" },
  { token: "data", label: "Data do show", grupo: "Evento" },
  { token: "data_extenso", label: "Data do show por extenso", grupo: "Evento" },
  { token: "horario", label: "Horário (início)", grupo: "Evento" },
  { token: "horario_fim", label: "Horário (fim)", grupo: "Evento" },
  { token: "tempo_apresentacao", label: "Tempo de apresentação", grupo: "Evento" },

  // Valores
  { token: "cache", label: "Cachê", grupo: "Valores" },
  { token: "cache_extenso", label: "Cachê por extenso", grupo: "Valores" },
  { token: "parcelas", label: "Plano de parcelas", grupo: "Valores" },
  {
    token: "chave_pix_artista",
    label: "Chave PIX do artista",
    grupo: "Valores",
  },

  // Riders/Hospedagem
  {
    token: "rider de camarim",
    label: "Rider de Camarim",
    grupo: "Riders/Hospedagem",
  },
  {
    token: "rider de efeitos",
    label: "Rider de Efeitos",
    grupo: "Riders/Hospedagem",
  },
  {
    token: "rider tecnico",
    label: "Rider Técnico",
    grupo: "Riders/Hospedagem",
  },
  { token: "hospedagem", label: "Hospedagem", grupo: "Riders/Hospedagem" },

  // Logística
  { token: "logistica", label: "Logística", grupo: "Logística" },
  { token: "translado", label: "Translado", grupo: "Logística" },

  // Contrato
  {
    token: "numero_contrato",
    label: "Número do contrato",
    grupo: "Contrato",
  },
  { token: "data_hoje", label: "Data de hoje", grupo: "Contrato" },
];

/**
 * Normaliza um token pra comparação TOLERANTE: minúsculas, sem acentos,
 * `_` vira espaço, conectivos (de/do/da/dos/das) caem e espaços colapsam.
 * Assim `{{ENDEREÇO_CONTRATANTE}}`, `{{endereco contratante}}` e
 * `{{Endereco do Contratante}}` são o MESMO token. Aplicada nos DOIS lados
 * (o que o usuário digitou e as chaves do catálogo), nunca muda o que fica
 * gravado no modelo — só o matching.
 */
export function normalizarToken(token: string): string {
  return token
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (combining marks do NFD)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b(de|do|da|dos|das)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Apelidos de token (já NORMALIZADOS) → token canônico do catálogo. Cobre os
 * nomes "intuitivos" que usuários escrevem à mão nos modelos (ex.:
 * {{CNPJ_CONTRATANTE}}, {{NOME_ARTISTA}}, {{DATA_DO_SHOW}}) sem inflar o
 * catálogo visível no editor.
 */
const APELIDOS_TOKEN: Record<string, string> = {
  // Contratante
  "nome contratante": "contratante",
  "cnpj contratante": "documento",
  "cpf contratante": "documento",
  "cpf cnpj contratante": "documento",
  "documento contratante": "documento",
  "razao social contratante": "razao_social",
  "endereco contratante": "endereco",
  "email contratante": "email",
  "e mail contratante": "email",
  "telefone contratante": "telefone",
  // Artista / contratado
  "nome artista": "artista",
  "nome contratado": "artista",
  "cnpj artista": "artista_documento",
  "cpf artista": "artista_documento",
  "documento artista": "artista_documento",
  "cnpj contratado": "artista_documento",
  "razao social artista": "artista_razao_social",
  "endereco artista": "artista_endereco",
  "email artista": "artista_email",
  "telefone artista": "artista_telefone",
  // Evento
  "nome evento": "evento",
  "data evento": "data",
  "data show": "data",
  "endereco evento": "endereco_local",
  "endereco do local": "endereco_local",
  "local evento": "local",
  "cidade evento": "cidade",
  "horario inicio": "horario",
  "hora inicio": "horario",
  "horario final": "horario_fim",
  "horario termino": "horario_fim",
  "hora fim": "horario_fim",
  // Valores
  "valor": "cache",
  "valor cache": "cache",
  "cache show": "cache",
  // Legado: "forma de pagamento" virou a chave PIX do artista (pedido do
  // dono) — modelos antigos com o token continuam preenchendo.
  "forma pagamento": "chave_pix_artista",
  "pix": "chave_pix_artista",
  "chave pix": "chave_pix_artista",
  "pix artista": "chave_pix_artista",
  // Contrato
  "numero contrato": "numero_contrato",
  "data hoje": "data_hoje",
};

/**
 * Substitui todas as ocorrências de `{{ token }}` (com espaços opcionais
 * dentro das chaves) pelos valores em `valores`. Se o token não estiver em
 * `valores`, o `{{token}}` original permanece intacto.
 *
 * Matching em 3 níveis: exato → normalizado (case/acentos/underscores não
 * importam) → apelido (ex.: {{CNPJ_CONTRATANTE}} resolve pra `documento`).
 * Suporta tokens com espaços internos, ex.: `{{rider de camarim}}`.
 */
export function preencher(
  template: string,
  valores: Record<string, string>
): string {
  // Índice normalizado das chaves reais (montado 1x por chamada).
  let porNorma: Map<string, string> | null = null;
  const indice = (): Map<string, string> => {
    if (!porNorma) {
      porNorma = new Map();
      for (const chave of Object.keys(valores)) {
        const n = normalizarToken(chave);
        if (!porNorma.has(n)) porNorma.set(n, chave);
      }
    }
    return porNorma;
  };

  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (original, bruto) => {
    const token = String(bruto).trim();
    // 1) match exato (caminho de sempre — zero custo extra).
    if (Object.prototype.hasOwnProperty.call(valores, token)) {
      return valores[token];
    }
    // 2) match normalizado (maiúsculas, acentos, _ e conectivos não importam).
    const norma = normalizarToken(token);
    const chaveReal = indice().get(norma);
    if (chaveReal !== undefined) return valores[chaveReal];
    // 3) apelido → token canônico.
    const canonico = APELIDOS_TOKEN[norma];
    if (canonico && Object.prototype.hasOwnProperty.call(valores, canonico)) {
      return valores[canonico];
    }
    // Token sem valor: mantém o placeholder original visível.
    return original;
  });
}

/**
 * Valores de exemplo (realistas, padrão Brasil) para TODOS os tokens.
 * Usado no preview do editor de modelos.
 */
export const VALORES_EXEMPLO: Record<string, string> = {
  // Artista/Agência
  artista: "Maninhoo",
  agencia: "GIGS Control Agência de Eventos LTDA",
  artista_nome_civil: "Matheus Oliveira",
  artista_razao_social: "Maninhoo Produções LTDA",
  artista_documento: "12.345.678/0001-90",
  artista_email: "contato@maninhoo.com",
  artista_endereco: "Rua Augusta, 900 — São Paulo/SP",
  artista_telefone: "(11) 91234-5678",

  // Contratante
  contratante: "Marcos Lima",
  documento: "123.456.789-00",
  razao_social: "Lima Eventos LTDA",
  email: "marcos@limaeventos.com.br",
  endereco: "Rua das Palmeiras, 245 — Centro, São Paulo/SP",
  telefone: "(11) 98765-4321",

  // Evento
  evento: "Réveillon 2027 — Praia Club",
  local: "Praia Club",
  endereco_local: "Av. Beira-Mar, 1500 — Praia Grande/SP",
  cidade: "Praia Grande/SP",
  capacidade: "1.500 pessoas",
  data: "31/12/2026",
  data_extenso: "31 de dezembro de 2026",
  horario: "23h00",
  horario_fim: "04h00",
  tempo_apresentacao: "2h30",

  // Valores
  cache: "R$ 8.000,00",
  cache_extenso: "oito mil reais",
  parcelas:
    "1ª parcela: R$ 4.000,00 até 01/12/2026; 2ª parcela: R$ 4.000,00 até 24/12/2026",
  chave_pix_artista: "contato@maninhoo.com",

  // Riders/Hospedagem
  "rider de camarim":
    "01 (um) Whisky, 12 (doze) Água sem gás, 06 (seis) Refrigerante, 02 (dois) Gelo",
  "rider de efeitos": "02 (dois) Máquina de fumaça, 04 (quatro) CO2, 02 (dois) Confete",
  "rider tecnico": "02 (dois) CDJ-3000, 01 (um) DJM-900NXS2, 02 (dois) Monitor de palco",
  hospedagem: "1 diária em hotel 4 estrelas, quarto single com café da manhã",

  // Logística
  logistica: "Transporte ida e volta do aeroporto ao hotel e ao local",
  translado: "Carro executivo com motorista à disposição",

  // Contrato
  numero_contrato: "CT-0001",
  data_hoje: "17/06/2026",
};
