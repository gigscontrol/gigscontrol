import type { SecaoModelo } from "@/lib/mappers/contratoModelo";

/**
 * Modelo de contrato de EXEMPLO embutido no app (não vive no banco). É
 * oferecido como ponto de partida na tela de Modelos via "Duplicar e
 * editar", que clona estas seções para um modelo editável do workspace.
 *
 * Cada seção tem 1 título e uma lista de PARÁGRAFOS/CLÁUSULAS (1 ou mais).
 * Seções AUTOMÁTICAS já trazem as variáveis {{...}} no lugar (preenchidas
 * com os dados do show ao gerar). Seções MANUAIS (responsabilidade,
 * pagamento/PIX, rescisão, quebra, foro) trazem instruções entre [colchetes].
 */

export const NOME_MODELO_EXEMPLO = "Contrato padrão — Apresentação artística";

export const SECOES_MODELO_EXEMPLO: SecaoModelo[] = [
  {
    id: "titulo",
    titulo: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
    paragrafos: ["Apresentação Artística"],
  },
  {
    id: "partes",
    titulo: "DAS PARTES",
    paragrafos: [
      "CONTRATANTE: {{contratante}}, inscrito(a) no CPF/CNPJ sob o nº {{documento}}, com endereço em {{endereco}}, telefone {{telefone}}.",
      "CONTRATADO(A): {{artista}}, representado(a) por {{agencia}}.",
      "As partes acima identificadas têm, entre si, justo e acordado o presente Contrato de Prestação de Serviços de Apresentação Artística, que se regerá pelas cláusulas e condições a seguir.",
    ],
  },
  {
    id: "objeto",
    titulo: "DO OBJETO",
    paragrafos: [
      'O presente contrato tem como objeto a apresentação artística do(a) CONTRATADO(A), consistente na execução de músicas próprias e/ou remixadas, a ser realizada no dia {{data}}, no evento "{{evento}}", no local {{local}}, situado em {{endereco_local}}, na cidade de {{cidade}}.',
    ],
  },
  {
    id: "servicos",
    titulo: "DOS SERVIÇOS PRESTADOS",
    paragrafos: [
      "A apresentação artística terá início às {{horario}} e término às {{horario_fim}}, conforme acordado entre as partes, podendo a carga horária ser ajustada de comum acordo.",
    ],
  },
  {
    id: "responsabilidade",
    titulo: "DA RESPONSABILIDADE DO CONTRATANTE",
    paragrafos: [
      "[Escreva aqui as cláusulas de responsabilidade do CONTRATANTE. Use o botão + Cláusula para adicionar quantas quiser — por exemplo: estrutura de palco, segurança, alimentação da equipe, energia elétrica adequada, etc.]",
    ],
  },
  {
    id: "anexo-tecnico",
    titulo: "ANEXO — RIDER TÉCNICO",
    paragrafos: [
      "O CONTRATANTE compromete-se a disponibilizar, às suas expensas, os seguintes itens de rider técnico:\n{{rider tecnico}}",
    ],
  },
  {
    id: "anexo-efeitos",
    titulo: "ANEXO — RIDER DE EFEITOS",
    paragrafos: ["Itens de efeitos acordados para a apresentação:\n{{rider de efeitos}}"],
  },
  {
    id: "anexo-camarim",
    titulo: "ANEXO — RIDER DE CAMARIM",
    paragrafos: [
      "Itens de camarim a serem disponibilizados ao(à) CONTRATADO(A):\n{{rider de camarim}}",
    ],
  },
  {
    id: "pagamento",
    titulo: "DO PAGAMENTO",
    paragrafos: [
      "Pela prestação dos serviços, o CONTRATANTE pagará ao(à) CONTRATADO(A) o valor de {{cache}}, na seguinte forma: {{forma de pagamento}}.",
      "O pagamento deverá ser realizado via PIX para a chave: [informe aqui a chave PIX]. [Detalhe a modalidade e demais condições de pagamento, se houver.]",
    ],
  },
  {
    id: "rescisao",
    titulo: "DA RESCISÃO CONTRATUAL",
    paragrafos: [
      "[Escreva aqui as condições de rescisão — por exemplo: em caso de cancelamento por qualquer das partes, será devida multa de __% sobre o valor total do contrato.]",
    ],
  },
  {
    id: "quebra",
    titulo: "DA QUEBRA DE CONTRATO",
    paragrafos: [
      "[Escreva aqui as condições e penalidades em caso de quebra ou descumprimento das obrigações deste contrato.]",
    ],
  },
  {
    id: "foro",
    titulo: "DO FORO",
    paragrafos: [
      "Fica eleito o foro da comarca de [cidade/UF] para dirimir quaisquer dúvidas ou controvérsias oriundas do presente contrato, com renúncia a qualquer outro, por mais privilegiado que seja.",
    ],
  },
  {
    id: "assinaturas",
    titulo: "DAS ASSINATURAS",
    paragrafos: [
      "E, por estarem assim justos e contratados, firmam o presente instrumento em duas vias de igual teor e forma.",
      "{{cidade}}, {{data_hoje}}.",
      "_______________________________________\n{{contratante}}\nCONTRATANTE",
      "_______________________________________\n{{artista}}\nCONTRATADO(A)",
    ],
  },
];
