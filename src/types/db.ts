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
  google_maps_url: string | null;
  /** false = sahiplenilmemiş katalog kaydı; vitrinde sahiplenme çağrısı çıkar. */
  is_claimed: boolean;
  /**
   * Yapılandırılmış veriden üretilen tanıtım metni (0030/0031).
   * `description` boşken gösteriliyor; sahibi kendi metnini yazınca susuyor.
   */
  auto_summary: string | null;
  /**
   * Google işletme puanı — SAYI, yorum metni değil (0033).
   * Bizim `rating_avg`'imizle karıştırılmaz ve JSON-LD aggregateRating'e
   * GİRMEZ. Kaynağı ve okunma tarihi her zaman birlikte gösterilir.
   */
  google_rating: string | number | null;
  google_rating_count: number | null;
  google_rating_at: string | null;
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

export type InquiryStatus =
  | "NEW" | "CONTACTED" | "QUOTED" | "ACCEPTED" | "REJECTED" | "CLOSED";

/** `get_owner_inquiries()` satırı. */
export interface OwnerInquiry {
  id: string;
  venue_id: string;
  venue_name: string;
  full_name: string;
  phone: string;
  email: string | null;
  event_type_name: string | null;
  event_date: string | null;
  guest_count: number | null;
  message: string | null;
  status: InquiryStatus;
  owner_note: string | null;
  contacted_at: string | null;
  created_at: string;
  total_count: string | number;
  new_count: string | number;
}

export function normalizeInquiry(row: OwnerInquiry): OwnerInquiry {
  return {
    ...row,
    created_at: toIso(row.created_at),
    contacted_at: toIsoOrNull(row.contacted_at),
    event_date: row.event_date === null ? null : String(row.event_date).slice(0, 10),
  };
}

// --- Mekan düzenleme (wizard) ------------------------------------------------

export interface VenueEditImage {
  id: string;
  url: string;
  storage_path: string;
  alt: string | null;
  is_cover: boolean;
  sort_order: number;
}

/** `get_venue_for_edit()` çıktısı. Vitrin görünümünden farkı: taslakları da
 *  kapsar ve seçili özellik/etkinlik ID'lerini verir. */
export interface VenueForEdit {
  id: string;
  slug: string;
  name: string;
  status: VenueStatus;
  needs_review: boolean;
  completion_score: number;
  rejection_reason: string | null;
  published_at: string | null;
  city_id: string;
  district_id: string;
  venue_type_id: string | null;
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
  google_maps_url: string | null;
  davetpro_business_id: string | null;
  davetpro_linked_at: string | null;
  city: { name: string; slug: string };
  district: { name: string; slug: string };
  images: VenueEditImage[];
  feature_ids: string[];
  event_type_ids: string[];
}

export function normalizeVenueForEdit(row: VenueForEdit): VenueForEdit {
  return {
    ...row,
    published_at: toIsoOrNull(row.published_at),
    davetpro_linked_at: toIsoOrNull(row.davetpro_linked_at),
  };
}

// --- Yönetim paneli ----------------------------------------------------------

export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AdminStats {
  pending_venues: number;
  needs_review: number;
  published: number;
  draft: number;
  rejected: number;
  suspended: number;
  pending_reviews: number;
  pending_claims: number;
  /** Sahipsiz katalog kaydı: kaç profil hâlâ sahibini bekliyor. */
  unclaimed: number;
  total_users: number;
  venue_owners: number;
  inquiries_7d: number;
  inquiries_total: number;
}

export interface AdminVenue {
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
  // Sahiplenilmemiş katalog kaydında NULL (0025).
  owner_name: string | null;
  owner_email: string | null;
  is_claimed: boolean;
  /**
   * Silme YALNIZCA geçmişi olmayan katalog kaydında (0035): sahipsiz, hiç
   * yayınlanmamış, teklif talebi ve yorumu yok. Kural veritabanında.
   */
  can_delete: boolean;
  cover_url: string | null;
  view_count: number;
  inquiry_count: number;
  is_featured: boolean;
  featured_until: string | null;
  rejection_reason: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  total_count: string | number;
}

export interface AdminUser {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  venue_count: string | number;
  created_at: string;
  total_count: string | number;
}

export interface AdminReview {
  id: string;
  venue_id: string;
  venue_name: string;
  venue_slug: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  admin_note: string | null;
  created_at: string;
  total_count: string | number;
}

