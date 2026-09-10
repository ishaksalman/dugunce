import "server-only";
import { SITE } from "@/lib/constants";

export interface SitemapEntry {
  path: string;
  lastModified?: string;
  changeFrequency?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
}

const kacir = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const abs = (path: string) =>
  kacir(new URL(path, SITE.url).toString());

export function sitemapXml(entries: SitemapEntry[]): string {
  const satirlar = entries.map((e) => {
    const parcalar = [`    <loc>${abs(e.path)}</loc>`];
    if (e.lastModified) parcalar.push(`    <lastmod>${e.lastModified.slice(0, 10)}</lastmod>`);
    if (e.changeFrequency) parcalar.push(`    <changefreq>${e.changeFrequency}</changefreq>`);
    if (e.priority !== undefined) parcalar.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
    return `  <url>\n${parcalar.join("\n")}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${satirlar.join("\n")}
</urlset>`;
}

export function sitemapIndexXml(
  sitemaps: { path: string; lastModified?: string }[],
): string {
  const satirlar = sitemaps.map((s) => {
    const parcalar = [`    <loc>${abs(s.path)}</loc>`];
    if (s.lastModified) parcalar.push(`    <lastmod>${s.lastModified.slice(0, 10)}</lastmod>`);
    return `  <sitemap>\n${parcalar.join("\n")}\n  </sitemap>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${satirlar.join("\n")}
</sitemapindex>`;
}

export const XML_BASLIK = {
  "content-type": "application/xml; charset=utf-8",
  // Sitemap saatlik tazeleniyor; arama motorları sık çekiyor.
  "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
};
