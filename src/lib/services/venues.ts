import "server-only";
import { cache } from "react";
import { getDataSource } from "@/lib/db";
import { PAGE_SIZE, type VenueFilters } from "@/lib/schemas/filters";
import type { SearchResult } from "@/lib/db/source";

export async function searchVenues(filters: VenueFilters): Promise<SearchResult> {
  const db = await getDataSource();
  return db.searchVenues({
    citySlug: filters.sehir,
    districtSlug: filters.ilce,
    eventTypeSlug: filters.etkinlik,
    venueTypeSlug: filters.tur,
    guestCount: filters.kisi,
    minCapacity: filters.minKapasite,
    maxCapacity: filters.maxKapasite,
    minPrice: filters.minFiyat,
    maxPrice: filters.maxFiyat,
    hasIndoor: filters.kapali,
    hasOutdoor: filters.acik,
    featureSlugs: filters.ozellikler,
    query: filters.q,
    sort: filters.siralama,
    limit: PAGE_SIZE,
    offset: (filters.sayfa - 1) * PAGE_SIZE,
  });
}

/** Ana sayfadaki öne çıkan mekanlar şeridi. */
export async function getFeaturedVenues(limit = 6) {
  const db = await getDataSource();
  const { items } = await db.searchVenues({ sort: "onerilen", limit });
  return items;
}

/** Detay sayfası. Yayında olmayan mekan için null döner (→ 404). */
export const getVenueDetail = cache(async (slug: string) => {
  const db = await getDataSource();
  return db.getVenueDetail(slug);
});

export const getVenueReviews = cache(
  async (venueId: string, limit = 10, offset = 0) => {
    const db = await getDataSource();
    return db.getVenueReviews(venueId, limit, offset);
  },
);

/** Görüntülenme kaydı. Sayfayı bloklamamalı; hatası yutulur. */
export async function recordVenueView(venueId: string): Promise<void> {
  try {
    const db = await getDataSource();
    await db.recordVenueView(venueId);
  } catch (error) {
    console.error("[recordVenueView]", error);
  }
}

/** Detay sayfasının altındaki "benzer mekanlar" şeridi. */
export async function getSimilarVenues(
  venue: { id: string; citySlug: string; eventTypeSlugs?: string[] },
  limit = 3,
) {
  const db = await getDataSource();
  const { items } = await db.searchVenues({
    citySlug: venue.citySlug,
    eventTypeSlug: venue.eventTypeSlugs?.[0],
    sort: "onerilen",
    limit: limit + 1,
  });
  // Mekanın kendisi listede çıkabilir; ayıklayıp istenen sayıya indiriyoruz.
  return items.filter((v) => v.id !== venue.id).slice(0, limit);
}
