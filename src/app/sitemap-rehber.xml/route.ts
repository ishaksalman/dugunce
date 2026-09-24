import { listBlogPosts } from "@/lib/services/blog";
import { sitemapXml, XML_BASLIK } from "@/lib/seo/sitemap";

export const revalidate = 3600;

export async function GET() {
  const { items } = await listBlogPosts(500);
  return new Response(
    sitemapXml(
      items.map((p) => ({
        path: `/rehber/${p.slug}`,
        lastModified: p.published_at ?? undefined,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
    ),
    { headers: XML_BASLIK },
  );
}
