# -*- coding: utf-8 -*-
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib import colors

OUT = r"C:\Users\Bruno Socek\Downloads\gigscontrol\Contrato_Prestacao_Servicos_DJ.pdf"

styles = getSampleStyleSheet()

titulo = ParagraphStyle(
    "TituloDoc", parent=styles["Title"], fontName="Helvetica-Bold",
    fontSize=15, leading=19, alignment=TA_CENTER, spaceAfter=4,
)
subtitulo = ParagraphStyle(
    "Subtitulo", parent=styles["Normal"], fontName="Helvetica",
    fontSize=9, leading=12, alignment=TA_CENTER, textColor=colors.grey,
    spaceAfter=14,
)
clausula = ParagraphStyle(
    "Clausula", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=10.5, leading=14, alignment=TA_LEFT, spaceBefore=10, spaceAfter=4,
)
corpo = ParagraphStyle(
    "Corpo", parent=styles["Normal"], fontName="Helvetica",
    fontSize=10, leading=15, alignment=TA_JUSTIFY, spaceAfter=4,
)
item = ParagraphStyle(
    "Item", parent=corpo, leftIndent=18, spaceAfter=3,
)
assinatura = ParagraphStyle(
    "Assinatura", parent=styles["Normal"], fontName="Helvetica",
    fontSize=9.5, leading=13, alignment=TA_CENTER,
)

S = lambda h=8: Spacer(1, h)
story = []

# ---------- CABEÇALHO ----------
story.append(Paragraph("CONTRATO DE PRESTAÇÃO DE SERVIÇOS ARTÍSTICOS", titulo))
story.append(Paragraph("Apresentação musical de DJ (disc jockey)", subtitulo))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#222222"),
                        spaceBefore=0, spaceAfter=10))

# ---------- PARTES ----------
story.append(Paragraph("DAS PARTES", clausula))
story.append(Paragraph(
    "<b>CONTRATANTE:</b> NEON NIGHTS PRODUÇÕES E EVENTOS LTDA., pessoa jurídica de "
    "direito privado, inscrita no CNPJ sob o n.º 12.345.678/0001-90, com sede na "
    "Av. das Palmeiras, n.º 1.234, Bairro Centro, Florianópolis/SC, CEP 88010-000, "
    "neste ato representada por seu sócio-administrador Sr. Carlos Eduardo Menezes, "
    "brasileiro, empresário, portador do RG n.º 1.234.567 SSP/SC e inscrito no CPF "
    "sob o n.º 123.456.789-00, doravante denominada simplesmente <b>CONTRATANTE</b>.",
    corpo))
story.append(Paragraph(
    "<b>CONTRATADO:</b> JONATHAN ALVES DA SILVA, conhecido artisticamente como "
    "<b>DJ MANINHO</b>, brasileiro, solteiro, músico/DJ, portador do RG n.º 9.876.543 "
    "SSP/SC e inscrito no CPF sob o n.º 987.654.321-00, residente e domiciliado na "
    "Rua dos Girassóis, n.º 567, Bairro Trindade, Florianópolis/SC, CEP 88036-000, "
    "doravante denominado simplesmente <b>CONTRATADO</b> ou <b>ARTISTA</b>.",
    corpo))
story.append(Paragraph(
    "As partes acima identificadas têm, entre si, justo e acordado o presente "
    "Contrato de Prestação de Serviços Artísticos, que se regerá pelas cláusulas "
    "e condições seguintes.", corpo))

# ---------- CLÁUSULAS ----------
story.append(Paragraph("CLÁUSULA 1ª — DO OBJETO", clausula))
story.append(Paragraph(
    "1.1. O presente contrato tem por objeto a prestação de serviços artísticos pelo "
    "CONTRATADO, consistente em <b>1 (uma) apresentação musical ao vivo</b> na função "
    "de DJ (disc jockey), com discotecagem/performance de set musical, no evento e nas "
    "condições especificadas na Cláusula 2ª.", corpo))
story.append(Paragraph(
    "1.2. Os serviços têm natureza estritamente artística e personalíssima, devendo ser "
    "executados pessoalmente pelo CONTRATADO, vedada a substituição por terceiros sem "
    "prévia e expressa anuência da CONTRATANTE.", corpo))

