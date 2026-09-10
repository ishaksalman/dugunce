import { listVenueSitemap } from "@/lib/services/seo";
import { sitemapXml, XML_BASLIK } from "@/lib/seo/sitemap";

export const revalidate = 3600;

export async function GET() {
  const venues = await listVenueSitemap();
  return new Response(
    sitemapXml(
      venues.map((v) => ({
        path: v.path,
        lastModified: v.updated_at,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ),
    { headers: XML_BASLIK },
  );
}
