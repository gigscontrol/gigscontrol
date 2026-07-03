import type { MetadataRoute } from "next";

const SITE_URL = "https://gigscontrol.vercel.app";

/**
 * robots.txt — libera as páginas públicas (marketing) e bloqueia as áreas
 * autenticadas e a API, que não devem ser indexadas.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/app/", "/onboarding", "/assinar/", "/admin"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
