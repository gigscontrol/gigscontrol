import type { SecaoModelo } from "@/lib/mappers/contratoModelo";

/**
 * Modelo de contrato de EXEMPLO embutido no app (não vive no banco). É
 * oferecido como ponto de partida na tela de Modelos via "Duplicar e
 * editar", que clona estas seções para um modelo editável do workspace.
 *
 * Estrutura padrão de um contrato de apresentação artística. As seções
 * AUTOMÁTICAS já trazem as variáveis {{...}} no lugar (preenchidas com os
 * dados do show ao gerar o contrato). As seções MANUAIS (responsabilidade,
 * pagamento/PIX, rescisão, quebra, foro) trazem instruções entre [colchetes]
 * para o usuário preencher.
 */

export const NOME_MODELO_EXEMPLO = "Contrato padrão — Apresentação artística";

export const SECOES_MODELO_EXEMPLO: SecaoModelo[] = [
  {
    id: "titulo",
    titulo: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
    corpo: "Apresentação Artística",
  },
  {
    id: "partes",
    titulo: "DAS PARTES",
    corpo:
      "CONTRATANTE: {{contratante}}, inscrito(a) no CPF/CNPJ sob o nº {{documento}}, com endereço em {{endereco}}, telefone {{telefone}}.\n\n" +
      "CONTRATADO(A): {{artista}}, representado(a) por {{agencia}}.\n\n" +
      "As partes acima identificadas têm, entre si, justo e acordado o presente Contrato de Prestação de Serviços de Apresentação Artística, que se regerá pelas cláusulas e condições a seguir.",
  },
  {
    id: "objeto",
    titulo: "DO OBJETO",
    corpo:
      'O presente contrato tem como objeto a apresentação artística do(a) CONTRATADO(A), consistente na execução de músicas próprias e/ou remixadas, a ser realizada no dia {{data}}, no evento "{{evento}}", no local {{local}}, situado em {{endereco_local}}, na cidade de {{cidade}}.',
  },
  {
    id: "servicos",
    titulo: "DOS SERVIÇOS PRESTADOS",
    corpo:
      "A apresentação artística terá início às {{horario}} e término às {{horario_fim}}, conforme acordado entre as partes, podendo a carga horária ser ajustada de comum acordo.",
  },
  {
    id: "responsabilidade",
    titulo: "DA RESPONSABILIDADE DO CONTRATANTE",
    corpo:
      "[Escreva aqui as cláusulas de responsabilidade do CONTRATANTE. Você pode adicionar quantas cláusulas quiser — por exemplo: estrutura de palco, segurança, alimentação da equipe, fornecimento de energia elétrica adequada, etc.]",
  },
  {
    id: "anexo-tecnico",
    titulo: "ANEXO — RIDER TÉCNICO",
    corpo:
      "O CONTRATANTE compromete-se a disponibilizar, às suas expensas, os seguintes itens de rider técnico:\n{{rider tecnico}}",
  },
  {
    id: "anexo-efeitos",
    titulo: "ANEXO — RIDER DE EFEITOS",
    corpo: "Itens de efeitos acordados para a apresentação:\n{{rider de efeitos}}",
  },
  {
    id: "anexo-camarim",
    titulo: "ANEXO — RIDER DE CAMARIM",
    corpo:
      "Itens de camarim a serem disponibilizados ao(à) CONTRATADO(A):\n{{rider de camarim}}",
  },
  {
    id: "pagamento",
    titulo: "DO PAGAMENTO",
    corpo:
      "Pela prestação dos serviços, o CONTRATANTE pagará ao(à) CONTRATADO(A) o valor de {{cache}}, na seguinte forma: {{forma de pagamento}}.\n\n" +
      "O pagamento deverá ser realizado via PIX para a chave: [informe aqui a chave PIX]. [Detalhe a modalidade e demais condições de pagamento, se houver.]",
  },
  {
    id: "rescisao",
    titulo: "DA RESCISÃO CONTRATUAL",
    corpo:
      "[Escreva aqui as condições de rescisão — por exemplo: em caso de cancelamento por qualquer das partes, será devida multa de __% sobre o valor total do contrato.]",
  },
  {
    id: "quebra",
    titulo: "DA QUEBRA DE CONTRATO",
    corpo:
      "[Escreva aqui as condições e penalidades em caso de quebra ou descumprimento das obrigações deste contrato.]",
  },
  {
    id: "foro",
    titulo: "DO FORO",
    corpo:
      "Fica eleito o foro da comarca de [cidade/UF] para dirimir quaisquer dúvidas ou controvérsias oriundas do presente contrato, com renúncia a qualquer outro, por mais privilegiado que seja.",
  },
  {
    id: "assinaturas",
    titulo: "DAS ASSINATURAS",
    corpo:
      "E, por estarem assim justos e contratados, firmam o presente instrumento em duas vias de igual teor e forma.\n\n" +
      "{{cidade}}, {{data_hoje}}.\n\n\n" +
      "_______________________________________\n{{contratante}}\nCONTRATANTE\n\n\n" +
      "_______________________________________\n{{artista}}\nCONTRATADO(A)",
  },
];