story.append(Paragraph("CLÁUSULA 2ª — DO EVENTO, DATA, LOCAL E HORÁRIO", clausula))
dados_evento = [
    ["Evento:", "MEGA TROPA DO JON — Edição Verão"],
    ["Local:", "Arena Beira-Mar, Av. Beira-Mar Norte, 3.000 — Florianópolis/SC"],
    ["Data:", "15 de agosto de 2026 (sábado)"],
    ["Horário do set:", "Das 23h30 às 01h30 (2 horas de apresentação)"],
    ["Passagem de som:", "Até às 21h00 do mesmo dia"],
]
t = Table(dados_evento, colWidths=[3.6 * cm, 12.2 * cm])
t.setStyle(TableStyle([
    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
    ("FONTSIZE", (0, 0), (-1, -1), 9.5),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor("#DDDDDD")),
    ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#BBBBBB")),
]))
story.append(t)
story.append(S())
story.append(Paragraph(
    "2.1. Eventual alteração de data, local ou horário dependerá de acordo prévio entre "
    "as partes, formalizado por escrito (inclusive por meio eletrônico/mensagem), sob "
    "pena de aplicação das penalidades previstas neste contrato.", corpo))

story.append(Paragraph("CLÁUSULA 3ª — DO VALOR E DA FORMA DE PAGAMENTO", clausula))
story.append(Paragraph(
    "3.1. Pela prestação dos serviços objeto deste contrato, a CONTRATANTE pagará ao "
    "CONTRATADO o valor total e certo de <b>R$ 8.000,00 (oito mil reais)</b>.", corpo))
story.append(Paragraph("3.2. O pagamento será realizado da seguinte forma:", corpo))
story.append(Paragraph(
    "a) <b>Sinal de 50%</b>, no valor de R$ 4.000,00 (quatro mil reais), a título de "
    "reserva de data, no ato da assinatura deste instrumento;", item))
story.append(Paragraph(
    "b) <b>Saldo de 50%</b>, no valor de R$ 4.000,00 (quatro mil reais), até o "
    "encerramento da apresentação, no próprio dia do evento.", item))
story.append(Paragraph(
    "3.3. Os pagamentos serão efetuados via PIX/transferência bancária para a conta de "
    "titularidade do CONTRATADO: Banco do Brasil, Agência 1234-5, Conta Corrente "
    "67890-1, Chave PIX (CPF) 987.654.321-00.", corpo))
story.append(Paragraph(
    "3.4. O valor pactuado já contempla todas as despesas com a equipe artística do "
    "CONTRATADO, salvo aquelas expressamente atribuídas à CONTRATANTE neste contrato "
    "(Cláusulas 4ª e 5ª).", corpo))

story.append(Paragraph("CLÁUSULA 4ª — DAS OBRIGAÇÕES DA CONTRATANTE", clausula))
story.append(Paragraph("4.1. Constituem obrigações da CONTRATANTE:", corpo))
for txt in [
    "a) Efetuar os pagamentos nos valores, prazos e forma estabelecidos na Cláusula 3ª;",
    "b) Disponibilizar, às suas expensas, estrutura técnica de som e iluminação "
    "adequada e em pleno funcionamento, conforme o rider técnico (Anexo I);",
    "c) Fornecer local apropriado, seguro e energizado para a montagem dos "
    "equipamentos, com pontos de energia estabilizada e aterramento;",
    "d) Providenciar segurança no local do evento, incluindo a proteção da área de "
    "DJ (cabine/palco) e dos equipamentos;",
    "e) Arcar com transporte, hospedagem e alimentação do CONTRATADO e de 1 (um) "
    "acompanhante técnico, quando o evento ocorrer fora da cidade de domicílio do "
    "ARTISTA (não aplicável neste contrato, por ser na mesma cidade);",
    "f) Obter todas as licenças, alvarás e autorizações legais do evento, inclusive "
    "junto ao ECAD, isentando o CONTRATADO de qualquer responsabilidade a esse título.",
]:
    story.append(Paragraph(txt, item))

story.append(Paragraph("CLÁUSULA 5ª — DAS OBRIGAÇÕES DO CONTRATADO", clausula))
story.append(Paragraph("5.1. Constituem obrigações do CONTRATADO:", corpo))
for txt in [
    "a) Comparecer ao local do evento com antecedência mínima de 1 (uma) hora do "
    "horário de início do set, para passagem de som e ajustes;",
    "b) Executar a apresentação com zelo, profissionalismo e qualidade técnica, "
    "cumprindo integralmente a duração contratada;",
    "c) Levar os equipamentos pessoais de DJ (controladora/CDJs, fones, pen drives e "
    "acessórios), salvo se a estrutura for fornecida pela CONTRATANTE;",
    "d) Manter conduta adequada e compatível com o evento, zelando pela boa imagem de "
    "ambas as partes;",
    "e) Não comparecer sob efeito de substâncias que comprometam a apresentação.",
]:
    story.append(Paragraph(txt, item))

