import { withSentryConfig } from "@sentry/nextjs";

// Cabeçalhos de segurança aplicados a TODAS as respostas. São os "seguros"
// (não quebram Stripe/Supabase/Sentry/pdfjs). CSP NÃO entra aqui de propósito:
// exige rollout testado (Report-Only primeiro) pra não bloquear os iframes do
// Stripe, o worker do pdfjs e scripts inline do Next — fica de follow-up.
const securityHeaders = [
  // Força HTTPS por 2 anos (o site já roda 100% em HTTPS na Vercel + domínio).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Impede o browser de "adivinhar" o MIME (defesa contra content-sniffing).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Anti-clickjacking: só a própria origem pode enquadrar o app em iframe.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Não vaza a URL completa (com ids) pra sites de terceiros.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // camera/geolocation liberados só pra própria origem (assinatura de contrato
  // usa câmera/foto); microfone desligado; FLoC desligado.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), interest-cohort=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfjs-dist v6 usa `import.meta` (WASM/worker) que o minify do SWC recusa no
  // build de produção. Transpilar o pacote pelo Next resolve o import.meta antes.
  transpilePackages: ["pdfjs-dist"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Envolve com o Sentry. Source maps só sobem no build se SENTRY_AUTH_TOKEN
// existir. Sem NEXT_PUBLIC_SENTRY_DSN, o SDK fica DESLIGADO em runtime.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
});

