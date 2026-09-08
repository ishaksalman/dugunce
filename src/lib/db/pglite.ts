import "server-only";
import fs from "node:fs";
import path from "node:path";
import { toVenueCard, type VenueSearchRow } from "@/types/db";
import type { DataSource, SearchInput, SearchResult } from "./source";

/**
 * YALNIZCA GELİŞTİRME. Supabase kimlik bilgileri tanımlı değilken devreye
 * girer; bellek içi (diske kalıcı) gerçek bir PostgreSQL çalıştırır, şemayı
 * ve seed'i uygular.
 *
 * DİKKAT: bu bağlantı tablo sahibi olarak açılır, yani RLS DEVREDE DEĞİLDİR.
 * Vitrin sayfaları zaten `status = 'PUBLISHED'` filtresini SQL içinde
 * uyguluyor, ama yetkilendirme davranışını buradan doğrulamayın —
 * onun yeri `npm run test:db`.
 */

type PgLiteDb = {
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  exec: (sql: string) => Promise<unknown>;
};

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, ".pglite");

declare global {
  // eslint-disable-next-line no-var
  var __davetmekaniPglite: Promise<PgLiteDb> | undefined;
}

async function bootstrap(): Promise<PgLiteDb> {
  const fresh = !fs.existsSync(DATA_DIR);
  const { PGlite } = await import("@electric-sql/pglite");
  const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
  const db = (await PGlite.create({
    dataDir: DATA_DIR,
    extensions: { pgcrypto },
  })) as unknown as PgLiteDb;

  if (fresh) {
    console.log("[pglite] geliştirme veritabanı kuruluyor…");
    const supa = path.join(ROOT, "supabase");
    await db.exec(fs.readFileSync(path.join(supa, "tests", "supabase-stub.sql"), "utf8"));
    const migDir = path.join(supa, "migrations");
    for (const f of fs.readdirSync(migDir).sort()) {
      await db.exec(fs.readFileSync(path.join(migDir, f), "utf8"));
    }
    const { seedTaksonomi, seedDemoMekanlar } = await import(
      /* webpackIgnore: true */ path.join(supa, "seed", "apply.mjs")
    );
    const q = (sql: string, params?: unknown[]) => db.query(sql, params);
    const owners = [
      "a1111111-1111-1111-1111-111111111111",
      "a2222222-2222-2222-2222-222222222222",
      "a3333333-3333-3333-3333-333333333333",
    ];
    for (const [i, id] of owners.entries()) {
      await db.query(
        "insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3)",
        [id, `demo-sahip-${i + 1}@davetmekani.test`,
         JSON.stringify({ full_name: `Demo Mekan Sahibi ${i + 1}` })]);
    }
    await db.query("update public.profiles set role = 'venue_owner' where id = any($1)", [owners]);
    await seedTaksonomi(q);
    await seedDemoMekanlar(q, owners);
    console.log("[pglite] hazır. Sıfırlamak için: rm -rf .pglite");
  }
  return db;
}

function getDb(): Promise<PgLiteDb> {
  // HMR sırasında ikinci bir örnek açılırsa dosya kilidi çakışır.
  globalThis.__davetmekaniPglite ??= bootstrap();
  return globalThis.__davetmekaniPglite;
}

export const pgliteSource: DataSource = {
  async searchVenues(input: SearchInput): Promise<SearchResult> {
    const db = await getDb();
    const { rows } = await db.query<VenueSearchRow>(
      `select * from public.search_venues(
         p_city_slug => $1, p_district_slug => $2, p_event_type_slug => $3,
         p_venue_type_slug => $4, p_guest_count => $5, p_min_capacity => $6,
         p_max_capacity => $7, p_min_price => $8, p_max_price => $9,
         p_has_indoor => $10, p_has_outdoor => $11, p_feature_slugs => $12,
         p_query => $13, p_sort => $14, p_limit => $15, p_offset => $16)`,
      [
        input.citySlug ?? null, input.districtSlug ?? null, input.eventTypeSlug ?? null,
        input.venueTypeSlug ?? null, input.guestCount ?? null, input.minCapacity ?? null,
        input.maxCapacity ?? null, input.minPrice ?? null, input.maxPrice ?? null,
        input.hasIndoor ?? null, input.hasOutdoor ?? null,
        input.featureSlugs?.length ? input.featureSlugs : null,
        input.query ?? null, input.sort ?? "onerilen",
        input.limit ?? 24, input.offset ?? 0,
      ],
    );
    return {
      items: rows.map(toVenueCard),
      total: rows.length ? Number(rows[0].total_count) : 0,
    };
  },

  async listCities({ popularOnly = false } = {}) {
    const db = await getDb();
    const { rows } = await db.query<never>(
      `select id, name, slug, plate_code, is_popular, venue_count
         from public.cities
        where ($1::boolean is false or is_popular)
        order by sort_order, name`,
      [popularOnly]);
    return rows;
  },

  async listDistricts(citySlug: string) {
    const db = await getDb();
    const { rows } = await db.query<never>(
      `select d.id, d.city_id, d.name, d.slug, d.venue_count
         from public.districts d
         join public.cities c on c.id = d.city_id
        where c.slug = $1
        order by d.name`,
      [citySlug]);
    return rows;
  },

  async listEventTypes() {
    const db = await getDb();
    const { rows } = await db.query<never>(
      `select id, name, slug, seo_noun, icon, sort_order from public.event_types
        where is_active order by sort_order`);
    return rows;
  },

  async listVenueTypes() {
    const db = await getDb();
    const { rows } = await db.query<never>(
      `select id, name, slug, sort_order from public.venue_types
        where is_active order by sort_order`);
    return rows;
  },

  async listFeatures() {
    const db = await getDb();
    const { rows } = await db.query<never>(
      `select id, kind, group_name, name, slug, icon, is_filter, sort_order
         from public.features where is_active order by sort_order`);
    return rows;
  },
};
