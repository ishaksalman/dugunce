import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import {
  normalizeAdminReview, normalizeAdminSeoPage, normalizeAdminUser, normalizeAdminVenue,
  normalizeInquiry,
  normalizeOwnerVenue, normalizeReview, normalizeVenueDetail, normalizeVenueForEdit,
  toVenueCard, type AdminReview, type AdminSeoPage, type AdminStats, type AdminUser,
  toIso,
  type AdminClaim, type AdminDistrict, type AdminTaxonomy, type BusinessCategory,
  type AdminVenue, type DavetProStatus,
  type InquiryStatus, type OwnerInquiry, type OwnerStats, type OwnerVenue,
  normalizeSeoPage, type ReviewStatus, type SeoPage, type SeoSitemapEntry,
  type UserRole, type VenueDetail, type VenueForEdit,
  type VenueReview, type VenueSearchRow, type VenueStatus,
} from "@/types/db";
import type {
  AdminReviewQuery, AdminReviewResult, AdminSeoPatch, AdminSeoQuery, AdminSeoResult,
  AdminUserQuery, AdminUserResult,
  AdminVenueQuery, AdminVenueResult, CreateInquiryInput, CreateInquiryResult,
  DataSource, OwnerInquiryQuery, OwnerInquiryResult, SearchInput, SearchResult,
} from "./source";
import { inquiryRpcArgs, toRpcArgs } from "./source";

/** Sorgu hatası yutulmaz: boş liste göstermek "mekan yok" demek olur. */
function unwrap<T>(res: { data: T | null; error: { message: string } | null }, ctx: string): T {
  if (res.error) throw new Error(`${ctx}: ${res.error.message}`);
  return (res.data ?? []) as T;
}

