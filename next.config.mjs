import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfjs-dist v6 usa `import.meta` (WASM/worker) que o minify do SWC recusa no
  // build de produção. Transpilar o pacote pelo Next resolve o import.meta antes.
  transpilePackages: ["pdfjs-dist"],
};

// Envolve com o Sentry. Source maps só sobem no build se SENTRY_AUTH_TOKEN
// existir. Sem NEXT_PUBLIC_SENTRY_DSN, o SDK fica DESLIGADO em runtime.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
});

