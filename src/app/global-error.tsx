"use client";

// Captura erros de RENDER do React (App Router) e manda pro Sentry. Substitui a
// tela em branco por um fallback com "tentar de novo".
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100dvh",
          gap: 16,
          fontFamily: "system-ui, sans-serif",
          background: "#0b0b0f",
          color: "#fff",
          padding: 24,
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Algo deu errado.</h2>
        <p style={{ opacity: 0.7, fontSize: 14 }}>
          A gente já foi avisado. Tente de novo.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            background: "#3D7BFF",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
