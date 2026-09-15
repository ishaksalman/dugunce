import "server-only";
import { cache } from "react";
import { getDataSource } from "@/lib/db";
import type { SeoPage } from "@/types/db";
import type { VenueFilters } from "@/lib/schemas/filters";
import { landingHref, landingPath } from "@/lib/seo/paths";

export const getSeoPage = cache(async (path: string) => {
  const db = await getDataSource();
  return db.getSeoPage(path);
});

export const listActiveSeoPages = cache(async () => {
  const db = await getDataSource();
  return db.listActiveSeoPages();
});

export const listVenueSitemap = cache(async () => {
  const db = await getDataSource();
  return db.listVenueSitemap();
});

/**
 * Landing sayfasının filtreleri. Sayfa tipi hangi taksonomiye bağlıysa
 * o filtre uygulanıyor; kullanıcı sayfada ek filtre yaparsa `/mekanlar`a
 * gider (orası noindex).
 */
export function seoPageFilters(page: SeoPage, sayfa = 1): VenueFilters {
  return {
    sehir: page.city_slug ?? undefined,
    ilce: page.district_slug ?? undefined,
    etkinlik: page.event_slug ?? undefined,
    siralama: "onerilen",
    sayfa,
  } as VenueFilters;
}

/** Sayfanın kırıntı yolu. */
export function seoBreadcrumbs(page: SeoPage) {
  const items = [{ name: "Ana sayfa", path: "/" }];

  if (page.city_slug && page.city_name) {
    items.push({
      name: page.city_name,
      path: landingHref(landingPath({ citySlug: page.city_slug })),
    });
  }
  if (page.district_name && page.city_slug && page.event_slug) {
    // İlçe sayfasında ara adım olarak şehir × etkinlik sayfası daha yararlı:
    // kullanıcı ilçeden şehre genişlemek istiyor.
    items.push({
      name: `${page.city_name} ${page.event_name}`,
      path: landingHref(
        landingPath({ citySlug: page.city_slug, eventSlug: page.event_slug }),
      ),
    });
  }
  items.push({ name: page.h1, path: landingHref(page.path) });
  return items;
}
