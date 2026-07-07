// Sentry no NAVEGADOR. Só liga se NEXT_PUBLIC_SENTRY_DSN estiver setado —
// sem DSN, fica desligado e não afeta nada.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  // 10% das transações de performance (ajuste conforme o volume crescer).
  tracesSampleRate: 0.1,
  // Session Replay desligado por padrão (peso + PII/LGPD). Ligue depois se quiser.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
