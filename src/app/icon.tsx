import { ImageResponse } from "next/og";

/**
 * Favicon (aba do navegador + resultado de busca do Google) — 96×96 PNG.
 *
 * "G" branco num quadrado azul com gradiente da marca (mesmo do card social e
 * da topbar do app). Sólido e legível em 16px — diferente do traço fino
 * transparente do SVG antigo, que sumia em tamanho pequeno.
 *
 * runtime EDGE de propósito: com "nodejs" o @vercel/og resolve a fonte fallback
 * por file-URL e quebra no Windows (ERR_INVALID_URL).
 */
export const runtime = "edge";
export const size = { width: 96, height: 96 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontSize: 66,
          fontWeight: 800,
          borderRadius: 20,
          backgroundImage:
            "linear-gradient(135deg, #4AC4FF 0%, #3D7BFF 52%, #2847D7 100%)",
        }}
      >
        G
      </div>
    ),
    { ...size }
  );
}
