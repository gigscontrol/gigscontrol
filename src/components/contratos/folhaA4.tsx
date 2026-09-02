"use client";

/**
 * Folha A4 do contrato (preview) + geração de PDF página a página.
 * Compartilhado entre o Novo Contrato e o Histórico. Recebe seções já
 * preenchidas (ou um `transformarTexto` para preencher na hora, usado no
 * preview do editor de modelos com dados de exemplo).
 */
import { type CSSProperties, type Ref } from "react";
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
  nomeArquivo: string
): Promise<void> {
  const pdf = await gerarPdfDoc(conteudoEl, estilo);
  if (pdf) pdf.save(`${nomeArquivo}.pdf`);
}

/**
 * Monta o documento jsPDF (sem salvar) — separado pra permitir também
 * `output()` (bench/preview). null se o container está vazio.
 */
export async function gerarPdfDoc(
  conteudoEl: HTMLElement,
  estilo: EstiloModelo
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

  const fundoRgb = hexParaRgb(estilo.corFundo);
  const [fr, fg, fb] = fundoRgb;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  let y = MTOP;
  let primeira = true;
  const novaPagina = () => {
    if (!primeira) pdf.addPage();
    primeira = false;
    pdf.setFillColor(fr, fg, fb);
    pdf.rect(0, 0, A4_W, A4_H, "F");
    y = MTOP;
  };
  novaPagina();

  for (const el of Array.from(conteudoEl.children) as HTMLElement[]) {
    // Quebra de página FORÇADA: um filho marcado (o relatório de assinaturas)
    // começa sempre numa folha nova. Não existe @media print/page-break no
    // fluxo (paginamos por imagem), então a quebra vive aqui no loop.
    if (el.dataset.novaPagina === "1" && y > MTOP) novaPagina();
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: estilo.corFundo,
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
          ctx.fillStyle = estilo.corFundo;
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

  return pdf;
}

function estiloTitulo(cor: string): CSSProperties {
  return {
    color: cor,
    fontSize: "11pt",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    textAlign: "center",
    marginBottom: "6pt",
  };
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
 * Relatório de assinaturas (padrão ZapSign): cabeçalho + um bloco por
 * signatário (moldura clean, miniatura da assinatura + grade rótulo:valor).
 * Cores fixas do papel (corFundo/corTexto/corTitulo) — vai pro PDF via
 * html2canvas, então tokens do tema (var(--x)) não valem aqui; bordas suaves
 * saem de um rgba derivado de corTexto (nada de concatenar hex).
 * As miniaturas de foto/selfie (KYC) só aparecem quando há URL — a rota
 * pública não as envia, então nunca vazam pra quem abre o link.
 */
function renderRelatorio(
  assinaturas: AssinaturaInfo[],
  estilo: EstiloModelo,
  tr: (s: string) => string,
  numeroContrato?: string,
  verificacaoId?: string | null
) {
  const [r, g, b] = hexParaRgb(estilo.corTexto);
  const borda = `rgba(${r}, ${g}, ${b}, 0.14)`;
  const bordaForte = `rgba(${r}, ${g}, ${b}, 0.3)`;

  return (
    <div
      style={{
        border: `1px solid ${borda}`,
        borderRadius: "6pt",
        padding: "14pt 16pt 16pt",
        background: estilo.corFundo,
      }}
    >
      {/* Cabeçalho */}
      <div
        style={{
          borderBottom: `1px solid ${borda}`,
          paddingBottom: "8pt",
          marginBottom: "12pt",
        }}
      >
        <div
          style={{
            color: estilo.corTitulo,
            fontSize: "12.5pt",
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          {tr("Relatório de assinaturas")}
        </div>
        <div style={{ fontSize: "8.5pt", opacity: 0.6, marginTop: "2pt" }}>
          {[
            numeroContrato ? `${tr("Contrato")} ${numeroContrato}` : "",
            `${tr("Emitido em")} ${dataHojeBr()}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {/* Selo público de autenticidade (mig 98) — impresso no papel. */}
        {verificacaoId && (
          <div style={{ fontSize: "8.5pt", opacity: 0.6, marginTop: "2pt" }}>
            {`${tr("Verificação de autenticidade")}: ${verificacaoId} · gigscontrol.com/verificar`}
          </div>
        )}
      </div>

      {/* Um bloco por signatário */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10pt" }}>
        {assinaturas.map((a, i) => {
          const assinou = !!a.assinadoEm || !!a.assinatura;
          return (
            <div
              key={i}
              style={{
                border: `1px solid ${borda}`,
                borderRadius: "5pt",
                padding: "10pt 12pt",
              }}
            >
              {/* Nome / papel + status */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "6mm",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "10.5pt" }}>{a.nome}</div>
                  {a.papel && (
                    <div
                      style={{
                        fontSize: "8pt",
                        opacity: 0.6,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        marginTop: "1pt",
                      }}
                    >
                      {a.papel}
                    </div>
                  )}
                </div>
                <span
                  style={{
                    fontSize: "7.5pt",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    padding: "2pt 8pt",
                    borderRadius: "999px",
                    whiteSpace: "nowrap",
                    border: `1px solid ${bordaForte}`,
                    opacity: assinou ? 1 : 0.55,
                  }}
                >
                  {assinou ? tr("Assinado") : tr("Pendente")}
                </span>
              </div>

              {/* Grade rótulo:valor + miniatura da assinatura */}
              <div
                style={{
                  display: "flex",
                  gap: "8mm",
                  alignItems: "flex-start",
                  marginTop: "8pt",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "2pt",
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
                {a.assinatura && (
                  <div style={{ width: "48mm", flexShrink: 0, textAlign: "center" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.assinatura}
                      alt=""
                      style={{ width: "100%", maxHeight: "16mm", objectFit: "contain" }}
                    />
                    <div
                      style={{
                        borderTop: `1px solid ${bordaForte}`,
                        marginTop: "2pt",
                        paddingTop: "2pt",
                        fontSize: "7pt",
                        opacity: 0.55,
                      }}
                    >
                      {tr("Assinatura")}
                    </div>
                  </div>
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
                    marginTop: "8pt",
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
                          style={{ height: "20mm", borderRadius: "2pt", objectFit: "cover" }}
                        />
                        <div style={{ fontSize: "6.5pt", opacity: 0.6, marginTop: "1pt" }}>
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
  const corpo: CSSProperties = { whiteSpace: "pre-wrap", textAlign: "justify" };

  switch (secao.tipo) {
    case "titulo":
      return (
        <div style={{ textAlign: "center" }}>
          {secao.titulo.trim() && (
            <h2
              style={{
                color: estilo.corTitulo,
                fontSize: "15pt",
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              {ex(secao.titulo)}
            </h2>
          )}
          {secao.subtitulo.trim() && (
            <p style={{ fontSize: "11pt", marginTop: "4pt", opacity: 0.85 }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "0pt" }}>
            {[secao.contratante, secao.contratado, secao.paragrafo]
              .filter((s) => s.trim())
              .map((s, i) => (
                <div key={i} style={corpo}>
                  {ex(s)}
                </div>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "0pt" }}>
            {secao.itens.map((item, idx) =>
              item.tipo === "clausula" ? (
                // CAPUT da cláusula: texto principal numerado "N." (padrão
                // BR: 3. texto… / 3.1 / 3.2). Respiro antes (não na 1ª).
                <div
                  key={item.id}
                  style={{ ...corpo, marginTop: idx > 0 ? "8pt" : undefined }}
                >
                  {`${num.clausulas[item.id]}. ${ex(item.texto)}`}
                </div>
              ) : (
                <div key={item.id} style={corpo}>
                  {item.tipo === "subclausula"
                    ? `${num.itens[item.id]} ${ex(item.texto)}`
                    : ex(item.texto)}
                </div>
              )
            )}
          </div>
        </div>
      );

    case "assinaturas": {
      const blocos: { nome: string; doc?: string; papel: string }[] = [
        {
          nome: ex("{{contratante}}"),
          doc: ex("{{documento}}"),
          papel: tr("CONTRATANTE"),
        },
        { nome: ex("{{artista}}"), papel: tr("CONTRATADO") },
      ];
      secao.testemunhas.forEach((testemunha, i) => {
        blocos.push({
          nome: testemunha.nome,
          doc: testemunha.documento,
          papel: `${tr("Testemunha")} ${i + 1}`,
        });
      });
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "26pt",
            paddingTop: "14pt",
          }}
        >
          {blocos.map((b, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              {(() => {
                const ass = achaAssinatura(assinaturas, b.papel);
                return ass?.assinatura ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ass.assinatura}
                    alt=""
                    style={{
                      height: "15mm",
                      objectFit: "contain",
                      marginBottom: "-2pt",
                    }}
                  />
                ) : null;
              })()}
              <div
                style={{
                  width: "70mm",
                  borderTop: `1px solid ${estilo.corTexto}`,
                }}
              />
              {b.nome && <span style={{ marginTop: "3pt" }}>{b.nome}</span>}
              {b.doc && b.doc.trim() && (
                <span style={{ fontSize: "9pt", opacity: 0.7, marginTop: "1pt" }}>
                  {b.doc}
                </span>
              )}
              <span
                style={{
                  fontSize: "9pt",
                  opacity: 0.7,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginTop: "1pt",
                }}
              >
                {b.papel}
              </span>
            </div>
          ))}
        </div>
      );
    }

    case "anexo":
      return (
        <div>
          <h3 style={estiloTitulo(estilo.corTitulo)}>{ex(secao.titulo)}</h3>
          <div style={corpo}>{ex(secao.conteudo)}</div>
        </div>
      );
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
            style={{ display: "flex", flexDirection: "column", gap: "18pt" }}
          >
            {secoes.map((secao) => (
              <div key={secao.id}>
                {renderSecao(secao, num, ex, estilo, tr, assinaturas)}
              </div>
            ))}
            {assinaturas &&
              assinaturas.some((a) => a.assinatura || a.assinadoEm) && (
                // data-nova-pagina: gerarPdfFolha força uma folha nova aqui.
                // marginTop (margem, não captada pelo html2canvas) só afasta o
                // relatório na TELA — parece uma folha separada, não colado.
                <div data-nova-pagina="1" style={{ marginTop: "40pt" }}>
                  {renderRelatorio(
                    assinaturas,
                    estilo,
                    tr,
                    numeroContrato,
                    verificacaoId
                  )}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
