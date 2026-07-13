import { withSentryConfig } from "@sentry/nextjs";

// Content-Security-Policy em REPORT-ONLY. O browser só REPORTA violações no
// console (não bloqueia nada) — é o rollout seguro. Depois de navegar o app
// inteiro logado e confirmar zero violação legítima, troca-se o header por
// `Content-Security-Policy` (enforcing). Hosts de terceiros mapeados do código:
//   - Google Fonts: @import no globals.css (googleapis=CSS, gstatic=arquivos)
//   - flagcdn: bandeiras dos seletores de país/DDI (Flag.tsx)
//   - cartocdn/openstreetmap: tiles do mapa Leaflet (MapaRaio/MapaDobras)
//   - Supabase: REST + realtime (wss) + storage (logos/comprovantes)
//   - Sentry: ingest (só ativo com DSN setado)
//   - Stripe: defensivo (checkout hoje é redirect; Payment Element é futuro)
//   - Mercado Pago: SDK v2 (sdk.mercadopago.com) + Payment Brick (iframes dos
//     campos de cartão em *.mercadopago.com/*.mercadolibre.com) + API (POST do
//     device fingerprint / recursos do Brick pra api.mercadopago.com)
// 'unsafe-inline'/'unsafe-eval'/'wasm-unsafe-eval' seguem liberados (hidratação
// do Next + wasm do pdfjs); endurecer com nonce fica de follow-up.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://js.stripe.com https://sdk.mercadopago.com https://http2.mlstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co https://flagcdn.com https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://*.mlstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.ingest.sentry.io https://*.sentry.io https://api.mercadopago.com https://api.mercadolibre.com https://sdk.mercadopago.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://*.mercadopago.com https://*.mercadolibre.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

// Cabeçalhos de segurança aplicados a TODAS as respostas.
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
  // CSP em Report-Only (ver comentário acima): observa, não bloqueia.
  { key: "Content-Security-Policy-Report-Only", value: csp },
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

