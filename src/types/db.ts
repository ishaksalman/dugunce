/**
 * Veritabanı satır tipleri.
 *
 * Supabase CLI ile üretilen `database.types.ts` yerine elle yazılıyor; proje
 * henüz bir Supabase projesine bağlı değil. Bağlandığında `supabase gen types`
 * çıktısıyla değiştirilecek — bu dosyadaki isimler o çıktıyla birebir aynı
 * olacak şekilde seçildi.
 */

export type UserRole = "customer" | "venue_owner" | "admin";

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

// --- Detay sayfası -----------------------------------------------------------
// `get_venue_detail()` RPC'sinin döndürdüğü jsonb'nin karşılığı.

export interface VenueDetailImage {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  blur: string | null;
}

export interface VenueDetailFeature {
  kind: FeatureKind;
  group: string;
  name: string;
  slug: string;
  icon: string | null;
  note: string | null;
}

export interface VenueDetailEventType {
  name: string;
  slug: string;
  seo_noun: string;
}

export interface VenueDetail {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  short_description: string | null;
  description: string | null;
  min_capacity: number | null;
  max_capacity: number | null;
  starting_price: string | number | null;
  price_type: PriceType;
  price_note: string | null;
  has_indoor: boolean;
  has_outdoor: boolean;
  contact_phone: string | null;
  contact_email: string | null;
  website_url: string | null;
  instagram_url: string | null;
  rating_avg: string | number;
  rating_count: number;
  favorite_count: number;
  is_featured: boolean;
  published_at: string | null;
  updated_at: string | null;
  city: { name: string; slug: string };
  district: { name: string; slug: string };
  venue_type: { name: string; slug: string } | null;
  images: VenueDetailImage[];
  features: VenueDetailFeature[];
  event_types: VenueDetailEventType[];
}

/**
 * Sürücüler zaman damgalarını farklı döndürüyor: PostgREST (Supabase) ISO
 * string, PGlite ise JS `Date`. Tip "string" derken runtime'da Date gelmesi
 * `<time dateTime={...}>` içinde yerelleştirilmiş metin üretiyor ve hydration
 * uyuşmazlığına yol açıyor. Sınırda tek biçime indiriyoruz.
 */
export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date(String(value)).toISOString();
}

export function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return toIso(value);
}

export function normalizeReview(row: VenueReview): VenueReview {
  return {
    ...row,
    created_at: toIso(row.created_at),
    event_date: row.event_date === null ? null : String(row.event_date).slice(0, 10),
  };
}

export function normalizeVenueDetail(row: VenueDetail): VenueDetail {
  return {
    ...row,
    published_at: toIsoOrNull(row.published_at),
    updated_at: toIsoOrNull(row.updated_at),
  };
}

export interface VenueReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  event_date: string | null;
  author_name: string;
  created_at: string;
  total_count: string | number;
}

// --- Mekan sahibi paneli -----------------------------------------------------

/** `get_my_venues()` satırı. */
export interface OwnerVenue {
  id: string;
  slug: string;
  name: string;
  status: VenueStatus;
  needs_review: boolean;
  completion_score: number;
  city_name: string;
  city_slug: string;
  district_name: string;
  district_slug: string;
  cover_url: string | null;
  view_count: number;
  inquiry_count: number;
  new_inquiries: string | number;
  rejection_reason: string | null;
  updated_at: string;
}

/** `get_owner_stats()` çıktısı. */
export interface OwnerStats {
  view_count: number;
  favorite_count: number;
  inquiry_count: number;
  rating_avg: string | number;
  rating_count: number;
  completion_score: number;
  status: VenueStatus;
  needs_review: boolean;
  conversion_rate: string | number;
  new_inquiries: string | number;
  pending_reviews: string | number;
  image_count: string | number;
  daily_views: { day: string; count: number }[];
}

export function normalizeOwnerVenue(row: OwnerVenue): OwnerVenue {
  return { ...row, updated_at: toIso(row.updated_at) };
}
