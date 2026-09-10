import { SITE } from "@/lib/constants";
import type { SeoPage, VenueCardData } from "@/types/db";

const abs = (path: string) => new URL(path, SITE.url).toString();

/**
 * Landing sayfasındaki mekan listesi.
 *
 * `ItemList` yalnızca sıralı bağlantı listesi bildiriyor; buraya puan veya
 * fiyat işaretlemesi KOYMUYORUZ — o bilgi mekanın kendi sayfasındaki
 * `EventVenue` işaretlemesinde, tek yerde durmalı.
 */
export function itemListJsonLd(
  page: SeoPage,
  venues: VenueCardData[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: page.h1,
    numberOfItems: venues.length,
    itemListElement: venues.map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: v.name,
      url: abs(`/mekanlar/${v.citySlug}/${v.districtSlug}/${v.slug}`),
    })),
  };
}

export function faqJsonLd(page: SeoPage): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map((f) => ({
      "@type": "Question",
      name: f.soru,
      acceptedAnswer: { "@type": "Answer", text: f.cevap },
    })),
  };
}
