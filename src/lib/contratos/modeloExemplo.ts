import type { SecaoModelo } from "@/lib/mappers/contratoModelo";

/**
 * Modelo de contrato de EXEMPLO embutido no app (não vive no banco). É
 * oferecido como ponto de partida na tela de Modelos via "Duplicar e
 * editar", que clona estas seções (com ids novos) para um modelo do workspace.
 *
 * Usa as seções tipadas. Cláusulas/sub-cláusulas são numeradas
 * automaticamente na renderização. Campos automáticos já trazem as variáveis
 * {{...}}; trechos manuais (responsabilidade, PIX, rescisão, quebra, foro)
 * trazem instruções entre [colchetes]. Os ids aqui são fixos só para
 * referência — ao duplicar, o app gera ids novos.
 */

export const NOME_MODELO_EXEMPLO = "Contrato padrão — Apresentação artística";

export const SECOES_MODELO_EXEMPLO: SecaoModelo[] = [
  {
    id: "titulo",
    tipo: "titulo",
    titulo: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
    subtitulo: "Apresentação Artística",
  },
  {
    id: "partes",
    tipo: "partes",
    contratante:
      "CONTRATANTE: {{contratante}}, inscrito(a) no CPF/CNPJ sob o nº {{documento}}, com endereço em {{endereco}}, telefone {{telefone}}.",
    contratado: "CONTRATADO(A): {{artista}}, representado(a) por {{agencia}}.",
    paragrafo:
      "As partes acima identificadas têm, entre si, justo e acordado o presente Contrato de Prestação de Serviços de Apresentação Artística, que se regerá pelas cláusulas e condições a seguir.",
  },
  {
    id: "c-objeto",
    tipo: "clausula",
    titulo: "DO OBJETO",
    itens: [
      {
        id: "c-objeto-1",
        tipo: "paragrafo",
        texto:
          'O presente contrato tem como objeto a apresentação artística do(a) CONTRATADO(A), consistente na execução de músicas próprias e/ou remixadas, a ser realizada no dia {{data}}, no evento "{{evento}}", no local {{local}}, situado em {{endereco_local}}, na cidade de {{cidade}}.',
      },
    ],
  },
  {
    id: "c-servicos",
    tipo: "clausula",
    titulo: "DOS SERVIÇOS PRESTADOS",
    itens: [
      {
        id: "c-servicos-1",
        tipo: "paragrafo",
        texto:
          "A apresentação artística terá início às {{horario}} e término às {{horario_fim}}, conforme acordado entre as partes, podendo a carga horária ser ajustada de comum acordo.",
      },
    ],
  },
  {
    id: "c-resp",
    tipo: "clausula",
    titulo: "DA RESPONSABILIDADE DO CONTRATANTE",
    itens: [
      {
        id: "c-resp-1",
        tipo: "paragrafo",
        texto:
          "[Use o botão + Cláusula para adicionar sub-cláusulas numeradas (estrutura de palco, segurança, alimentação, energia elétrica, etc.) ou + Parágrafo para um texto solto.]",
      },
    ],
  },
  {
    id: "c-pgto",
    tipo: "clausula",
    titulo: "DO PAGAMENTO",
    itens: [
      {
        id: "c-pgto-1",
        tipo: "subclausula",
        texto:
          "Pela prestação dos serviços, o CONTRATANTE pagará ao(à) CONTRATADO(A) o valor de {{cache}}, na seguinte forma: {{forma de pagamento}}.",
      },
      {
        id: "c-pgto-2",
        tipo: "subclausula",
        texto:
          "O pagamento deverá ser realizado via PIX para a chave: [informe aqui a chave PIX].",
      },
    ],
  },
  {
    id: "c-rescisao",
    tipo: "clausula",
    titulo: "DA RESCISÃO CONTRATUAL",
    itens: [
      {
        id: "c-rescisao-1",
        tipo: "paragrafo",
        texto:
          "[Ex.: em caso de cancelamento por qualquer das partes, será devida multa de __% sobre o valor total do contrato.]",
      },
    ],
  },
  {
    id: "c-quebra",
    tipo: "clausula",
    titulo: "DA QUEBRA DE CONTRATO",
    itens: [
      {
        id: "c-quebra-1",
        tipo: "paragrafo",
        texto:
          "[Descreva as penalidades em caso de quebra ou descumprimento das obrigações deste contrato.]",
      },
    ],
  },
  {
    id: "c-foro",
    tipo: "clausula",
    titulo: "DO FORO",
    itens: [
      {
        id: "c-foro-1",
        tipo: "paragrafo",
        texto:
          "Fica eleito o foro da comarca de [cidade/UF] para dirimir quaisquer dúvidas oriundas do presente contrato, com renúncia a qualquer outro, por mais privilegiado que seja.",
      },
    ],
  },
  {
    id: "a-tecnico",
    tipo: "anexo",
    titulo: "ANEXO — RIDER TÉCNICO",
    conteudo:
      "O CONTRATANTE compromete-se a disponibilizar, às suas expensas, os seguintes itens de rider técnico:\n{{rider tecnico}}",
  },
  {
    id: "a-efeitos",
    tipo: "anexo",
    titulo: "ANEXO — RIDER DE EFEITOS",
    conteudo: "Itens de efeitos acordados para a apresentação:\n{{rider de efeitos}}",
  },
  {
    id: "a-camarim",
    tipo: "anexo",
    titulo: "ANEXO — RIDER DE CAMARIM",
    conteudo:
      "Itens de camarim a serem disponibilizados ao(à) CONTRATADO(A):\n{{rider de camarim}}",
  },
  {
    id: "assinaturas",
    tipo: "assinaturas",
    testemunhas: 0,
  },
];
