import { sitemapIndexXml, XML_BASLIK } from "@/lib/seo/sitemap";

/**
 * Sitemap indeksi.
 *
 * Next'in `generateSitemaps` yardımcısı parçaları üretiyor ama indeks
 * üretmiyor; robots.txt tek bir adrese işaret etmeli, o yüzden elle yazıldı.
 * Parçalara bölmenin sebebi: tek dosyada 50.000 URL sınırı var ve mekan
 * sayısı büyüdükçe her değişiklikte tüm dosya yeniden çekilir.
 */
export const revalidate = 3600;

export function GET() {
  const bugun = new Date().toISOString();
  return new Response(
    sitemapIndexXml([
      { path: "/sitemap-statik.xml", lastModified: bugun },
      { path: "/sitemap-landing.xml", lastModified: bugun },
      { path: "/sitemap-mekanlar.xml", lastModified: bugun },
    ]),
    { headers: XML_BASLIK },
  );
}
