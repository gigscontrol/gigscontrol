import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://gigscontrol.com";

/**
 * robots.txt — libera as páginas públicas (marketing) e bloqueia as áreas
 * autenticadas e a API, que não devem ser indexadas.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/app/",
        "/onboarding",
        "/assinar/",
        "/admin",
        "/dev/",
        "/pagamento",
        "/forgot-password",
        "/reset-password",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
