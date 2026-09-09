import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import {
  normalizeAdminReview, normalizeAdminUser, normalizeAdminVenue, normalizeInquiry,
  normalizeOwnerVenue, normalizeReview, normalizeVenueDetail, normalizeVenueForEdit,
  toVenueCard, type AdminReview, type AdminStats, type AdminUser, type AdminVenue,
  type InquiryStatus, type OwnerInquiry, type OwnerStats, type OwnerVenue,
  type ReviewStatus, type UserRole, type VenueDetail, type VenueForEdit,
  type VenueReview, type VenueSearchRow, type VenueStatus,
} from "@/types/db";
import type {
  AdminReviewQuery, AdminReviewResult, AdminUserQuery, AdminUserResult,
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
