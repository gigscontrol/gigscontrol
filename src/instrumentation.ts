// Next.js carrega isto no boot do servidor. Puxa a config do Sentry conforme o
// runtime (Node ou Edge). onRequestError captura erros de Server Components/rotas.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
