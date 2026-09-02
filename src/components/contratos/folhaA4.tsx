"use client";

/**
 * Folha A4 do contrato (preview) + geração de PDF página a página.
 * Compartilhado entre o Novo Contrato e o Histórico. Recebe seções já
 * preenchidas (ou um `transformarTexto` para preencher na hora, usado no
 * preview do editor de modelos com dados de exemplo).
 */
import { type CSSProperties, type ReactNode, type Ref } from "react";
import type { SecaoModelo, EstiloModelo } from "@/lib/mappers/contratoModelo";
import { calcularNumeracao } from "@/lib/contratos/numeracao";
import { resumirDispositivo } from "@/lib/contratos/dispositivo";
import { useT } from "@/lib/i18n";

function temConteudo(secoes: SecaoModelo[]): boolean {
  return secoes.some((s) => {
    switch (s.tipo) {
      case "titulo":
        return !!(s.titulo.trim() || s.subtitulo.trim());
      case "partes":
        return !!(
          s.titulo.trim() ||
          s.contratante.trim() ||
          s.contratado.trim() ||
          s.paragrafo.trim()
        );
      case "clausula":
        return !!(s.titulo.trim() || s.itens.some((i) => i.texto.trim()));
      case "anexo":
        return !!(s.titulo.trim() || s.conteudo.trim());
      case "localdata":
        return true; // a data automática sempre imprime algo
      case "assinaturas":
        return s.testemunhas.length > 0;
    }
  });
}

/** Hex (#rrggbb) → [r, g, b] pra preencher o fundo da página no jsPDF. */
export function hexParaRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  return [
    parseInt(m.slice(0, 2), 16) || 0,
    parseInt(m.slice(2, 4), 16) || 0,
    parseInt(m.slice(4, 6), 16) || 0,
  ];
}

/**
 * Acha um ponto de corte "limpo" pra fatiar uma seção alta: varre pra CIMA a
 * partir do corte desejado procurando uma linha de pixels 100% da cor de
 * fundo (o vão entre linhas de texto). Cortar ali nunca decapita letra.
 * Se não achar vão na janela (ex.: imagem contínua), devolve o alvo mesmo.
 */
function acharCorteLimpo(
  canvas: HTMLCanvasElement,
  alvoPx: number,
  minPx: number,
  fundo: [number, number, number]
): number {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return alvoPx;
  // Janela de busca: até ~160px acima do alvo (≈ 3 linhas em scale 2).
  const janela = Math.min(alvoPx - minPx, 160);
  if (janela <= 0) return alvoPx;
  const dados = ctx.getImageData(0, alvoPx - janela, canvas.width, janela).data;
  const [br, bg, bb] = fundo;
  const TOL = 16; // tolerância por canal (anti-aliasing/JPEG do fundo)
  for (let linha = janela - 1; linha >= 0; linha--) {
    let limpa = true;
    const base = linha * canvas.width * 4;
    // Amostra 1 a cada 3 pixels — suficiente pra detectar tinta de texto.
    for (let x = 0; x < canvas.width; x += 3) {
      const i = base + x * 4;
      if (
        Math.abs(dados[i] - br) > TOL ||
        Math.abs(dados[i + 1] - bg) > TOL ||
        Math.abs(dados[i + 2] - bb) > TOL
      ) {
        limpa = false;
        break;
      }
    }
    if (limpa) return alvoPx - janela + linha + 1;
  }
  return alvoPx;
}

/**
 * Gera o PDF a partir do container das seções (`conteudoEl`, cujos filhos são
 * as seções). Página a página: o fundo preenche a folha inteira, a quebra
 * acontece ENTRE seções e, quando uma seção é maior que a página, a fatia
 * cai num VÃO entre linhas de texto (acharCorteLimpo) — nunca no meio de uma
 * letra. Cada captura leva uma folga no rodapé pro html2canvas não decepar
 * os descendentes (g, p, ç) da última linha.
 * Lazy-load de jspdf/html2canvas (só carrega no clique).
 */