story.append(Paragraph("CLÁUSULA 6ª — DO ATRASO E DA TOLERÂNCIA", clausula))
story.append(Paragraph(
    "6.1. Será admitida tolerância de até 15 (quinze) minutos para o início da "
    "apresentação. Atrasos imputáveis ao CONTRATADO que ultrapassem esse limite "
    "poderão ensejar desconto proporcional no cachê, sem prejuízo de eventual "
    "indenização por perdas e danos comprovados.", corpo))
story.append(Paragraph(
    "6.2. Atrasos decorrentes de falhas de estrutura, energia ou organização do "
    "evento são de responsabilidade da CONTRATANTE e não autorizam qualquer desconto "
    "ao CONTRATADO.", corpo))

story.append(Paragraph("CLÁUSULA 7ª — DO CANCELAMENTO E DA MULTA", clausula))
story.append(Paragraph(
    "7.1. Em caso de cancelamento <b>pela CONTRATANTE</b>:", corpo))
for txt in [
    "a) Com mais de 30 (trinta) dias de antecedência: retenção do sinal já pago "
    "(50% do valor), a título de multa compensatória;",
    "b) Com 30 (trinta) dias ou menos de antecedência: devido o valor integral do "
    "contrato (100%), por se tratar de reserva de data com perda de oportunidade.",
]:
    story.append(Paragraph(txt, item))
story.append(Paragraph(
    "7.2. Em caso de cancelamento <b>pelo CONTRATADO</b>, este restituirá o sinal "
    "recebido, em dobro, salvo nos casos de força maior previstos na Cláusula 8ª.",
    corpo))

story.append(Paragraph("CLÁUSULA 8ª — DA FORÇA MAIOR E CASO FORTUITO", clausula))
story.append(Paragraph(
    "8.1. Nenhuma das partes será responsabilizada pelo descumprimento decorrente de "
    "caso fortuito ou força maior, nos termos do art. 393 do Código Civil, tais como "
    "catástrofes naturais, determinações governamentais, calamidade pública, problemas "
    "graves de saúde devidamente comprovados, entre outros eventos imprevisíveis e "
    "inevitáveis.", corpo))
story.append(Paragraph(
    "8.2. Ocorrendo hipótese de força maior, as partes envidarão esforços para remarcar "
    "a apresentação em nova data de comum acordo, sem incidência de multa.", corpo))

story.append(Paragraph("CLÁUSULA 9ª — DOS DIREITOS DE IMAGEM, SOM E DIVULGAÇÃO", clausula))
story.append(Paragraph(
    "9.1. O CONTRATADO autoriza a CONTRATANTE a utilizar sua imagem, nome artístico e "
    "voz exclusivamente para fins de divulgação do evento objeto deste contrato, em "
    "materiais promocionais e redes sociais, sem que isso gere remuneração adicional.",
    corpo))
story.append(Paragraph(
    "9.2. O CONTRATADO poderá registrar e divulgar sua participação no evento em seus "
    "próprios canais e redes sociais, para fins de portfólio e promoção artística.",
    corpo))

story.append(Paragraph("CLÁUSULA 10ª — DA NATUREZA DO CONTRATO", clausula))
story.append(Paragraph(
    "10.1. O presente contrato é de natureza estritamente civil, não gerando qualquer "
    "vínculo empregatício, societário ou de subordinação entre as partes, nos termos "
    "da legislação vigente. Cada parte é responsável por seus próprios encargos "
    "fiscais, trabalhistas e previdenciários.", corpo))

story.append(Paragraph("CLÁUSULA 11ª — DA RESCISÃO", clausula))
story.append(Paragraph(
    "11.1. O descumprimento de qualquer cláusula deste contrato faculta à parte "
    "prejudicada a rescisão, mediante notificação à parte infratora, sem prejuízo das "
    "penalidades e da reparação por perdas e danos.", corpo))

