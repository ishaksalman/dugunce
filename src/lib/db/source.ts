import type {
  City, District, EventType, Feature, VenueCardData, VenueDetail,
  VenueReview, VenueType,
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
 * İki uygulaması var: `supabase.ts` (üretim) ve `pglite.ts` (yalnızca
 * geliştirme, Supabase kimlik bilgileri yokken). Servis katmanı hangisinin
 * çalıştığını bilmez.
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

export function inquiryRpcArgs(input: CreateInquiryInput): Record<string, unknown> {
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
export function toRpcArgs(input: SearchInput): Record<string, unknown> {
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
