import { ImageResponse } from "next/og";

/**
 * Imagem social (Open Graph) gerada em build/edge — 1200×630 PNG.
 *
 * Sem fonte externa nem fetch de propósito: usa a fonte padrão embutida do
 * `next/og` para não depender de rede durante o build (robustez).
 *
 * runtime EDGE de propósito: com "nodejs" o @vercel/og resolve o caminho da
 * fonte fallback via file-URL e quebra no Windows (ERR_INVALID_URL) — edge é
 * o runtime recomendado pra ImageResponse e funciona em dev e na Vercel.
 */
export const runtime = "edge";
export const alt =
  "Gigs Control — Sistema de gestão para agências de artistas e DJs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "88px 96px",
          backgroundColor: "#0A0E17",
          backgroundImage:
            "radial-gradient(circle at 18% 22%, rgba(61,123,255,0.30), transparent 55%), radial-gradient(circle at 92% 88%, rgba(74,196,255,0.14), transparent 50%)",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 132,
            height: 132,
            borderRadius: 30,
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontSize: 88,
            fontWeight: 800,
            backgroundImage:
              "linear-gradient(135deg, #4AC4FF 0%, #3D7BFF 52%, #2847D7 100%)",
          }}
        >
          G
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 52,
            fontSize: 104,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: -3,
          }}
        >
          GIGS CONTROL
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 26,
            fontSize: 38,
            color: "#9FB0C8",
            lineHeight: 1.25,
            maxWidth: 1010,
          }}
        >
          Sistema de gestão para agências de artistas e DJs
        </div>
      </div>
    ),
    { ...size }
  );
}
