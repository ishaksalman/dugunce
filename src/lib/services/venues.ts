import "server-only";
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
