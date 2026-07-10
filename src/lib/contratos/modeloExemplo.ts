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

export const NOME_MODELO_EXEMPLO = "Modelo Padrão BR";

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
    testemunhas: [],
  },
];

/**
 * Segundo modelo embutido: um contrato de apresentação artística com base no
 * padrão INTERNACIONAL (Artist Performance Agreement), redigido em inglês. É um
 * ponto de partida para revisar com um advogado — inclui Force Majeure e
 * Governing Law, que contratos globais costumam trazer.
 *
 * Reutiliza EXATAMENTE os mesmos {{tokens}} do modelo BR (mesmo que nomeados em
 * português no código), pois são as chaves que o app substitui ao gerar — só o
 * texto ao redor muda para inglês.
 */

export const NOME_MODELO_GLOBAL = "Modelo Padrão Global";

export const SECOES_MODELO_GLOBAL: SecaoModelo[] = [
  {
    id: "g-titulo",
    tipo: "titulo",
    titulo: "ARTIST PERFORMANCE AGREEMENT",
    subtitulo: "International Live Engagement",
  },
  {
    id: "g-partes",
    tipo: "partes",
    contratante:
      "PURCHASER (CLIENT): {{contratante}}, holder of tax/registration ID no. {{documento}}, with address at {{endereco}}, phone {{telefone}}.",
    contratado:
      'ARTIST: {{artista}}, represented for this engagement by {{agencia}} (the "Agency").',
    paragrafo:
      'The parties identified above agree to enter into this Artist Performance Agreement (the "Agreement"), governed by the terms and conditions set out below.',
  },
  {
    id: "g-engagement",
    tipo: "clausula",
    titulo: "ENGAGEMENT",
    itens: [
      {
        id: "g-engagement-1",
        tipo: "paragrafo",
        texto:
          'The Purchaser engages the Artist to give a live artistic performance (the "Performance") on {{data}}, at the event "{{evento}}", held at {{local}}, located at {{endereco_local}}, in {{cidade}}.',
      },
    ],
  },
  {
    id: "g-performance",
    tipo: "clausula",
    titulo: "PERFORMANCE DETAILS",
    itens: [
      {
        id: "g-performance-1",
        tipo: "paragrafo",
        texto:
          "The Performance shall begin at {{horario}} and end at {{horario_fim}}, as agreed between the parties. The set length may be adjusted by mutual written agreement.",
      },
    ],
  },
  {
    id: "g-purchaser",
    tipo: "clausula",
    titulo: "PURCHASER'S OBLIGATIONS",
    itens: [
      {
        id: "g-purchaser-1",
        tipo: "paragrafo",
        texto:
          "[Use + Clause to add numbered sub-clauses (stage & production, sound & lighting, security, catering, power supply, travel & accommodation, work permits/visas, etc.) or + Paragraph for free text.]",
      },
    ],
  },
  {
    id: "g-fee",
    tipo: "clausula",
    titulo: "FEE AND PAYMENT",
    itens: [
      {
        id: "g-fee-1",
        tipo: "subclausula",
        texto:
          "In consideration of the Performance, the Purchaser shall pay the Artist the fee of {{cache}}, payable as follows: {{forma de pagamento}}.",
      },
      {
        id: "g-fee-2",
        tipo: "subclausula",
        texto:
          "Payment shall be made by bank transfer to the account designated by the Agency. [Add deposit terms, balance due date, currency and any taxes/withholding here.]",
      },
    ],
  },
  {
    id: "g-cancel",
    tipo: "clausula",
    titulo: "CANCELLATION",
    itens: [
      {
        id: "g-cancel-1",
        tipo: "paragrafo",
        texto:
          "[E.g.: if the Purchaser cancels, the deposit is non-refundable and the full fee becomes due if cancellation occurs within __ days of the Performance. Define notice periods and penalties here.]",
      },
    ],
  },
  {
    id: "g-force",
    tipo: "clausula",
    titulo: "FORCE MAJEURE",
    itens: [
      {
        id: "g-force-1",
        tipo: "paragrafo",
        texto:
          "Neither party shall be liable for failure to perform caused by events beyond its reasonable control (including acts of God, epidemic, government action, travel restrictions or the cancellation of transportation). In such event the parties shall use reasonable efforts to reschedule the Performance.",
      },
    ],
  },
  {
    id: "g-law",
    tipo: "clausula",
    titulo: "GOVERNING LAW AND JURISDICTION",
    itens: [
      {
        id: "g-law-1",
        tipo: "paragrafo",
        texto:
          "This Agreement shall be governed by the laws of [country/state]. Any dispute arising out of or relating to this Agreement shall be subject to the exclusive jurisdiction of the courts of [city/country], or resolved by arbitration if the parties so agree.",
      },
    ],
  },
  {
    id: "g-a-tecnico",
    tipo: "anexo",
    titulo: "ANNEX — TECHNICAL RIDER",
    conteudo:
      "The Purchaser shall provide, at its own expense, the following technical rider items:\n{{rider tecnico}}",
  },
  {
    id: "g-a-efeitos",
    tipo: "anexo",
    titulo: "ANNEX — SPECIAL EFFECTS RIDER",
    conteudo: "Special effects agreed for the Performance:\n{{rider de efeitos}}",
  },
  {
    id: "g-a-camarim",
    tipo: "anexo",
    titulo: "ANNEX — HOSPITALITY / DRESSING ROOM RIDER",
    conteudo:
      "Hospitality and dressing room items to be provided to the Artist:\n{{rider de camarim}}",
  },
  {
    id: "g-assinaturas",
    tipo: "assinaturas",
    testemunhas: [],
  },
];
