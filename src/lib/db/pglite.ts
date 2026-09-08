import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  normalizeReview, normalizeVenueDetail, toVenueCard,
  type VenueDetail, type VenueReview, type VenueSearchRow,
} from "@/types/db";
import type {
  CreateInquiryInput, CreateInquiryResult, DataSource, SearchInput, SearchResult,
} from "./source";

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

/**
 * Geliştirmede diske kalıcı (`.pglite`), üretim build doğrulamasında bellek içi.
 *
 * Next build prerender'ı birden fazla worker ile paralel çalıştırıyor ve
 * PGlite aynı dizini iki kez açamıyor. Kaçış kapısı yolunda her worker kendi
 * geçici veritabanını kuruyor — yavaş ama build'i doğrulamaya yetiyor.
 */
const DATA_DIR =
  process.env.NODE_ENV === "production" ? undefined : path.join(ROOT, ".pglite");

declare global {
  // eslint-disable-next-line no-var
  var __davetmekaniPglite: Promise<PgLiteDb> | undefined;
}

async function bootstrap(): Promise<PgLiteDb> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
  const db = (await PGlite.create({
    ...(DATA_DIR ? { dataDir: DATA_DIR } : {}),
    extensions: { pgcrypto },
  })) as unknown as PgLiteDb;

  const supa = path.join(ROOT, "supabase");

  // Stub idempotent; her açılışta çalıştırmak güvenli ve rol/şema eksikliğini
  // tek yerden kapatıyor.
  await db.exec(fs.readFileSync(path.join(supa, "tests", "supabase-stub.sql"), "utf8"));
  await db.exec(
    `create table if not exists public._dev_migrations (
       name text primary key,
       applied_at timestamptz not null default now())`);

  // Uygulanmış migration'ları takip ediyoruz: yeni bir migration eklendiğinde
  // veritabanını silmek gerekmesin, gerçek bir koşucu gibi yalnızca eksikler
  // uygulansın.
  const { rows: appliedRows } = await db.query<{ name: string }>(
    "select name from public._dev_migrations");
  const applied = new Set(appliedRows.map((r) => r.name));
  const fresh = applied.size === 0;

  const migDir = path.join(supa, "migrations");
  const pending = fs.readdirSync(migDir).sort().filter((f) => !applied.has(f));
  for (const f of pending) {
    console.log(`[pglite] migration uygulanıyor: ${f}`);
    await db.exec(fs.readFileSync(path.join(migDir, f), "utf8"));
    await db.query("insert into public._dev_migrations (name) values ($1)", [f]);
  }

  if (!fresh) return db;

  console.log("[pglite] geliştirme veritabanı kuruluyor…");
  const { seedTaksonomi, seedDemoMekanlar, seedDemoYorumlar } = await import(
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
  await seedDemoYorumlar(q, async (i: number, adSoyad: string) => {
    const id = `b${String(i + 1).padStart(7, "0")}-0000-4000-8000-000000000000`;
    await db.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3) on conflict do nothing",
      [id, `demo-yorumcu-${i + 1}@davetmekani.test`,
       JSON.stringify({ full_name: adSoyad })]);
    return id;
  });
  console.log("[pglite] hazır. Sıfırlamak için: rm -rf .pglite");
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

  async getVenueDetail(slug: string): Promise<VenueDetail | null> {
    const db = await getDb();
    const { rows } = await db.query<{ d: VenueDetail | null }>(
      "select public.get_venue_detail($1) as d", [slug]);
    const detail = rows[0]?.d;
    return detail ? normalizeVenueDetail(detail) : null;
  },

  async getVenueReviews(venueId: string, limit = 10, offset = 0) {
    const db = await getDb();
    const { rows } = await db.query<VenueReview>(
      "select * from public.get_venue_reviews($1, $2, $3)", [venueId, limit, offset]);
    const items = rows.map(normalizeReview);
    return { items, total: items.length ? Number(items[0].total_count) : 0 };
  },

  async recordVenueView(venueId: string) {
    const db = await getDb();
    try {
      await db.query("select public.record_venue_view($1)", [venueId]);
    } catch (error) {
      console.error("[record_venue_view]", error);
    }
  },

  async createInquiry(input: CreateInquiryInput): Promise<CreateInquiryResult> {
    const db = await getDb();
    const { rows } = await db.query<{ r: CreateInquiryResult }>(
      `select public.create_inquiry(
         p_venue_id => $1, p_full_name => $2, p_phone => $3, p_email => $4,
         p_event_type_id => $5, p_event_date => $6, p_guest_count => $7,
         p_message => $8, p_ip_hash => $9, p_ua_hash => $10) as r`,
      [
        input.venueId, input.fullName, input.phone, input.email ?? null,
        input.eventTypeId ?? null, input.eventDate ?? null, input.guestCount ?? null,
        input.message ?? null, input.ipHash, input.uaHash,
      ]);
    return rows[0].r;
  },

  async listFeatures() {
    const db = await getDb();
    const { rows } = await db.query<never>(
      `select id, kind, group_name, name, slug, icon, is_filter, sort_order
         from public.features where is_active order by sort_order`);
    return rows;
  },
};