export async function gerarPdfFolha(
  conteudoEl: HTMLElement,
  estilo: EstiloModelo,
  nomeArquivo: string,
  opts?: { verificacaoId?: string | null }
): Promise<void> {
  const pdf = await gerarPdfDoc(conteudoEl, estilo, opts);
  if (pdf) pdf.save(`${nomeArquivo}.pdf`);
}

/**
 * Monta o documento jsPDF (sem salvar) — separado pra permitir também
 * `output()` (bench/preview). null se o container está vazio.
 */
export async function gerarPdfDoc(
  conteudoEl: HTMLElement,
  estilo: EstiloModelo,
  opts?: { verificacaoId?: string | null }
): Promise<import("jspdf").jsPDF | null> {
  if (conteudoEl.children.length === 0) return null;
  const [{ jsPDF }, html2canvasMod] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);
  const html2canvas = html2canvasMod.default;

  const A4_W = 210;
  const A4_H = 297;
  const MX = 20;
  const MTOP = 22;
  const MBOT = 22;
  const contentW = A4_W - 2 * MX;
  const limiteY = A4_H - MBOT;
  const GAP = 4;
  // Folga (px CSS) além da altura medida do elemento: captura os descendentes
  // que o html2canvas cortava na última linha (bug do "letra decepada").
  const FOLGA_CAPTURA = 8;

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // Fundo POR PÁGINA: o documento usa a cor do modelo; a(s) página(s) do
  // relatório de assinaturas (data-pagina-branca) são SEMPRE brancas.
  let fundoPagina = estilo.corFundo;
  let y = MTOP;
  let primeira = true;
  const novaPagina = () => {
    if (!primeira) pdf.addPage();
    primeira = false;
    const [fr, fg, fb] = hexParaRgb(fundoPagina);
    pdf.setFillColor(fr, fg, fb);
    pdf.rect(0, 0, A4_W, A4_H, "F");
    y = MTOP;
  };
  novaPagina();

  for (const el of Array.from(conteudoEl.children) as HTMLElement[]) {
    const branca = el.dataset.paginaBranca === "1";
    const fundoEl = branca ? "#ffffff" : estilo.corFundo;
    // Quebra de página FORÇADA: filho marcado (relatório) começa em folha
    // nova; idem quando o FUNDO da página muda (colorido → branco e volta).
    const precisaNova =
      el.dataset.novaPagina === "1" || fundoEl !== fundoPagina;
    fundoPagina = fundoEl;
    if (precisaNova && y > MTOP) novaPagina();
    const fundoRgb = hexParaRgb(fundoEl);

    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: fundoEl,
      useCORS: true,
      height: Math.ceil(el.getBoundingClientRect().height) + FOLGA_CAPTURA,
    });
    const hmm = (canvas.height / canvas.width) * contentW;

    if (hmm <= limiteY - MTOP) {
      if (y + hmm > limiteY && y > MTOP) novaPagina();
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        MX,
        y,
        contentW,
        hmm
      );
      y += hmm + GAP;
    } else {
      const pxPorMm = canvas.height / hmm;
      let offset = 0;
      while (offset < canvas.height) {
        if (y > MTOP) novaPagina();
        const dispMm = limiteY - y;
        const restante = canvas.height - offset;
        let slicePx = Math.min(restante, Math.floor(dispMm * pxPorMm));
        // Se ainda sobra conteúdo depois desta fatia, recua o corte pro vão
        // entre linhas mais próximo — texto nunca é cortado ao meio.
        if (slicePx < restante) {
          slicePx =
            acharCorteLimpo(canvas, offset + slicePx, offset + 1, fundoRgb) -
            offset;
        }
        const tmp = document.createElement("canvas");
        tmp.width = canvas.width;
        tmp.height = slicePx;
        const ctx = tmp.getContext("2d");
        if (ctx) {
          ctx.fillStyle = fundoEl;
          ctx.fillRect(0, 0, canvas.width, slicePx);
          ctx.drawImage(
            canvas,
            0,
            offset,
            canvas.width,
            slicePx,
            0,
            0,
            canvas.width,
            slicePx
          );
        }
        const sliceMm = slicePx / pxPorMm;
        pdf.addImage(
          tmp.toDataURL("image/jpeg", 0.95),
          "JPEG",
          MX,
          y,
          contentW,
          sliceMm
        );
        offset += slicePx;
        y += sliceMm + GAP;
      }
    }
  }

  // Rodapé de validade em TODAS as páginas (padrão das plataformas de
  // assinatura). Cinza médio — legível sobre fundo claro E escuro.
  const rodape = [
    "Documento gerado na GIGS CONTROL · Assinatura eletrônica com validade jurídica — MP 2.200-2/2001 e Lei 14.063/2020",
    opts?.verificacaoId
      ? `Verificação: ${opts.verificacaoId} · gigscontrol.com/verificar`
      : "",
  ]
    .filter(Boolean)
    .join("  |  ");
  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    pdf.setFontSize(6.5);
    pdf.setTextColor(138, 138, 145);
    pdf.text(rodape, A4_W / 2, A4_H - 6, { align: "center" });
  }

  return pdf;
}

