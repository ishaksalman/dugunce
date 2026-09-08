/**
 * Veritabanı satır tipleri.
 *
 * Supabase CLI ile üretilen `database.types.ts` yerine elle yazılıyor; proje
 * henüz bir Supabase projesine bağlı değil. Bağlandığında `supabase gen types`
 * çıktısıyla değiştirilecek — bu dosyadaki isimler o çıktıyla birebir aynı
 * olacak şekilde seçildi.
 */

export type VenueStatus =
  | "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "SUSPENDED";

export type PriceType = "kisi_basi" | "paket" | "gunluk" | "belirtilmemis";

export type FeatureKind = "ozellik" | "hizmet";

export interface City {
  id: string;
  name: string;
  slug: string;
  plate_code: number;
  is_popular: boolean;
  venue_count: number;
}

export interface District {
  id: string;
  city_id: string;
  name: string;
  slug: string;
  venue_count: number;
}

export interface EventType {
  id: string;
  name: string;
  slug: string;
  seo_noun: string;
  icon: string | null;
  sort_order: number;
}

export interface VenueType {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

export interface Feature {
  id: string;
  kind: FeatureKind;
  group_name: string;
  name: string;
  slug: string;
  icon: string | null;
  is_filter: boolean;
  sort_order: number;
}

/** `search_venues()` RPC'sinin döndürdüğü satır. */
export interface VenueSearchRow {
  id: string;
  slug: string;
  name: string;
  city_name: string;
  city_slug: string;
  district_name: string;
  district_slug: string;
  venue_type_name: string | null;
  min_capacity: number | null;
  max_capacity: number | null;
  starting_price: string | number | null;
  price_type: PriceType;
  rating_avg: string | number;
  rating_count: number;
  is_featured: boolean;
  cover_url: string | null;
  cover_blur: string | null;
  feature_slugs: string[];
  total_count: string | number;
}

/** Kartta gösterilen, sayısalları normalize edilmiş hâli. */
export interface VenueCardData {
  id: string;
  slug: string;
  name: string;
  cityName: string;
  citySlug: string;
  districtName: string;
  districtSlug: string;
  venueTypeName: string | null;
  minCapacity: number | null;
  maxCapacity: number | null;
  startingPrice: number | null;
  priceType: PriceType;
  ratingAvg: number;
  ratingCount: number;
  isFeatured: boolean;
  coverUrl: string | null;
  coverBlur: string | null;
  featureSlugs: string[];
}

export function toVenueCard(row: VenueSearchRow): VenueCardData {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    cityName: row.city_name,
    citySlug: row.city_slug,
    districtName: row.district_name,
    districtSlug: row.district_slug,
    venueTypeName: row.venue_type_name,
    minCapacity: row.min_capacity,
    maxCapacity: row.max_capacity,
    startingPrice: row.starting_price === null ? null : Number(row.starting_price),
    priceType: row.price_type,
    ratingAvg: Number(row.rating_avg ?? 0),
    ratingCount: row.rating_count ?? 0,
    isFeatured: row.is_featured,
    coverUrl: row.cover_url,
    coverBlur: row.cover_blur,
    featureSlugs: row.feature_slugs ?? [],
  };
}
