/**
 * Sistema de variáveis de contrato.
 *
 * Um modelo "editável" é um texto com tokens no formato `{{ token }}`.
 * Na hora de gerar o contrato, cada token é substituído pelo valor
 * correspondente. Tokens sem valor permanecem visíveis (não são apagados),
 * para que o usuário perceba o que ainda falta preencher.
 *
 * Atenção: alguns tokens têm espaços internos (ex.: `forma de pagamento`),
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
  { token: "artista", label: "Artista", grupo: "Artista/Agência" },
  { token: "agencia", label: "Agência", grupo: "Artista/Agência" },

  // Contratante
  { token: "contratante", label: "Contratante", grupo: "Contratante" },
  { token: "documento", label: "CPF/CNPJ", grupo: "Contratante" },
  { token: "endereco", label: "Endereço do contratante", grupo: "Contratante" },
  { token: "telefone", label: "Telefone", grupo: "Contratante" },

  // Evento
  { token: "evento", label: "Nome do evento", grupo: "Evento" },
  { token: "local", label: "Local", grupo: "Evento" },
  { token: "endereco_local", label: "Endereço do local", grupo: "Evento" },
  { token: "cidade", label: "Cidade", grupo: "Evento" },
  { token: "data", label: "Data do show", grupo: "Evento" },
  { token: "horario", label: "Horário (início)", grupo: "Evento" },
  { token: "horario_fim", label: "Horário (fim)", grupo: "Evento" },

  // Valores
  { token: "cache", label: "Cachê", grupo: "Valores" },
  {
    token: "forma de pagamento",
    label: "Forma de pagamento",
    grupo: "Valores",
  },

  // Riders/Hospedagem
  {
    token: "rider de camarim",
    label: "Rider de camarim",
    grupo: "Riders/Hospedagem",
  },
  {
    token: "rider de efeitos",
    label: "Rider de efeitos",
    grupo: "Riders/Hospedagem",
  },
  {
    token: "rider tecnico",
    label: "Rider técnico",
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
 * Substitui todas as ocorrências de `{{ token }}` (com espaços opcionais
 * dentro das chaves) pelos valores em `valores`. Se o token não estiver em
 * `valores`, o `{{token}}` original permanece intacto.
 *
 * Suporta tokens com espaços internos, ex.: `{{forma de pagamento}}`.
 */
export function preencher(
  template: string,
  valores: Record<string, string>
): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (original, bruto) => {
    const token = String(bruto).trim();
    if (Object.prototype.hasOwnProperty.call(valores, token)) {
      return valores[token];
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

  // Contratante
  contratante: "Marcos Lima",
  documento: "123.456.789-00",
  endereco: "Rua das Palmeiras, 245 — Centro, São Paulo/SP",
  telefone: "(11) 98765-4321",

  // Evento
  evento: "Réveillon 2027 — Praia Club",
  local: "Praia Club",
  endereco_local: "Av. Beira-Mar, 1500 — Praia Grande/SP",
  cidade: "Praia Grande/SP",
  data: "31/12/2026",
  horario: "23h00",
  horario_fim: "04h00",

  // Valores
  cache: "R$ 8.000,00",
  "forma de pagamento": "50% na assinatura, 50% até 7 dias antes do evento",

  // Riders/Hospedagem
  "rider de camarim": "Whisky x1, Água sem gás x12, Refrigerante x6, Gelo x2",
  "rider de efeitos": "Máquina de fumaça x2, CO2 x4, Confete x2",
  "rider tecnico": "CDJ-3000 x2, DJM-900NXS2 x1, Monitor de palco x2",
  hospedagem: "1 diária em hotel 4 estrelas, quarto single com café da manhã",

  // Logística
  logistica: "Transporte ida e volta do aeroporto ao hotel e ao local",
  translado: "Carro executivo com motorista à disposição",

  // Contrato
  numero_contrato: "CT-0001",
  data_hoje: "17/06/2026",
};
