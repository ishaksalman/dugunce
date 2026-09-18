import type {
  AdminClaim, AdminDistrict, AdminReview, AdminSeoPage, AdminStats, AdminTaxonomy, AdminUser, AdminVenue, BusinessCategory, City, ClaimStatus, DavetProStatus, District, EventType, Feature, ImportItem, ImportStatus, InquiryStatus, OwnerInquiry, OwnerStats, OwnerVenue, ReviewStatus, SeoPage, SeoSitemapEntry, SimilarVenue, UserRole, VenueCardData, VenueDetail, VenueForEdit, VenueReview, VenueStatus, VenueType,
} from "@/types/db";

export interface SearchInput {
  citySlug?: string;
  districtSlug?: string;
  eventTypeSlug?: string;
  venueTypeSlug?: string;
  guestCount?: number;
  minCapacity?: number;
  maxCapacity?: number;
  minPrice?: number;
  maxPrice?: number;
  hasIndoor?: boolean;
  hasOutdoor?: boolean;
  featureSlugs?: string[];
  query?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  items: VenueCardData[];
  total: number;
}

/**
 * Uygulamanın veritabanıyla tek temas noktası.
 *
 * Servis katmanı (`lib/services/*`) yalnızca bu arayüzü görür; Supabase
 * istemcisini doğrudan çağırmaz. Yeni bir sorgu eklerken önce buraya
 * imzasını yaz, sonra `supabase.ts` içinde uygula.
 */
export interface DataSource {
  searchVenues(input: SearchInput): Promise<SearchResult>;
  listCities(opts?: { popularOnly?: boolean }): Promise<City[]>;
  listDistricts(citySlug: string): Promise<District[]>;
  listEventTypes(): Promise<EventType[]>;
  listVenueTypes(): Promise<VenueType[]>;
  listFeatures(): Promise<Feature[]>;
  /** Yayında olmayan mekan için null döner. */
  getVenueDetail(slug: string): Promise<VenueDetail | null>;
  getVenueReviews(
    venueId: string,
    limit?: number,
    offset?: number,
  ): Promise<{ items: VenueReview[]; total: number }>;
  /** Görüntülenme sayacı. Hata durumunda sayfayı düşürmez. */
  recordVenueView(venueId: string): Promise<void>;
  createInquiry(input: CreateInquiryInput): Promise<CreateInquiryResult>;

  // --- Mekan sahibi paneli --------------------------------------------------
  /** Oturumdaki kullanıcının mekanları. RLS + fonksiyon sahibi filtreliyor. */
  getMyVenues(): Promise<OwnerVenue[]>;
  /** Sahibi olmadığı mekan için null döner. */
  getOwnerStats(venueId: string): Promise<OwnerStats | null>;
  getOwnerInquiries(input: OwnerInquiryQuery): Promise<OwnerInquiryResult>;
  updateInquiry(
    id: string,
    patch: { status?: InquiryStatus; ownerNote?: string | null },
  ): Promise<void>;

  // --- Mekan düzenleme ------------------------------------------------------
  /** Sahibi olmadığı mekan için null döner. Taslakları da kapsar. */
  getVenueForEdit(venueId: string): Promise<VenueForEdit | null>;
  /** DavetPro bağlantısı ve aktarım durumu. Sahibi değilse null. */
  getDavetProStatus(venueId: string): Promise<DavetProStatus | null>;

  /** Favoriler için: verilen id'lerin kart verisi, gelen sırayla. */
  getVenuesByIds(ids: string[]): Promise<VenueCardData[]>;

  // --- SEO ------------------------------------------------------------------
  /** Yol bulunamazsa null. Pasif sayfa da döner (200 + noindex için). */
  getSeoPage(path: string): Promise<SeoPage | null>;
  /** Sitemap için yalnızca aktif sayfalar. */
  listActiveSeoPages(): Promise<SeoSitemapEntry[]>;
  /** Sitemap için yayındaki mekanların tam yolları. */
  listVenueSitemap(): Promise<{ path: string; updated_at: string }[]>;