export function normalizeAdminVenue(row: AdminVenue): AdminVenue {
  return {
    ...row,
    featured_until: toIsoOrNull(row.featured_until),
    published_at: toIsoOrNull(row.published_at),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

export function normalizeAdminUser(row: AdminUser): AdminUser {
  return { ...row, created_at: toIso(row.created_at) };
}

export function normalizeAdminReview(row: AdminReview): AdminReview {
  return { ...row, created_at: toIso(row.created_at) };
}

// --- SEO landing sayfaları ---------------------------------------------------

export type SeoPageKind = "etkinlik" | "sehir" | "sehir_etkinlik" | "ilce_etkinlik";

export interface SeoFaqItem {
  soru: string;
  cevap: string;
}

/** `get_seo_page()` çıktısı — taksonomi birleştirilmiş hâlde. */
export interface SeoPage {
  id: string;
  path: string;
  kind: SeoPageKind;
  title: string;
  meta_description: string | null;
  h1: string;
  intro_html: string | null;
  faq: SeoFaqItem[];
  is_active: boolean;
  min_venue_count: number;
  updated_at: string;
  city_slug: string | null;
  city_name: string | null;
  district_slug: string | null;
  district_name: string | null;
  event_slug: string | null;
  event_name: string | null;
  event_noun: string | null;
}

export interface SeoSitemapEntry {
  path: string;
  updated_at: string;
  kind: SeoPageKind;
  h1: string;
  city_slug: string | null;
  district_slug: string | null;
  event_slug: string | null;
}

export function normalizeSeoPage(row: SeoPage): SeoPage {
  return {
    ...row,
    updated_at: toIso(row.updated_at),
    faq: Array.isArray(row.faq) ? row.faq : [],
  };
}

export interface AdminSeoPage {
  id: string;
  path: string;
  kind: SeoPageKind;
  title: string;
  meta_description: string | null;
  h1: string;
  intro_html: string | null;
  is_active: boolean;
  min_venue_count: number;
  venue_count: string | number;
  updated_at: string;
  total_count: string | number;
}

export function normalizeAdminSeoPage(row: AdminSeoPage): AdminSeoPage {
  return { ...row, updated_at: toIso(row.updated_at) };
}

export interface DavetProStatus {
  linked: boolean;
  linked_at: string | null;
  toplam_talep: number;
  aktarilan: number;
  bekleyen: number;
  basarisiz: number;
  son_hata: string | null;
}

// --- Taksonomi yönetimi ------------------------------------------------------

export interface AdminEventType {
  id: string;
  name: string;
  slug: string;
  seo_noun: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  venue_count: number;
}

export interface AdminVenueType {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  venue_count: number;
}

export interface AdminFeature {
  id: string;
  kind: "ozellik" | "hizmet";
  group_name: string;
  name: string;
  slug: string;
  icon: string | null;
  is_filter: boolean;
  sort_order: number;
  is_active: boolean;
  venue_count: number;
}

export interface AdminCity {
  id: string;
  name: string;
  slug: string;
  plate_code: number;
  is_popular: boolean;
  venue_count: number;
  district_count: number;
}

export interface AdminDistrict {
  id: string;
  name: string;
  slug: string;
  venue_count: number;
}

export interface AdminTaxonomy {
  event_types: AdminEventType[];
  venue_types: AdminVenueType[];
  features: AdminFeature[];
  cities: AdminCity[];
}

// --- Katalog ve sahiplenme ---------------------------------------------------

export interface BusinessCategory {
  id: string;
  slug: string;
  name: string;
  plural_name: string;
  path_prefix: string;
  sort_order: number;
  /** false = planlanan kategori: vitrinde "yakında", mekan bağlanamaz. */
  is_active: boolean;
}

export type ClaimStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AdminClaim {
  id: string;
  venue_id: string;
  venue_name: string;
  venue_slug: string;
  city_name: string;
  district_name: string;
  claimant_name: string | null;
  claimant_email: string | null;
  claimant_phone: string | null;
  note: string | null;
  status: ClaimStatus;
  review_note: string | null;
  created_at: string;
  total_count: string | number;
}

export interface SimilarVenue {
  id: string;
  name: string;
  district_name: string;
  status: VenueStatus;
  is_claimed: boolean;
  /** Hangi sinyal eşleşti: "telefon" çok daha güçlü bir mükerrer işareti. */
  eslesme: "ad" | "telefon";
}