story.append(Paragraph("CLÁUSULA 12ª — DAS DISPOSIÇÕES GERAIS", clausula))
story.append(Paragraph(
    "12.1. Toda comunicação entre as partes será considerada válida quando realizada "
    "por escrito, inclusive por e-mail ou aplicativo de mensagens, nos contatos "
    "informados por cada parte.", corpo))
story.append(Paragraph(
    "12.2. Este contrato obriga as partes e seus sucessores, representando o acordo "
    "integral entre elas, e somente poderá ser alterado por aditivo escrito assinado "
    "por ambas.", corpo))

story.append(Paragraph("CLÁUSULA 13ª — DO FORO", clausula))
story.append(Paragraph(
    "13.1. Fica eleito o foro da Comarca de Florianópolis/SC para dirimir quaisquer "
    "dúvidas ou litígios oriundos do presente contrato, com renúncia a qualquer outro, "
    "por mais privilegiado que seja.", corpo))

story.append(S(10))
story.append(Paragraph(
    "E, por estarem assim justas e contratadas, as partes firmam o presente "
    "instrumento em 2 (duas) vias de igual teor e forma, na presença das testemunhas "
    "abaixo.", corpo))
story.append(S(6))
story.append(Paragraph("Florianópolis/SC, ______ de __________________ de 20____.", corpo))
story.append(S(28))

# ---------- ASSINATURAS ----------
linha = "_________________________________________"
ass = [
    [Paragraph(linha, assinatura), Paragraph(linha, assinatura)],
    [Paragraph("<b>CONTRATANTE</b><br/>Neon Nights Produções e Eventos Ltda.<br/>CNPJ 12.345.678/0001-90", assinatura),
     Paragraph("<b>CONTRATADO</b><br/>Jonathan Alves da Silva (DJ Maninho)<br/>CPF 987.654.321-00", assinatura)],
]
ta = Table(ass, colWidths=[8 * cm, 8 * cm])
ta.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 1), (-1, 1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
]))
story.append(ta)
story.append(S(26))

test = [
    [Paragraph("<b>Testemunhas:</b>", assinatura), Paragraph("", assinatura)],
    [Paragraph(linha, assinatura), Paragraph(linha, assinatura)],
    [Paragraph("Nome: Mariana Costa Lima<br/>CPF: 111.222.333-44", assinatura),
     Paragraph("Nome: Rafael Souza Pinto<br/>CPF: 555.666.777-88", assinatura)],
]
tt = Table(test, colWidths=[8 * cm, 8 * cm])
tt.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("ALIGN", (0, 0), (0, 0), "LEFT"),
]))
story.append(tt)

# ---------- ANEXO I ----------
from reportlab.platypus import PageBreak
story.append(PageBreak())
story.append(Paragraph("ANEXO I — RIDER TÉCNICO (mínimo)", titulo))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#222222"),
                        spaceBefore=0, spaceAfter=10))
rider = [
    "1 (um) par de CDJs compatíveis (Pioneer CDJ-2000/3000) ou mesa controladora equivalente;",
    "1 (um) mixer Pioneer DJM (900/A9) ou equivalente;",
    "1 (um) sistema de som profissional (P.A.) adequado ao público estimado, com retornos (monitores) na cabine;",
    "1 (um) par de fones de monitoração (opcional, o ARTISTA leva os seus);",
    "Mesa/bancada firme e nivelada para a cabine do DJ, com iluminação de apoio;",
    "Pontos de energia estabilizada (110/220V) com aterramento e no-break/estabilizador;",
    "Cabos de áudio (RCA/XLR) e adaptadores necessários para conexão;",
    "Acesso à internet/Wi-Fi na cabine (desejável).",
]
for r in rider:
    story.append(Paragraph("• " + r, item))
story.append(S(10))
story.append(Paragraph(
    "<i>Observação: este rider é referencial e poderá ser ajustado de comum acordo "
    "entre as partes conforme a estrutura do local e o porte do evento.</i>", corpo))

# ---------- BUILD ----------
doc = SimpleDocTemplate(
    OUT, pagesize=A4,
    leftMargin=2.2 * cm, rightMargin=2.2 * cm,
    topMargin=2.0 * cm, bottomMargin=2.0 * cm,
    title="Contrato de Prestação de Serviços Artísticos - DJ Maninho",
    author="Neon Nights Produções e Eventos Ltda.",
)
doc.build(story)
print("PDF gerado em:", OUT)
