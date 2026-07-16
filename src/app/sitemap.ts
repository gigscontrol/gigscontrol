import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://gigscontrol.com";

/**
 * Sitemap das páginas PÚBLICAS (marketing/legal). As telas autenticadas e o
 * fluxo de assinatura por token ficam de fora de propósito.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const agora = new Date();
  const paginas = [
    { url: "", priority: 1, changeFrequency: "weekly" as const },
    { url: "recursos", priority: 0.9, changeFrequency: "weekly" as const },
    { url: "planos", priority: 0.9, changeFrequency: "weekly" as const },
    { url: "signup", priority: 0.7, changeFrequency: "monthly" as const },
    { url: "login", priority: 0.5, changeFrequency: "monthly" as const },
    { url: "termos", priority: 0.3, changeFrequency: "yearly" as const },
    { url: "privacidade", priority: 0.3, changeFrequency: "yearly" as const },
  ];
  return paginas.map((p) => ({
    url: `${SITE_URL}/${p.url}`,
    lastModified: agora,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