function estiloTitulo(cor: string): CSSProperties {
  return {
    color: cor,
    fontSize: "11.5pt",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    textAlign: "center",
    marginBottom: "8pt",
  };
}

// ---------------- Texto rico + reflow (padrão dos contratos) ----------------

/**
 * Formatação inline nos textos do modelo: **negrito**, *itálico* e
 * __sublinhado__ (inseridos pela barra de formatação do editor ou digitados).
 * Sem aninhamento — o suficiente pra destacar trechos de cláusula.
 */
function richInline(texto: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*\n]+)\*)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) out.push(texto.slice(ultimo, m.index));
    if (m[2] !== undefined) out.push(<strong key={`${keyBase}b${k++}`}>{m[2]}</strong>);
    else if (m[4] !== undefined) out.push(<u key={`${keyBase}u${k++}`}>{m[4]}</u>);
    else out.push(<em key={`${keyBase}i${k++}`}>{m[6]}</em>);
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) out.push(texto.slice(ultimo));
  return out;
}

/**
 * REFLOW do corpo: quebra de linha SIMPLES vira espaço (texto colado de
 * outro lugar volta a fluir justificado até a margem — era o que deixava as
 * cláusulas "picotadas"); linha EM BRANCO separa parágrafos de verdade.
 */
function paragrafosDe(texto: string): string[] {
  return texto
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/**
 * Corpo de contrato: justificado, com reflow e formatação inline. `prefixo`
 * (ex.: "CLÁUSULA 14ª." em negrito) entra colado no início do 1º parágrafo.
 */
function CorpoRico({
  texto,
  prefixo,
  style,
}: {
  texto: string;
  prefixo?: ReactNode;
  style?: CSSProperties;
}) {
  const paragrafos = paragrafosDe(texto);
  if (paragrafos.length === 0 && !prefixo) return null;
  if (paragrafos.length === 0) {
    return <div style={{ textAlign: "justify", ...style }}>{prefixo}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5pt", ...style }}>
      {paragrafos.map((p, i) => (
        <div key={i} style={{ textAlign: "justify" }}>
          {i === 0 && prefixo ? <>{prefixo} </> : null}
          {richInline(p, `p${i}`)}
        </div>
      ))}
    </div>
  );
}

/** Dados de uma assinatura registrada (folha assinada + relatório). */
export type AssinaturaInfo = {
  nome: string;
  papel: string | null;
  documento: string | null;
  email?: string | null;
  ip: string | null;
  geolocalizacao: string | null;
  dispositivo: string | null;
  assinadoEm: string | null;
  assinatura: string | null; // PNG data URL
  // URLs (assinadas) das fotos — Fase 2.
  fotoCpfUrl?: string;
  fotoDocumentoUrl?: string;
  fotoDocumentoVersoUrl?: string;
  selfieUrl?: string;
  // Reconhecimento facial — Fase 3.
  facialSimilaridade?: number;
  facialMatch?: boolean;
};

/** Acha a assinatura que combina com o papel do bloco (contratante/contratado). */
function achaAssinatura(
  assinaturas: AssinaturaInfo[] | undefined,
  papelBloco: string
): AssinaturaInfo | undefined {
  if (!assinaturas) return undefined;
  const p = papelBloco.toLowerCase();
  const tem = (chave: string) =>
    assinaturas.find(
      (a) => (a.papel ?? "").toLowerCase().includes(chave) && a.assinatura
    );
  if (p.includes("contratante")) return tem("contratante");
  if (p.includes("contratado")) return tem("contratado");
  return undefined;
}

function dataHoraRel(iso: string | null): string {
  if (!iso) return "";
  const d = iso.slice(0, 10).split("-");
  const h = iso.slice(11, 16);
  if (d.length !== 3) return iso;
  return `${d[2]}/${d[1]}/${d[0]}${h ? ` ${h}` : ""}`;
}

/** Data de hoje (DD/MM/AAAA) — usada no cabeçalho do relatório. */
function dataHojeBr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Linha "rótulo: valor" da grade do relatório; some se o valor for vazio. */
function LinhaInfo({ rotulo, valor }: { rotulo: string; valor: string }) {
  if (!valor) return null;
  return (
    <div style={{ display: "flex", gap: "6pt", fontSize: "8.5pt", lineHeight: 1.5 }}>
      <span style={{ minWidth: "27mm", opacity: 0.55, flexShrink: 0 }}>{rotulo}</span>
      <span style={{ wordBreak: "break-word" }}>{valor}</span>
    </div>
  );
}

/**
 * RELATÓRIO DE ASSINATURAS — página EXTRA sempre BRANCA (padrão ZapSign),
 * independente das cores que o usuário escolheu pro documento. Paleta fixa
 * (nada de estilo do modelo): cabeçalho, bloco de identificação (número,
 * código público de verificação, hash SHA-256), um cartão por signatário com
 * as evidências e o selo de validade jurídica no rodapé.
 * As miniaturas de foto/selfie (KYC) só aparecem quando há URL — a rota
 * pública não as envia, então nunca vazam pra quem abre o link.
 */
const REL_TEXTO = "#1c1c22";
const REL_MUTED = "#6d6d78";
const REL_BORDA = "#e3e3ea";
const REL_FUNDO2 = "#f6f6f8";
const REL_VERDE = "#177a44";
const REL_VERDE_BG = "#e7f6ee";

function renderRelatorio(
  assinaturas: AssinaturaInfo[],
  tr: (s: string) => string,
  numeroContrato?: string,
  verificacaoId?: string | null,
  conteudoHash?: string | null
) {
  return (
    <div
      style={{
        background: "#ffffff",
        color: REL_TEXTO,
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        fontSize: "9pt",
        lineHeight: 1.55,
      }}
    >
      {/* Cabeçalho */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "8mm",
        }}
      >
        <div>
          <div style={{ fontSize: "16pt", fontWeight: 700, letterSpacing: "0.01em" }}>
            {tr("Relatório de assinaturas")}
          </div>
          <div style={{ fontSize: "8pt", color: REL_MUTED, marginTop: "2pt" }}>
            {`${tr("Emitido em")} ${dataHojeBr()} · ${tr("Datas e horários em UTC")}`}
          </div>
        </div>
        <div
          style={{
            fontSize: "9.5pt",
            fontWeight: 800,
            letterSpacing: "0.14em",
            color: REL_TEXTO,
            whiteSpace: "nowrap",
            paddingTop: "3pt",
          }}
        >
          GIGS CONTROL
        </div>
      </div>

      <div style={{ borderTop: `2px solid ${REL_TEXTO}`, margin: "8pt 0 10pt" }} />

      {/* Identificação do documento */}
      <div
        style={{
          border: `1px solid ${REL_BORDA}`,
          background: REL_FUNDO2,
          borderRadius: "5pt",
          padding: "9pt 11pt",
          display: "flex",
          flexDirection: "column",
          gap: "3pt",
        }}
      >
        {numeroContrato && (
          <div style={{ display: "flex", gap: "6pt" }}>
            <span style={{ minWidth: "34mm", color: REL_MUTED }}>{tr("Documento")}</span>
            <span style={{ fontWeight: 700 }}>{numeroContrato}</span>
          </div>
        )}
        {verificacaoId && (
          <div style={{ display: "flex", gap: "6pt" }}>
            <span style={{ minWidth: "34mm", color: REL_MUTED }}>
              {tr("Código de verificação")}
            </span>
            <span style={{ fontFamily: "Consolas, monospace", fontWeight: 700 }}>
              {verificacaoId}
              <span style={{ color: REL_MUTED, fontWeight: 400 }}>
                {" "}
                · gigscontrol.com/verificar
              </span>
            </span>
          </div>
        )}
        {conteudoHash && (
          <div style={{ display: "flex", gap: "6pt" }}>
            <span style={{ minWidth: "34mm", color: REL_MUTED, flexShrink: 0 }}>
              {tr("Hash do conteúdo (SHA-256)")}
            </span>
            <span
              style={{
                fontFamily: "Consolas, monospace",
                fontSize: "7pt",
                wordBreak: "break-all",
                paddingTop: "1pt",
              }}
            >
              {conteudoHash}
            </span>
          </div>
        )}
      </div>

      {/* Assinaturas */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          margin: "12pt 0 6pt",
        }}
      >
        <span style={{ fontSize: "11pt", fontWeight: 700 }}>{tr("Assinaturas")}</span>
        <span style={{ fontSize: "8pt", color: REL_MUTED }}>
          {assinaturas.length}{" "}
          {assinaturas.length === 1 ? tr("assinatura") : tr("assinaturas")}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8pt" }}>
        {assinaturas.map((a, i) => {
          const assinou = !!a.assinadoEm || !!a.assinatura;
          return (
            <div
              key={i}
              style={{
                border: `1px solid ${REL_BORDA}`,
                borderRadius: "5pt",
                padding: "9pt 11pt",
              }}
            >
              {/* Badge + nome/papel */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "6mm",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "7pt",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      padding: "1.5pt 7pt",
                      borderRadius: "999px",
                      background: assinou ? REL_VERDE_BG : REL_FUNDO2,
                      color: assinou ? REL_VERDE : REL_MUTED,
                      marginBottom: "3pt",
                    }}
                  >
                    {assinou ? `✓ ${tr("Assinado")}` : tr("Pendente")}
                  </span>
                  <div style={{ fontWeight: 700, fontSize: "10.5pt" }}>{a.nome}</div>
                  {a.papel && (
                    <div
                      style={{
                        fontSize: "7.5pt",
                        color: REL_MUTED,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginTop: "1pt",
                      }}
                    >
                      {a.papel}
                    </div>
                  )}
                </div>
                {a.assinatura && (
                  <div
                    style={{
                      width: "46mm",
                      flexShrink: 0,
                      textAlign: "center",
                      border: `1px solid ${REL_BORDA}`,
                      borderRadius: "4pt",
                      padding: "4pt 6pt 3pt",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.assinatura}
                      alt=""
                      style={{ width: "100%", maxHeight: "14mm", objectFit: "contain" }}
                    />
                    <div
                      style={{
                        borderTop: `1px solid ${REL_BORDA}`,
                        marginTop: "2pt",
                        paddingTop: "2pt",
                        fontSize: "6.5pt",
                        color: REL_MUTED,
                      }}
                    >
                      {tr("Assinatura registrada")}
                    </div>
                  </div>
                )}
              </div>

              {/* Evidências */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2pt",
                  marginTop: "6pt",
                }}
              >
                <LinhaInfo rotulo={tr("Documento")} valor={a.documento ?? ""} />
                <LinhaInfo rotulo={tr("E-mail")} valor={a.email ?? ""} />
                <LinhaInfo rotulo={tr("Assinado em")} valor={dataHoraRel(a.assinadoEm)} />
                <LinhaInfo rotulo="IP" valor={a.ip ?? ""} />
                <LinhaInfo
                  rotulo={tr("Dispositivo")}
                  valor={resumirDispositivo(a.dispositivo)}
                />
                <LinhaInfo rotulo={tr("Geolocalização")} valor={a.geolocalizacao ?? ""} />
                {typeof a.facialSimilaridade === "number" && (
                  <LinhaInfo
                    rotulo={tr("Reconhecimento facial")}
                    valor={`${a.facialSimilaridade}% ${
                      a.facialMatch ? `(${tr("compatível")})` : `(${tr("divergente")})`
                    }`}
                  />
                )}
              </div>

              {/* KYC — só interno (a rota pública não manda URL de foto/selfie) */}
              {(a.fotoCpfUrl ||
                a.fotoDocumentoUrl ||
                a.fotoDocumentoVersoUrl ||
                a.selfieUrl) && (
                <div
                  style={{
                    display: "flex",
                    gap: "4mm",
                    marginTop: "7pt",
                    flexWrap: "wrap",
                  }}
                >
                  {[
                    { url: a.fotoCpfUrl, leg: "CPF" },
                    { url: a.fotoDocumentoUrl, leg: tr("Documento (frente)") },
                    { url: a.fotoDocumentoVersoUrl, leg: tr("Documento (verso)") },
                    { url: a.selfieUrl, leg: tr("Selfie") },
                  ]
                    .filter((f) => f.url)
                    .map((f, j) => (
                      <div key={j} style={{ textAlign: "center" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.url as string}
                          alt=""
                          style={{
                            height: "20mm",
                            borderRadius: "3pt",
                            objectFit: "cover",
                            border: `1px solid ${REL_BORDA}`,
                          }}
                        />
                        <div
                          style={{ fontSize: "6.5pt", color: REL_MUTED, marginTop: "1pt" }}
                        >
                          {f.leg}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selo de validade jurídica */}
      <div
        style={{
          marginTop: "12pt",
          border: `1px solid ${REL_BORDA}`,
          borderLeft: `3px solid ${REL_VERDE}`,
          borderRadius: "5pt",
          padding: "8pt 11pt",
          background: REL_FUNDO2,
        }}
      >
        <div
          style={{
            fontSize: "8pt",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: REL_VERDE,
          }}
        >
          {tr("Validade jurídica")}
        </div>
        <div style={{ fontSize: "8pt", color: REL_MUTED, marginTop: "2pt" }}>
          {tr(
            "Assinaturas eletrônicas têm validade legal, nos termos do art. 10, §2º, da MP 2.200-2/2001 e da Lei 14.063/2020."
          )}
          {verificacaoId
            ? ` ${tr("Verifique a autenticidade em")} gigscontrol.com/verificar · ${verificacaoId}`
            : ""}
        </div>
      </div>
    </div>
  );
}

function renderSecao(
  secao: SecaoModelo,
  num: ReturnType<typeof calcularNumeracao>,
  ex: (s: string) => string,
  estilo: EstiloModelo,
  tr: (s: string) => string,
  assinaturas?: AssinaturaInfo[]
) {
  switch (secao.tipo) {
    case "titulo":
      return (
        <div style={{ textAlign: "center" }}>
          {secao.titulo.trim() && (
            <h2
              style={{
                color: estilo.corTitulo,
                fontSize: "18pt",
                fontWeight: 700,
                letterSpacing: "0.02em",
                lineHeight: 1.3,
              }}
            >
              {ex(secao.titulo)}
            </h2>
          )}
          {secao.subtitulo.trim() && (
            <p
              style={{
                fontSize: "11.5pt",
                marginTop: "5pt",
                opacity: 0.85,
                fontStyle: "italic",
              }}
            >
              {ex(secao.subtitulo)}
            </p>
          )}
        </div>
      );

    case "partes":
      return (
        <div>
          {/* Título EDITÁVEL da seção (campo `titulo`); vazio = sem cabeçalho. */}
          {secao.titulo.trim() && (
            <h3 style={estiloTitulo(estilo.corTitulo)}>{ex(secao.titulo)}</h3>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "8pt" }}>
            {[secao.contratante, secao.contratado, secao.paragrafo]
              .filter((s) => s.trim())
              .map((s, i) => (
                <CorpoRico key={i} texto={ex(s)} />
              ))}
          </div>
        </div>
      );

    case "clausula":
      return (
        <div>
          {/* Título da SEÇÃO (opcional) — as cláusulas vivem nos itens. */}
          {secao.titulo.trim() && (
            <h3 style={estiloTitulo(estilo.corTitulo)}>{ex(secao.titulo)}</h3>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "6pt" }}>
            {secao.itens.map((item, idx) =>
              item.tipo === "clausula" ? (
                // CAPUT: "CLÁUSULA 14ª." em negrito + texto justificado
                // (padrão dos contratos BR). Respiro antes (não no 1º item).
                <CorpoRico
                  key={item.id}
                  texto={ex(item.texto)}
                  prefixo={
                    <strong>
                      {tr("CLÁUSULA")} {num.clausulas[item.id]}ª.
                    </strong>
                  }
                  style={{ marginTop: idx > 0 ? "6pt" : undefined }}
                />
              ) : item.tipo === "subclausula" ? (
                // Sub-cláusula também escreve "CLÁUSULA 1.1." na frente.
                <CorpoRico
                  key={item.id}
                  texto={ex(item.texto)}
                  prefixo={
                    <strong>
                      {tr("CLÁUSULA")} {num.itens[item.id]}.
                    </strong>
                  }
                />
              ) : (
                // Parágrafo INTEIRO em itálico (mesma fonte do corpo), rótulo
                // "Parágrafo único." / "§ 1º." sem negrito — pedido do dono.
                <CorpoRico
                  key={item.id}
                  texto={ex(item.texto)}
                  prefixo={
                    num.paragrafos[item.id] === "Parágrafo único"
                      ? `${tr("Parágrafo único")}.`
                      : `${num.paragrafos[item.id] ?? "§"}.`
                  }
                  style={{ fontStyle: "italic" }}
                />
              )
            )}
          </div>
        </div>
      );

    case "assinaturas": {
      // Nomes: campos RESOLVIDOS na geração (secao.contratanteNome etc.);
      // no preview do modelo caem nos tokens via ex. Token que sobreviver
      // cru (contrato antigo, gerado antes do fix) vira vazio — linha de
      // assinatura sem nome é melhor que "{{contratante}}" impresso.
      const semTokenCru = (s: string | undefined): string => {
        const v = (s ?? "").trim();
        return /^\{\{.+\}\}$/.test(v) ? "" : v;
      };
      const blocos: { nome: string; doc?: string; papel: string }[] = [
        {
          nome: semTokenCru(secao.contratanteNome || ex("{{contratante}}")),
          doc: semTokenCru(secao.contratanteDoc || ex("{{documento}}")),
          papel: tr("CONTRATANTE"),
        },
        {
          nome: semTokenCru(secao.contratadoNome || ex("{{artista}}")),
          papel: tr("CONTRATADO"),
        },
      ];
      secao.testemunhas.forEach((testemunha, i) => {
        blocos.push({
          nome: testemunha.nome,
          doc: testemunha.documento,
          papel: `${tr("Testemunha")} ${i + 1}`,
        });
      });
      return (
        // Blocos LADO A LADO (2 por linha), com espaço reservado pra
        // assinatura — mesmo vazio o layout fica alinhado, estilo ZapSign.
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "14pt 12mm",
            paddingTop: "16pt",
          }}
        >
          {blocos.map((b, i) => {
            const ass = achaAssinatura(assinaturas, b.papel);
            return (
              <div
                key={i}
                style={{
                  width: "72mm",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                {/* Área da assinatura — altura fixa, com ou sem imagem. */}
                <div
                  style={{
                    height: "16mm",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                  }}
                >
                  {ass?.assinatura ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ass.assinatura}
                      alt=""
                      style={{
                        maxHeight: "15mm",
                        maxWidth: "60mm",
                        objectFit: "contain",
                        marginBottom: "-2pt",
                      }}
                    />
                  ) : null}
                </div>
                <div
                  style={{
                    width: "100%",
                    borderTop: `1.5px solid ${estilo.corTexto}`,
                  }}
                />
                {b.nome && (
                  <span style={{ marginTop: "4pt", fontWeight: 700, fontSize: "10.5pt" }}>
                    {b.nome}
                  </span>
                )}
                {b.doc && b.doc.trim() && (
                  <span style={{ fontSize: "8.5pt", opacity: 0.7, marginTop: "1pt" }}>
                    {b.doc}
                  </span>
                )}
                <span
                  style={{
                    fontSize: "8.5pt",
                    opacity: 0.7,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginTop: "2pt",
                  }}
                >
                  {b.papel}
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    case "anexo": {
      // Anexos costumam ser LISTAS (rider) — cada linha vira um item; a
      // formatação inline (**b**/*i*/__u__) vale linha a linha.
      const linhas = ex(secao.conteudo)
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return (
        <div>
          <h3 style={estiloTitulo(estilo.corTitulo)}>{ex(secao.titulo)}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "3pt" }}>
            {linhas.map((l, i) => (
              <div key={i} style={{ textAlign: "justify" }}>
                {richInline(l, `ax${i}`)}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "localdata": {
      // "São José dos Pinhais, 21/08/2026" — centrado. No contrato gerado a
      // data já vem resolvida (preencherSecoes); no preview cai no exemplo.
      const dataTxt = secao.data.trim() || ex("{{data_hoje}}");
      const localTxt = secao.local.trim() ? `${ex(secao.local)}, ` : "";
      return (
        <div style={{ textAlign: "center", paddingTop: "6pt" }}>
          {localTxt}
          {dataTxt}
        </div>
      );
    }
  }
}

/**
 * Folha A4 (210×297mm) com as cores do contrato. `transformarTexto` permite
 * preencher tokens na hora (preview de modelo); por padrão renderiza o texto
 * como está (contrato já preenchido). `conteudoRef` aponta o container das
 * seções — usado pela geração de PDF.
 */
export function FolhaA4({
  secoes,
  estilo,
  folhaRef,
  conteudoRef,
  transformarTexto,
  assinaturas,
  numeroContrato,
  verificacaoId,
  conteudoHash,
}: {
  secoes: SecaoModelo[];
  estilo: EstiloModelo;
  folhaRef: Ref<HTMLDivElement>;
  conteudoRef: Ref<HTMLDivElement>;
  transformarTexto?: (s: string) => string;
  assinaturas?: AssinaturaInfo[];
  /** Nº do contrato, mostrado no cabeçalho do relatório de assinaturas. */
  numeroContrato?: string;
  /** Código público GC-XXXX-XXXX (contrato finalizado) — impresso no relatório. */
  verificacaoId?: string | null;
  /** SHA-256 do conteúdo (mig 98) — impresso no relatório de assinaturas. */
  conteudoHash?: string | null;
}) {
  const tr = useT();
  const num = calcularNumeracao(secoes);
  const ex = transformarTexto ?? ((s: string) => s);

  return (
    <div
      className="overflow-auto rounded-md p-4"
      style={{
        background: "var(--bg-main)",
        border: "1px solid var(--border-color)",
      }}
    >
      <div
        ref={folhaRef}
        style={{
          width: "210mm",
          minHeight: "297mm",
          margin: "0 auto",
          padding: "22mm 20mm",
          background: estilo.corFundo,
          color: estilo.corTexto,
          boxShadow: "0 6px 28px var(--shadow-color)",
          fontFamily: "'Times New Roman', Georgia, serif",
          fontSize: "11pt",
          lineHeight: 1.6,
        }}
      >
        {!temConteudo(secoes) ? (
          <p style={{ fontStyle: "italic", opacity: 0.55 }}>
            {tr("Nada para mostrar ainda.")}
          </p>
        ) : (
          <div
            ref={conteudoRef}
            style={{ display: "flex", flexDirection: "column", gap: "24pt" }}
          >
            {secoes.map((secao) => (
              <div key={secao.id}>
                {renderSecao(secao, num, ex, estilo, tr, assinaturas)}
              </div>
            ))}
            {assinaturas &&
              assinaturas.some((a) => a.assinatura || a.assinadoEm) && (
                // data-nova-pagina + data-pagina-branca: no PDF o relatório
                // começa numa folha nova SEMPRE BRANCA (mesmo com o documento
                // em outra cor). Na TELA, o bloco branco arredondado com
                // margem simula essa folha à parte.
                <div
                  data-nova-pagina="1"
                  data-pagina-branca="1"
                  style={{
                    marginTop: "40pt",
                    background: "#ffffff",
                    borderRadius: "4pt",
                    padding: "8mm",
                  }}
                >
                  {renderRelatorio(
                    assinaturas,
                    tr,
                    numeroContrato,
                    verificacaoId,
                    conteudoHash
                  )}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