  // --- Yönetim --------------------------------------------------------------
  // Hepsi veritabanında `assert_admin()` ile korunuyor; yetkisiz çağrı hata
  // fırlatır, sessizce boş sonuç dönmez.
  adminStats(): Promise<AdminStats>;
  adminListVenues(input: AdminVenueQuery): Promise<AdminVenueResult>;
  adminSetVenueStatus(venueId: string, status: VenueStatus, reason?: string): Promise<void>;
  adminSetVenueFeatured(venueId: string, featured: boolean, until?: string): Promise<void>;
  adminListUsers(input: AdminUserQuery): Promise<AdminUserResult>;
  adminSetUserRole(userId: string, role: UserRole): Promise<void>;
  adminSetUserActive(userId: string, active: boolean, reason?: string): Promise<void>;
  adminListReviews(input: AdminReviewQuery): Promise<AdminReviewResult>;
  adminModerateReview(reviewId: string, status: ReviewStatus, note?: string): Promise<void>;
  adminListSeoPages(input: AdminSeoQuery): Promise<AdminSeoResult>;
  adminUpdateSeoPage(id: string, patch: AdminSeoPatch): Promise<void>;
  adminRefreshSeoPages(minVenues: number): Promise<Record<string, unknown>>;

  adminListTaxonomy(): Promise<AdminTaxonomy>;
  adminListDistricts(cityId: string): Promise<AdminDistrict[]>;
  adminUpsertEventType(input: AdminEventTypeInput): Promise<void>;
  adminUpsertVenueType(input: AdminVenueTypeInput): Promise<void>;
  adminUpsertFeature(input: AdminFeatureInput): Promise<void>;
  adminSetCityPopular(cityId: string, popular: boolean): Promise<void>;
  adminUpsertDistrict(input: AdminDistrictInput): Promise<void>;

  listBusinessCategories(): Promise<BusinessCategory[]>;
  adminCreateVenue(input: AdminVenueCreateInput): Promise<{ id: string; slug: string }>;
  adminFindSimilarVenues(
    name: string,
    cityId: string | null,
    phone: string | null,
    placeId?: string | null,
  ): Promise<SimilarVenue[]>;
  /** Toplu girişte koordinat ve Maps bağlantısını yazar (admin). */
  adminSetVenueLocation(venueId: string, input: AdminVenueLocationInput): Promise<void>;
  adminDeleteVenue(venueId: string): Promise<{ name: string }>;

  adminStartImportRun(source: string, note?: string): Promise<string>;
  adminFinishImportRun(runId: string): Promise<void>;
  adminLogImportItem(input: ImportItemInput): Promise<void>;
  adminImportProcessed(sourceUrls: string[]): Promise<Map<string, boolean>>;
  adminListImportItems(
    runId: string | null,
    status: ImportStatus | null,
    offset: number,
  ): Promise<{ items: ImportItem[]; total: number }>;
  adminListClaims(status: ClaimStatus | null, offset: number): Promise<AdminClaimResult>;
  adminReviewClaim(claimId: string, approve: boolean, note?: string): Promise<void>;
  claimVenue(venueId: string, note?: string, phone?: string): Promise<void>;
}

export interface AdminVenueCreateInput {
  name: string;
  /** Mükerrer uyarısını bilerek geçmek için. */
  force?: boolean;
  cityId: string;
  districtId: string;
  categoryId: string | null;
  venueTypeId: string | null;
  address: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  googlePlaceId?: string | null;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  googleRating?: number | null;
  googleRatingCount?: number | null;
  source?: string | null;
  sourceUrl?: string | null;
}
export interface ImportItemInput {
  runId: string;
  status: ImportStatus;
  sourceUrl?: string | null;
  name?: string | null;
  venueId?: string | null;
  imageTotal?: number;
  imageOk?: number;
  imageFailed?: number;
  error?: string | null;
}
export interface AdminVenueLocationInput {
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string | null;
}
export interface AdminClaimResult { items: AdminClaim[]; total: number }

export interface AdminEventTypeInput {
  id: string | null;
  name: string;
  seoNoun: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}
export interface AdminVenueTypeInput {
  id: string | null;
  name: string;
  sortOrder: number;
  isActive: boolean;
}
export interface AdminFeatureInput {
  id: string | null;
  kind: "ozellik" | "hizmet";
  groupName: string;
  name: string;
  icon: string | null;
  isFilter: boolean;
  sortOrder: number;
  isActive: boolean;
}
export interface AdminDistrictInput {
  id: string | null;
  cityId: string;
  name: string;
}

