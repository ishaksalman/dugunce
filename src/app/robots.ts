import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/panel/",
          "/yonetim/",
          "/giris",
          "/kayit",
          "/sifre-sifirla",
          "/sifre-yenile",
          "/favorilerim",
          // Filtreli liste sayfaları sonsuz permütasyon üretiyor; indekslenen
          // yüzey SEO landing sayfaları. Sayfanın kendisi `noindex` de veriyor,
          // burası tarama bütçesini korumak için.
          "/mekanlar?",
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
