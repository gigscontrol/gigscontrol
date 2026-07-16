import { ImageResponse } from "next/og";

/**
 * Apple touch icon (iOS "adicionar à tela inicial") — 180×180 PNG.
 *
 * Full-bleed (sem cantos arredondados: o iOS aplica a própria máscara). Mesma
 * marca do favicon: "G" branco no quadrado azul com gradiente.
 */
export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 122,
          fontWeight: 800,
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
