import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeReview, normalizeVenueDetail, toVenueCard,
  type VenueDetail, type VenueReview, type VenueSearchRow,
} from "@/types/db";
import type {
  CreateInquiryInput, CreateInquiryResult, DataSource, SearchInput, SearchResult,
} from "./source";
import { inquiryRpcArgs, toRpcArgs } from "./source";

/** Sorgu hatası yutulmaz: boş liste göstermek "mekan yok" demek olur. */
function unwrap<T>(res: { data: T | null; error: { message: string } | null }, ctx: string): T {
  if (res.error) throw new Error(`${ctx}: ${res.error.message}`);
  return (res.data ?? []) as T;
}

export const supabaseSource: DataSource = {
  async searchVenues(input: SearchInput): Promise<SearchResult> {
    const supabase = await createClient();
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
    const supabase = await createClient();
    let q = supabase
      .from("cities")
      .select("id, name, slug, plate_code, is_popular, venue_count");
    if (popularOnly) q = q.eq("is_popular", true);
    return unwrap(await q.order("sort_order").order("name"), "cities");
  },

  async listDistricts(citySlug: string) {
    const supabase = await createClient();
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
    const supabase = await createClient();
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
    const supabase = await createClient();
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
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_venue_detail", { p_slug: slug });
    if (error) throw new Error(`get_venue_detail: ${error.message}`);
    return data ? normalizeVenueDetail(data as VenueDetail) : null;
  },

  async getVenueReviews(venueId: string, limit = 10, offset = 0) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_venue_reviews", {
      p_venue_id: venueId, p_limit: limit, p_offset: offset,
    });
    if (error) throw new Error(`get_venue_reviews: ${error.message}`);
    const items = ((data ?? []) as VenueReview[]).map(normalizeReview);
    return { items, total: items.length ? Number(items[0].total_count) : 0 };
  },

  async recordVenueView(venueId: string) {
    const supabase = await createClient();
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

  async listFeatures() {
    const supabase = await createClient();
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
