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

function renderSecao(
  secao: SecaoModelo,
  num: ReturnType<typeof calcularNumeracao>,
  ex: (t: string) => string,
  estilo: EstiloModelo
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
          <h3 style={estiloTitulo(estilo.corTitulo)}>Das partes</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0pt" }}>
            {[secao.contratante, secao.contratado, secao.paragrafo]
              .filter((t) => t.trim())
              .map((t, i) => (
                <div key={i} style={corpo}>
                  {ex(t)}
                </div>
              ))}
          </div>
        </div>
      );

    case "clausula":
      return (
        <div>
          <h3 style={estiloTitulo(estilo.corTitulo)}>
            CLÁUSULA {num.clausulas[secao.id]}ª — {ex(secao.titulo)}
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
          papel: "CONTRATANTE",
        },
        { nome: ex("{{artista}}"), papel: "CONTRATADO" },
      ];
      secao.testemunhas.forEach((t, i) => {
        blocos.push({
          nome: t.nome,
          doc: t.documento,
          papel: `Testemunha ${i + 1}`,
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
}: {
  secoes: SecaoModelo[];
  estilo: EstiloModelo;
  folhaRef: Ref<HTMLDivElement>;
  conteudoRef: Ref<HTMLDivElement>;
  transformarTexto?: (t: string) => string;
}) {
  const num = calcularNumeracao(secoes);
  const ex = transformarTexto ?? ((t: string) => t);

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
            Nada para mostrar ainda.
          </p>
        ) : (
          <div
            ref={conteudoRef}
            style={{ display: "flex", flexDirection: "column", gap: "18pt" }}
          >
            {secoes.map((secao) => (
              <div key={secao.id}>{renderSecao(secao, num, ex, estilo)}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