export interface AdminSeoQuery {
  kind?: string;
  active?: boolean;
  query?: string;
  limit?: number;
  offset?: number;
}
export interface AdminSeoResult { items: AdminSeoPage[]; total: number }
export interface AdminSeoPatch {
  title?: string;
  metaDescription?: string;
  h1?: string;
  introHtml?: string | null;
  minVenueCount?: number;
  isActive?: boolean;
}

export interface AdminVenueQuery {
  status?: VenueStatus;
  query?: string;
  needsReview?: boolean;
  limit?: number;
  offset?: number;
}
export interface AdminVenueResult { items: AdminVenue[]; total: number }

export interface AdminUserQuery {
  role?: UserRole;
  query?: string;
  limit?: number;
  offset?: number;
}
export interface AdminUserResult { items: AdminUser[]; total: number }

export interface AdminReviewQuery {
  status?: ReviewStatus;
  limit?: number;
  offset?: number;
}
export interface AdminReviewResult { items: AdminReview[]; total: number }

export interface OwnerInquiryQuery {
  status?: InquiryStatus;
  venueId?: string;
  query?: string;
  limit?: number;
  offset?: number;
}

export interface OwnerInquiryResult {
  items: OwnerInquiry[];
  total: number;
  newCount: number;
}

export interface CreateInquiryInput {
  venueId: string;
  fullName: string;
  phone: string;
  email?: string;
  eventTypeId?: string;
  eventDate?: string;
  guestCount?: number;
  message?: string;
  ipHash: string | null;
  uaHash: string | null;
}

/** `create_inquiry()` fonksiyonunun döndürdüğü sonuç. */
export type CreateInquiryResult =
  | { ok: true; id: string }
  | { ok: false; reason: "venue_not_found" | "rate_limited_hour" | "rate_limited_venue" };

export interface InquiryRpcArgs {
  p_venue_id: string;
  p_full_name: string;
  p_phone: string;
  p_email: string | null;
  p_event_type_id: string | null;
  p_event_date: string | null;
  p_guest_count: number | null;
  p_message: string | null;
  p_ip_hash: string | null;
  p_ua_hash: string | null;
}

export function inquiryRpcArgs(input: CreateInquiryInput): InquiryRpcArgs {
  return {
    p_venue_id: input.venueId,
    p_full_name: input.fullName,
    p_phone: input.phone,
    p_email: input.email ?? null,
    p_event_type_id: input.eventTypeId ?? null,
    p_event_date: input.eventDate ?? null,
    p_guest_count: input.guestCount ?? null,
    p_message: input.message ?? null,
    p_ip_hash: input.ipHash,
    p_ua_hash: input.uaHash,
  };
}

/** RPC parametreleri — iki adaptör de aynı isimleri kullanır. */
export interface SearchRpcArgs {
  p_city_slug: string | null;
  p_district_slug: string | null;
  p_event_type_slug: string | null;
  p_venue_type_slug: string | null;
  p_guest_count: number | null;
  p_min_capacity: number | null;
  p_max_capacity: number | null;
  p_min_price: number | null;
  p_max_price: number | null;
  p_has_indoor: boolean | null;
  p_has_outdoor: boolean | null;
  p_feature_slugs: string[] | null;
  p_query: string | null;
  p_sort: string;
  p_limit: number;
  p_offset: number;
}

export function toRpcArgs(input: SearchInput): SearchRpcArgs {
  return {
    p_city_slug: input.citySlug ?? null,
    p_district_slug: input.districtSlug ?? null,
    p_event_type_slug: input.eventTypeSlug ?? null,
    p_venue_type_slug: input.venueTypeSlug ?? null,
    p_guest_count: input.guestCount ?? null,
    p_min_capacity: input.minCapacity ?? null,
    p_max_capacity: input.maxCapacity ?? null,
    p_min_price: input.minPrice ?? null,
    p_max_price: input.maxPrice ?? null,
    p_has_indoor: input.hasIndoor ?? null,
    p_has_outdoor: input.hasOutdoor ?? null,
    p_feature_slugs: input.featureSlugs?.length ? input.featureSlugs : null,
    p_query: input.query ?? null,
    p_sort: input.sort ?? "onerilen",
    p_limit: input.limit ?? 24,
    p_offset: input.offset ?? 0,
  };
}
