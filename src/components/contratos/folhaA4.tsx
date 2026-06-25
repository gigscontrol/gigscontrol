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
import { useT } from "@/lib/i18n";

function temConteudo(secoes: SecaoModelo[]): boolean {
  return secoes.some((s) => {
    switch (s.tipo) {
      case "titulo":
        return !!(s.titulo.trim() || s.subtitulo.trim());
      case "partes":
        return !!(
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
 * Gera o PDF a partir do container das seções (`conteudoEl`, cujos filhos são
 * as seções). Página a página: o fundo preenche a folha inteira, a quebra
 * acontece ENTRE seções (nunca cortando texto) e toda página tem margem.
 * Lazy-load de jspdf/html2canvas (só carrega no clique).
 */
export async function gerarPdfFolha(
  conteudoEl: HTMLElement,
  estilo: EstiloModelo,
  nomeArquivo: string
): Promise<void> {
  if (conteudoEl.children.length === 0) return;
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
  const GAP = 6.5;

  const [fr, fg, fb] = hexParaRgb(estilo.corFundo);
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
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: estilo.corFundo,
      useCORS: true,
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
        const slicePx = Math.min(
          canvas.height - offset,
          Math.floor(dispMm * pxPorMm)
        );
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

  pdf.save(`${nomeArquivo}.pdf`);
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

/** Página "Relatório de Assinaturas" (estilo ZapSign), anexada ao final. */
function renderRelatorio(assinaturas: AssinaturaInfo[], estilo: EstiloModelo, tr: (s: string) => string) {
  return (
    <div
      style={{ borderTop: `2px solid ${estilo.corTitulo}`, paddingTop: "10pt" }}
    >
      <h3 style={estiloTitulo(estilo.corTitulo)}>{tr("Relatório de Assinaturas")}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "14pt" }}>
        {assinaturas.map((a, i) => (
          <div
            key={i}
            style={{ display: "flex", gap: "8mm", alignItems: "flex-start" }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>
                {a.nome}
                {a.assinadoEm ? ` — ${tr("Assinou")}` : ` — ${tr("Pendente")}`}
              </div>
              {a.papel && (
                <div
                  style={{
                    fontSize: "8.5pt",
                    opacity: 0.7,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  {a.papel}
                </div>
              )}
              <div
                style={{
                  fontSize: "8.5pt",
                  opacity: 0.85,
                  marginTop: "3pt",
                  lineHeight: 1.55,
                }}
              >
                {a.documento && <div>{tr("Documento:")} {a.documento}</div>}
                {a.assinadoEm && (
                  <div>{tr("Data/hora:")} {dataHoraRel(a.assinadoEm)}</div>
                )}
                {a.ip && <div>IP: {a.ip}</div>}
                {a.geolocalizacao && (
                  <div>{tr("Geolocalização:")} {a.geolocalizacao}</div>
                )}
                {a.dispositivo && (
                  <div style={{ wordBreak: "break-word" }}>
                    {tr("Dispositivo:")} {a.dispositivo}
                  </div>
                )}
                {typeof a.facialSimilaridade === "number" && (
                  <div>
                    {tr("Reconhecimento facial:")} {a.facialSimilaridade}%{" "}
                    {a.facialMatch ? `(${tr("compatível")})` : `(${tr("divergente")})`}
                  </div>
                )}
              </div>
              {(a.fotoCpfUrl ||
                a.fotoDocumentoUrl ||
                a.fotoDocumentoVersoUrl ||
                a.selfieUrl) && (
                <div
                  style={{
                    display: "flex",
                    gap: "4mm",
                    marginTop: "5pt",
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
                            height: "22mm",
                            borderRadius: "2pt",
                            objectFit: "cover",
                          }}
                        />
                        <div style={{ fontSize: "7pt", opacity: 0.7 }}>
                          {f.leg}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
            {a.assinatura && (
              <div style={{ width: "52mm", textAlign: "center", flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.assinatura}
                  alt=""
                  style={{
                    width: "100%",
                    maxHeight: "20mm",
                    objectFit: "contain",
                  }}
                />
                <div
                  style={{
                    borderTop: `1px solid ${estilo.corTexto}`,
                    fontSize: "7.5pt",
                    opacity: 0.7,
                    paddingTop: "2pt",
                  }}
                >
                  {a.nome}
                </div>
              </div>
            )}
          </div>
        ))}
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
          <h3 style={estiloTitulo(estilo.corTitulo)}>{tr("Das partes")}</h3>
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
          <h3 style={estiloTitulo(estilo.corTitulo)}>
            {tr("CLÁUSULA")} {num.clausulas[secao.id]}ª — {ex(secao.titulo)}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0pt" }}>
            {secao.itens.map((item) => (
              <div key={item.id} style={corpo}>
                {item.tipo === "subclausula"
                  ? `${num.itens[item.id]} ${ex(item.texto)}`
                  : ex(item.texto)}
              </div>
            ))}
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
}: {
  secoes: SecaoModelo[];
  estilo: EstiloModelo;
  folhaRef: Ref<HTMLDivElement>;
  conteudoRef: Ref<HTMLDivElement>;
  transformarTexto?: (s: string) => string;
  assinaturas?: AssinaturaInfo[];
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
          boxShadow: "0 6px 28px rgba(0,0,0,0.45)",
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
                <div>{renderRelatorio(assinaturas, estilo, tr)}</div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
