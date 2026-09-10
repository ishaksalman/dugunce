import { listActiveSeoPages } from "@/lib/services/seo";
import { sitemapXml, XML_BASLIK } from "@/lib/seo/sitemap";

/**
 * Yalnızca AKTİF landing sayfaları. Eşiği geçmeyenler hem `noindex` alıyor
 * hem buraya girmiyor — Google'a "bu sayfayı tara" demenin anlamı yok.
 */
export const revalidate = 3600;

export async function GET() {
  const pages = await listActiveSeoPages();
  return new Response(
    sitemapXml(
      pages.map((p) => ({
        path: `/${p.path}`,
        lastModified: p.updated_at,
        changeFrequency: "weekly" as const,
        priority:
          p.kind === "etkinlik" ? 0.9
          : p.kind === "sehir" ? 0.8
          : p.kind === "sehir_etkinlik" ? 0.7
          : 0.5,
      })),
    ),
    { headers: XML_BASLIK },
  );
}
