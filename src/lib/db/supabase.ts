import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toVenueCard, type VenueSearchRow } from "@/types/db";
import type { DataSource, SearchInput, SearchResult } from "./source";
import { toRpcArgs } from "./source";

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