export const supabaseSource: DataSource = {
  async searchVenues(input: SearchInput): Promise<SearchResult> {
    const supabase = createPublicClient();
    const rows = unwrap(
      await supabase.rpc("search_venues", toRpcArgs(input)),
      "search_venues",
    ) as VenueSearchRow[];
    return {
      items: rows.map(toVenueCard),
      total: rows.length ? Number(rows[0].total_count) : 0,
    };
  },

  async listCities({ popularOnly = false } = {}) {
    const supabase = createPublicClient();
    let q = supabase
      .from("cities")
      .select("id, name, slug, plate_code, is_popular, venue_count");
    if (popularOnly) q = q.eq("is_popular", true);
    return unwrap(await q.order("sort_order").order("name"), "cities");
  },

  async listDistricts(citySlug: string) {
    const supabase = createPublicClient();
    const city = await supabase.from("cities").select("id").eq("slug", citySlug).maybeSingle();
    if (city.error) throw new Error(`cities: ${city.error.message}`);
    if (!city.data) return [];
    return unwrap(
      await supabase
        .from("districts")
        .select("id, city_id, name, slug, venue_count")
        .eq("city_id", city.data.id)
        .order("name"),
      "districts",
    );
  },

  async listEventTypes() {
    const supabase = createPublicClient();
    return unwrap(
      await supabase
        .from("event_types")
        .select("id, name, slug, seo_noun, icon, sort_order")
        .eq("is_active", true)
        .order("sort_order"),
      "event_types",
    );
  },

  async listVenueTypes() {
    const supabase = createPublicClient();
    return unwrap(
      await supabase
        .from("venue_types")
        .select("id, name, slug, sort_order")
        .eq("is_active", true)
        .order("sort_order"),
      "venue_types",
    );
  },

  async getVenueDetail(slug: string): Promise<VenueDetail | null> {
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("get_venue_detail", { p_slug: slug });
    if (error) throw new Error(`get_venue_detail: ${error.message}`);
    return data ? normalizeVenueDetail(data as VenueDetail) : null;
  },

  async getVenueReviews(venueId: string, limit = 10, offset = 0) {
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("get_venue_reviews", {
      p_venue_id: venueId, p_limit: limit, p_offset: offset,
    });
    if (error) throw new Error(`get_venue_reviews: ${error.message}`);
    const items = ((data ?? []) as VenueReview[]).map(normalizeReview);
    return { items, total: items.length ? Number(items[0].total_count) : 0 };
  },

  async recordVenueView(venueId: string) {
    const supabase = createPublicClient();
    // Sayaç sayfanın çalışmasını engellememeli; hata yalnızca loglanır.
    const { error } = await supabase.rpc("record_venue_view", { p_venue_id: venueId });
    if (error) console.error("[record_venue_view]", error.message);
  },

  async createInquiry(input: CreateInquiryInput): Promise<CreateInquiryResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_inquiry", inquiryRpcArgs(input));
    if (error) throw new Error(`create_inquiry: ${error.message}`);
    return data as CreateInquiryResult;
  },

  // Panel sorguları oturuma bağlı: çerez farkındalıklı istemci ŞART,
  // `createPublicClient()` anonim bağlanır ve auth.uid() null olur.
  async getMyVenues(): Promise<OwnerVenue[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_my_venues");
    if (error) throw new Error(`get_my_venues: ${error.message}`);
    return ((data ?? []) as unknown as OwnerVenue[]).map(normalizeOwnerVenue);
  },

  async getOwnerStats(venueId: string): Promise<OwnerStats | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_owner_stats", { p_venue_id: venueId });
    if (error) throw new Error(`get_owner_stats: ${error.message}`);
    return (data as unknown as OwnerStats | null) ?? null;
  },

  async getOwnerInquiries(input: OwnerInquiryQuery): Promise<OwnerInquiryResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_owner_inquiries", {
      p_status: input.status ?? null,
      p_venue_id: input.venueId ?? null,
      p_query: input.query ?? null,
      p_limit: input.limit ?? 25,
      p_offset: input.offset ?? 0,
    });
    if (error) throw new Error(`get_owner_inquiries: ${error.message}`);
    const items = ((data ?? []) as unknown as OwnerInquiry[]).map(normalizeInquiry);
    return {
      items,
      total: items.length ? Number(items[0].total_count) : 0,
      newCount: items.length ? Number(items[0].new_count) : 0,
    };
  },

  async updateInquiry(
    id: string,
    patch: { status?: InquiryStatus; ownerNote?: string | null },
  ): Promise<void> {
    const supabase = await createClient();
    // Sahibin hangi alanlara dokunabileceğini guard_inquiry_update trigger'ı
    // belirliyor (0004); buradan fazlasını göndersek bile geri alınır.
    const { error } = await supabase
      .from("inquiries")
      .update({
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.ownerNote !== undefined ? { owner_note: patch.ownerNote } : {}),
      })
      .eq("id", id);
    if (error) throw new Error(`updateInquiry: ${error.message}`);
  },

  async getVenueForEdit(venueId: string): Promise<VenueForEdit | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_venue_for_edit", {
      p_venue_id: venueId,
    });
    if (error) throw new Error(`get_venue_for_edit: ${error.message}`);
    return data ? normalizeVenueForEdit(data as unknown as VenueForEdit) : null;
  },

  async getDavetProStatus(venueId: string): Promise<DavetProStatus | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_davetpro_status", {
      p_venue_id: venueId,
    });
    if (error) throw new Error(`get_davetpro_status: ${error.message}`);
    return (data as unknown as DavetProStatus | null) ?? null;
  },

  async getVenuesByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const supabase = createPublicClient();
    const rows = unwrap(
      await supabase.rpc("get_venues_by_ids", { p_ids: ids }),
      "get_venues_by_ids",
    ) as VenueSearchRow[];
    return rows.map(toVenueCard);
  },

  // --- Yönetim -------------------------------------------------------------
  // Çerez farkındalıklı istemci ŞART: assert_admin() auth.uid()'e bakıyor.
  async adminStats(): Promise<AdminStats> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_stats");
    if (error) throw new Error(`admin_stats: ${error.message}`);
    return data as unknown as AdminStats;
  },

  async adminListVenues(input: AdminVenueQuery): Promise<AdminVenueResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_list_venues", {
      p_status: input.status ?? null,
      p_query: input.query ?? null,
      p_needs_review: input.needsReview ?? null,
      p_limit: input.limit ?? 25,
      p_offset: input.offset ?? 0,
    });
    if (error) throw new Error(`admin_list_venues: ${error.message}`);
    const items = ((data ?? []) as unknown as AdminVenue[]).map(normalizeAdminVenue);
    return { items, total: items.length ? Number(items[0].total_count) : 0 };
  },

  async adminSetVenueStatus(venueId: string, status: VenueStatus, reason?: string) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_venue_status", {
      p_venue_id: venueId, p_status: status, p_reason: reason ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async adminSetVenueFeatured(venueId: string, featured: boolean, until?: string) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_venue_featured", {
      p_venue_id: venueId, p_featured: featured, p_until: until ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async adminListUsers(input: AdminUserQuery): Promise<AdminUserResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_list_users", {
      p_role: input.role ?? null,
      p_query: input.query ?? null,
      p_limit: input.limit ?? 25,
      p_offset: input.offset ?? 0,
    });
    if (error) throw new Error(`admin_list_users: ${error.message}`);
    const items = ((data ?? []) as unknown as AdminUser[]).map(normalizeAdminUser);
    return { items, total: items.length ? Number(items[0].total_count) : 0 };
  },

  async adminSetUserRole(userId: string, role: UserRole) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_user_role", {
      p_user_id: userId, p_role: role,
    });
    if (error) throw new Error(error.message);
  },

  async adminSetUserActive(userId: string, active: boolean, reason?: string) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_user_active", {
      p_user_id: userId, p_active: active, p_reason: reason ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async adminListReviews(input: AdminReviewQuery): Promise<AdminReviewResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_list_reviews", {
      p_status: input.status ?? null,
      p_limit: input.limit ?? 25,
      p_offset: input.offset ?? 0,
    });
    if (error) throw new Error(`admin_list_reviews: ${error.message}`);
    const items = ((data ?? []) as unknown as AdminReview[]).map(normalizeAdminReview);
    return { items, total: items.length ? Number(items[0].total_count) : 0 };
  },

  async adminModerateReview(reviewId: string, status: ReviewStatus, note?: string) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_moderate_review", {
      p_review_id: reviewId, p_status: status, p_note: note ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async adminListSeoPages(input: AdminSeoQuery): Promise<AdminSeoResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_list_seo_pages", {
      p_kind: input.kind ?? null,
      p_active: input.active ?? null,
      p_query: input.query ?? null,
      p_limit: input.limit ?? 50,
      p_offset: input.offset ?? 0,
    });
    if (error) throw new Error(`admin_list_seo_pages: ${error.message}`);
    const items = ((data ?? []) as unknown as AdminSeoPage[]).map(normalizeAdminSeoPage);
    return { items, total: items.length ? Number(items[0].total_count) : 0 };
  },

  async adminUpdateSeoPage(id: string, patch: AdminSeoPatch) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_update_seo_page", {
      p_id: id,
      p_title: patch.title ?? null,
      p_meta_description: patch.metaDescription ?? null,
      p_h1: patch.h1 ?? null,
      p_intro_html: patch.introHtml ?? null,
      p_min_venue_count: patch.minVenueCount ?? null,
      p_is_active: patch.isActive ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async adminRefreshSeoPages(minVenues: number) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_refresh_seo_pages", {
      p_min_venues: minVenues,
    });
    if (error) throw new Error(error.message);
    return data as Record<string, unknown>;
  },

  // --- Taksonomi ------------------------------------------------------------

  async adminListTaxonomy() {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_list_taxonomy");
    if (error) throw new Error(error.message);
    return data as unknown as AdminTaxonomy;
  },

  async adminListDistricts(cityId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_list_districts", {
      p_city_id: cityId,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as AdminDistrict[];
  },

  async adminUpsertEventType(input) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_upsert_event_type", {
      p_id: input.id,
      p_name: input.name,
      p_seo_noun: input.seoNoun,
      p_icon: input.icon,
      p_sort_order: input.sortOrder,
      p_is_active: input.isActive,
    });
    if (error) throw new Error(error.message);
  },

  async adminUpsertVenueType(input) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_upsert_venue_type", {
      p_id: input.id,
      p_name: input.name,
      p_sort_order: input.sortOrder,
      p_is_active: input.isActive,
    });
    if (error) throw new Error(error.message);
  },

  async adminUpsertFeature(input) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_upsert_feature", {
      p_id: input.id,
      p_kind: input.kind,
      p_group_name: input.groupName,
      p_name: input.name,
      p_icon: input.icon,
      p_is_filter: input.isFilter,
      p_sort_order: input.sortOrder,
      p_is_active: input.isActive,
    });
    if (error) throw new Error(error.message);
  },

  async adminSetCityPopular(cityId: string, popular: boolean) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_city_popular", {
      p_city_id: cityId,
      p_popular: popular,
    });
    if (error) throw new Error(error.message);
  },

  async adminUpsertDistrict(input) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_upsert_district", {
      p_id: input.id,
      p_city_id: input.cityId,
      p_name: input.name,
    });
    if (error) throw new Error(error.message);
  },

  // --- Katalog ve sahiplenme ------------------------------------------------

  // Pasif (planlanan) kategoriler de dönüyor: ana sayfa onları "yakında"
  // olarak gösteriyor. Yalnızca aktifleri isteyen çağıran kendi filtreliyor.
  async listBusinessCategories() {
    const supabase = createPublicClient();
    return unwrap(
      await supabase
        .from("business_categories")
        .select("id, slug, name, plural_name, path_prefix, sort_order, is_active")
        .order("sort_order"),
      "listBusinessCategories",
    ) as unknown as BusinessCategory[];
  },

  async adminCreateVenue(input) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_create_venue", {
      p_name: input.name,
      p_city_id: input.cityId,
      p_district_id: input.districtId,
      p_category_id: input.categoryId,
      p_venue_type_id: input.venueTypeId,
      p_address: input.address,
      p_contact_phone: input.contactPhone,
      p_website_url: input.websiteUrl,
    });
    if (error) throw new Error(error.message);
    return data as unknown as { id: string; slug: string };
  },

  async adminListClaims(status, offset) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_list_claims", {
      p_status: status,
      p_limit: 25,
      p_offset: offset,
    });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as AdminClaim[];
    return {
      items: rows.map((r) => ({ ...r, created_at: toIso(r.created_at) })),
      total: rows.length > 0 ? Number(rows[0].total_count) : 0,
    };
  },

  async adminReviewClaim(claimId: string, approve: boolean, note?: string) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_review_claim", {
      p_claim_id: claimId,
      p_approve: approve,
      p_note: note ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async claimVenue(venueId: string, note?: string, phone?: string) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("claim_venue", {
      p_venue_id: venueId,
      p_note: note ?? null,
      p_phone: phone ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async getSeoPage(path: string): Promise<SeoPage | null> {
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("get_seo_page", { p_path: path });
    if (error) throw new Error(`get_seo_page: ${error.message}`);
    return data ? normalizeSeoPage(data as unknown as SeoPage) : null;
  },

  async listActiveSeoPages(): Promise<SeoSitemapEntry[]> {
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("list_active_seo_pages");
    if (error) throw new Error(`list_active_seo_pages: ${error.message}`);
    return ((data ?? []) as unknown as SeoSitemapEntry[]).map((e) => ({
      ...e,
      updated_at: new Date(e.updated_at).toISOString(),
    }));
  },

  async listVenueSitemap() {
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("list_venue_sitemap");
    if (error) throw new Error(`list_venue_sitemap: ${error.message}`);
    return ((data ?? []) as unknown as { path: string; updated_at: string }[]).map((v) => ({
      path: v.path,
      updated_at: new Date(v.updated_at).toISOString(),
    }));
  },

  async listFeatures() {
    const supabase = createPublicClient();
    return unwrap(
      await supabase
        .from("features")
        .select("id, kind, group_name, name, slug, icon, is_filter, sort_order")
        .eq("is_active", true)
        .order("sort_order"),
      "features",
    );
  },
};
