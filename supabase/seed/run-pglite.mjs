/**
 * Seed'i bellek içi PostgreSQL'de (PGlite) çalıştırır.
 * Gerçek veritabanına dokunmadan seed'in doğruluğunu doğrular.
 */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
import path from "node:path";
import { seedTaksonomi, seedDemoMekanlar, seedDemoYorumlar } from "./apply.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const db = await PGlite.create({ extensions: { pgcrypto } });
const q = (sql, params) => db.query(sql, params);

db.exec(fs.readFileSync(path.join(HERE, "..", "tests", "supabase-stub.sql"), "utf8"));
const MIG = path.join(HERE, "..", "migrations");
for (const f of fs.readdirSync(MIG).sort()) {
  await db.exec(fs.readFileSync(path.join(MIG, f), "utf8"));
}

const OWNERS = [
  "a1111111-1111-1111-1111-111111111111",
  "a2222222-2222-2222-2222-222222222222",
  "a3333333-3333-3333-3333-333333333333",
];
for (const [i, id] of OWNERS.entries()) {
  await q("insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3)",
    [id, `demo-sahip-${i + 1}@dugunce.test`,
     JSON.stringify({ full_name: `Demo Mekan Sahibi ${i + 1}` })]);
}
await q("update public.profiles set role = 'venue_owner' where id = any($1)", [OWNERS]);

console.log("\n\x1b[1mTaksonomi\x1b[0m");
console.log(await seedTaksonomi(q));

console.log("\n\x1b[1mDemo mekanlar\x1b[0m");
console.log(await seedDemoMekanlar(q, OWNERS));

console.log("\n\x1b[1mDemo yorumlar\x1b[0m");
console.log(await seedDemoYorumlar(q, async (i, adSoyad) => {
  const id = `b${String(i + 1).padStart(7, "0")}-0000-4000-8000-000000000000`;
  await q("insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3) on conflict do nothing",
    [id, `demo-yorumcu-${i + 1}@dugunce.test`, JSON.stringify({ full_name: adSoyad })]);
  return id;
}));

console.log("\n\x1b[1mDoğrulama\x1b[0m");
const say = async (label, sql) => {
  const r = await q(sql);
  console.log(`  ${label}: ${JSON.stringify(r.rows[0] ?? r.rows)}`);
};
await say("yayındaki mekan", "select count(*)::int as n from public.venues where status='PUBLISHED'");
await say("ortalama tamamlanma", "select round(avg(completion_score))::int as n from public.venues");
await say("görsel", "select count(*)::int as n from public.venue_images");
await say("denormalize boş kalan", "select count(*)::int as n from public.venues where feature_slugs = '{}'");
await say("en çok mekanı olan 5 şehir",
  `select json_agg(x) as top from (
     select name, venue_count from public.cities
     where venue_count > 0 order by venue_count desc, name limit 5) x`);
await say("örnek arama: istanbul + düğün",
  `select count(*)::int as n from public.search_venues(
     p_city_slug => 'istanbul', p_event_type_slug => 'dugun')`);
await say("örnek arama: 300 kişi + otopark + açık alan",
  `select count(*)::int as n from public.search_venues(
     p_guest_count => 300, p_feature_slugs => array['otopark'], p_has_outdoor => true)`);
await say("onaylı yorum", "select count(*)::int as n from public.reviews where status='APPROVED'");
await say("puanı olan mekan",
  "select count(*)::int as n from public.venues where rating_count > 0");
await say("detay: bahce-davet",
  `select jsonb_build_object(
     'ad', d->>'name', 'gorsel', jsonb_array_length(d->'images'),
     'ozellik', jsonb_array_length(d->'features'),
     'etkinlik', jsonb_array_length(d->'event_types'),
     'puan', d->>'rating_avg', 'yorum', d->>'rating_count') as detay
   from (select public.get_venue_detail('bahce-davet') as d) x`);
await say("örnek arama: fiyat 40.000–80.000, ucuzdan pahalıya",
  `select json_agg(x) as sonuc from (
     select name, starting_price from public.search_venues(
       p_min_price => 40000, p_max_price => 80000, p_sort => 'fiyat-artan') limit 5) x`);

console.log("\n\x1b[32mSeed doğrulandı.\x1b[0m\n");
process.exit(0);
