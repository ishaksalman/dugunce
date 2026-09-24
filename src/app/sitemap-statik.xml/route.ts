import { sitemapXml, XML_BASLIK, type SitemapEntry } from "@/lib/seo/sitemap";

export const revalidate = 86400;

const STATIK: SitemapEntry[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/mekanlar", changeFrequency: "daily", priority: 0.8 },
  { path: "/rehber", changeFrequency: "weekly", priority: 0.5 },
  { path: "/hakkimizda", changeFrequency: "monthly", priority: 0.3 },
  { path: "/iletisim", changeFrequency: "monthly", priority: 0.3 },
  { path: "/gizlilik", changeFrequency: "yearly", priority: 0.2 },
  { path: "/kullanim-kosullari", changeFrequency: "yearly", priority: 0.2 },
];

export function GET() {
  const bugun = new Date().toISOString();
  return new Response(
    sitemapXml(STATIK.map((s) => ({ ...s, lastModified: bugun }))),
    { headers: XML_BASLIK },
  );
}
