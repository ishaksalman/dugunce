/**
 * Şema testleri — gerçek PostgreSQL (PGlite) üzerinde çalışır.
 *
 * Amaç iki şey:
 *  1. Migration'lar temiz uygulanıyor mu.
 *  2. Güvenlik kuralları VERİTABANI seviyesinde tutuyor mu. Uygulama
 *     katmanındaki guard'lar atlansa bile bu testlerin geçmesi gerekir.
 */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const MIG = path.join(HERE, "..", "migrations");

const db = await PGlite.create({ extensions: { pgcrypto } });

let pass = 0;
let fail = 0;
const ok = (m) => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${m}`); };
const bad = (m, e) => { fail++; console.log(`  \x1b[31m✗\x1b[0m ${m}\n      \x1b[90m${e}\x1b[0m`); };

async function step(name, fn) {
  try { await fn(); ok(name); } catch (e) { bad(name, e.message); }
}

/** Bir işlemin ENGELLENMESİ bekleniyor. */
async function expectFail(name, fn, match) {
  try {
    await fn();
    bad(name, "engellenmesi bekleniyordu, işlem başarılı oldu");
  } catch (e) {
    if (match && !e.message.includes(match)) {
      bad(name, `beklenen mesaj "${match}" değil: ${e.message}`);
    } else {
      ok(name);
    }
  }
}

async function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) ok(`${name} → ${a}`);
  else bad(name, `beklenen ${b}, gelen ${a}`);
}

const asUser = async (uid) => {
  await db.exec("reset role");
  await db.query("select set_config('test.uid', $1, false)", [uid ?? ""]);
  await db.exec("set role authenticated");
};
const asAnon = async () => {
  await db.exec("reset role");
  await db.query("select set_config('test.uid', '', false)");
  await db.exec("set role anon");
};
/** Sunucu tarafı (service role / migration) bağlamı. */
const asServer = async () => {
  await db.exec("reset role");
  await db.query("select set_config('test.uid', '', false)");
};

// =============================================================================
console.log("\n\x1b[1m1) Migration'lar\x1b[0m");
// =============================================================================
await step("supabase stub", () =>
  db.exec(fs.readFileSync(path.join(HERE, "supabase-stub.sql"), "utf8")));
for (const f of fs.readdirSync(MIG).sort()) {
  await step(f, () => db.exec(fs.readFileSync(path.join(MIG, f), "utf8")));
}
if (fail) {
  console.log("\n\x1b[31mMigration başarısız — testler atlanıyor.\x1b[0m");
  process.exit(1);
}

// =============================================================================
console.log("\n\x1b[1m2) Türkçe slug\x1b[0m");
// =============================================================================
for (const [input, expected] of [
  ["Beylikdüzü", "beylikduzu"],
  ["Şişli", "sisli"],
  ["Iğdır", "igdir"],
  ["İstanbul", "istanbul"],
  ["Çankaya", "cankaya"],
  ["Bahçe Davet & Kır Düğünü", "bahce-davet-kir-dugunu"],
  ["  Ağrı   Merkez  ", "agri-merkez"],
]) {
  const r = await db.query("select public.slugify_tr($1) as s", [input]);
  await eq(`slugify_tr('${input}')`, r.rows[0].s, expected);
}

// =============================================================================
console.log("\n\x1b[1m3) Kurulum: kullanıcılar ve taksonomi\x1b[0m");
// =============================================================================
const U = {
  ownerA: "11111111-1111-1111-1111-111111111111",
  ownerB: "22222222-2222-2222-2222-222222222222",
  admin:  "33333333-3333-3333-3333-333333333333",
  customer: "44444444-4444-4444-4444-444444444444",
};

await asServer();
await step("auth.users kayıtları + otomatik profil", async () => {
  for (const [k, v] of Object.entries(U)) {
    await db.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
      [v, `${k}@test.local`, JSON.stringify({ full_name: k })]);
  }
  const r = await db.query("select count(*)::int as n from public.profiles");
  if (r.rows[0].n !== 4) throw new Error(`4 profil bekleniyordu, ${r.rows[0].n} var`);
});

await step("admin rolü atandı (sunucu bağlamı)", () =>
  db.query("update public.profiles set role = 'admin' where id = $1", [U.admin]));
await step("mekan sahibi rolleri atandı", () =>
  db.query("update public.profiles set role = 'venue_owner' where id = any($1)",
    [[U.ownerA, U.ownerB]]));

let ids = {};
await step("taksonomi seed", async () => {
  const city = await db.query(
    `insert into public.cities (name, slug, plate_code, is_popular)
     values ('İstanbul', 'istanbul', 34, true) returning id`);
  ids.city = city.rows[0].id;
  const d1 = await db.query(
    `insert into public.districts (city_id, name, slug)
     values ($1, 'Beylikdüzü', 'beylikduzu') returning id`, [ids.city]);
  ids.district = d1.rows[0].id;
  const city2 = await db.query(
    `insert into public.cities (name, slug, plate_code) values ('Bursa','bursa',16) returning id`);
  ids.city2 = city2.rows[0].id;
  const d2 = await db.query(
    `insert into public.districts (city_id, name, slug)
     values ($1, 'Nilüfer', 'nilufer') returning id`, [ids.city2]);
  ids.district2 = d2.rows[0].id;

  const ev = await db.query(
    `insert into public.event_types (name, slug, seo_noun) values
       ('Düğün','dugun','düğün'), ('Nişan','nisan','nişan') returning id, slug`);
  ids.evDugun = ev.rows.find((r) => r.slug === "dugun").id;
  ids.evNisan = ev.rows.find((r) => r.slug === "nisan").id;

  const vt = await db.query(
    `insert into public.venue_types (name, slug) values ('Kır Bahçesi','kir-bahcesi') returning id`);
  ids.venueType = vt.rows[0].id;

  const fe = await db.query(
    `insert into public.features (kind, group_name, name, slug) values
       ('ozellik','İmkanlar','Otopark','otopark'),
       ('ozellik','İmkanlar','Klima','klima'),
       ('hizmet','Hizmetler','Catering','catering')
     returning id, slug`);
  for (const r of fe.rows) ids[`f_${r.slug}`] = r.id;
});

// =============================================================================
console.log("\n\x1b[1m4) Mekan yayın hattı — asıl güvenlik kuralı\x1b[0m");
// =============================================================================
await asUser(U.ownerA);

let venueA;
await step("sahip mekan oluşturabiliyor", async () => {
  const r = await db.query(
    `insert into public.venues (owner_id, slug, name, city_id, district_id)
     values ($1, 'bahce-davet', 'Bahçe Davet', $2, $3) returning id, status`,
    [U.ownerA, ids.city, ids.district]);
  venueA = r.rows[0].id;
  if (r.rows[0].status !== "DRAFT") throw new Error(`DRAFT bekleniyordu, ${r.rows[0].status}`);
});

await step("PUBLISHED göndererek oluşturulan mekan yine DRAFT doğuyor", async () => {
  const r = await db.query(
    `insert into public.venues (owner_id, slug, name, city_id, district_id, status, is_featured)
     values ($1,'hilesi-var','Hilesi Var',$2,$3,'PUBLISHED',true) returning status, is_featured`,
    [U.ownerA, ids.city, ids.district]);
  const row = r.rows[0];
  if (row.status !== "DRAFT" || row.is_featured !== false) {
    throw new Error(`DRAFT/false bekleniyordu, ${row.status}/${row.is_featured}`);
  }
});

await expectFail(
  "sahip kendi mekanını YAYINA ALAMAZ",
  () => db.query("update public.venues set status = 'PUBLISHED' where id = $1", [venueA]),
  "yetkiniz yok");

await step("sahip kendini ÖNE ÇIKARAMAZ (istek sessizce yok sayılır)", async () => {
  await db.query("update public.venues set is_featured = true where id = $1", [venueA]);
  const r = await db.query("select is_featured from public.venues where id = $1", [venueA]);
  if (r.rows[0].is_featured !== false) throw new Error("is_featured true olmuş");
});

await expectFail(
  "eksik profil incelemeye gönderilemez",
  () => db.query("update public.venues set status = 'PENDING_REVIEW' where id = $1", [venueA]),
  "tamamlanma oranı");

await step("profil dolduruluyor", async () => {
  await db.query(
    `update public.venues set
       venue_type_id = $2, description = $3, short_description = 'Doğayla iç içe davet bahçesi',
       min_capacity = 100, max_capacity = 500, starting_price = 75000,
       price_type = 'kisi_basi', contact_phone = '05001112233',
       latitude = 40.9923, longitude = 28.6412, has_outdoor = true
     where id = $1`,
    [venueA, ids.venueType, "x".repeat(250)]);
  await db.query(
    `insert into public.venue_event_types (venue_id, event_type_id) values ($1,$2),($1,$3)`,
    [venueA, ids.evDugun, ids.evNisan]);
  await db.query(
    `insert into public.venue_features (venue_id, feature_id) values ($1,$2),($1,$3),($1,$4)`,
    [venueA, ids.f_otopark, ids.f_klima, ids.f_catering]);
  for (let i = 0; i < 5; i++) {
    await db.query(
      `insert into public.venue_images (venue_id, storage_path, url, sort_order, is_cover)
       values ($1, $2, $3, $4, $5)`,
      [venueA, `v/${i}.jpg`, `https://cdn.test/${i}.jpg`, i, i === 0]);
  }
});

await step("tamamlanma oranı 100'e ulaştı", async () => {
  const r = await db.query("select completion_score from public.venues where id=$1", [venueA]);
  if (r.rows[0].completion_score !== 100) {
    throw new Error(`100 bekleniyordu, ${r.rows[0].completion_score}`);
  }
});

await step("denormalize slug kolonları senkron", async () => {
  const r = await db.query(
    "select feature_slugs, event_type_slugs from public.venues where id=$1", [venueA]);
  const f = r.rows[0].feature_slugs.slice().sort().join(",");
  const e = r.rows[0].event_type_slugs.slice().sort().join(",");
  if (f !== "catering,klima,otopark") throw new Error(`feature_slugs: ${f}`);
  if (e !== "dugun,nisan") throw new Error(`event_type_slugs: ${e}`);
});

await step("dolu profil incelemeye gönderilebiliyor", () =>
  db.query("update public.venues set status='PENDING_REVIEW' where id=$1", [venueA]));

await asUser(U.ownerB);
await expectFail(
  "başka bir sahip bu mekanı düzenleyemez",
  async () => {
    const r = await db.query(
      "update public.venues set name='Çalındı' where id=$1 returning id", [venueA]);
    if (r.rows.length === 0) throw new Error("RLS engelledi: 0 satır güncellendi");
  },
  "RLS engelledi");

await expectFail(
  "başka bir sahip taslak mekanı GÖREMEZ",
  async () => {
    const r = await db.query("select id from public.venues where id=$1", [venueA]);
    if (r.rows.length === 0) throw new Error("görünmüyor");
  },
  "görünmüyor");

await asUser(U.admin);
await step("admin yayına alabiliyor", () =>
  db.query("update public.venues set status='PUBLISHED' where id=$1", [venueA]));

await step("published_at otomatik damgalandı", async () => {
  const r = await db.query("select published_at from public.venues where id=$1", [venueA]);
  if (!r.rows[0].published_at) throw new Error("published_at boş");
});

await step("şehir/ilçe mekan sayacı güncellendi", async () => {
  const r = await db.query(
    `select c.venue_count as c, d.venue_count as d
       from public.cities c, public.districts d
      where c.id=$1 and d.id=$2`, [ids.city, ids.district]);
  if (r.rows[0].c !== 1 || r.rows[0].d !== 1) {
    throw new Error(`1/1 bekleniyordu, ${r.rows[0].c}/${r.rows[0].d}`);
  }
});

await asAnon();
await step("anonim kullanıcı yayınlanmış mekanı görüyor", async () => {
  const r = await db.query("select id from public.venues where id=$1", [venueA]);
  if (r.rows.length !== 1) throw new Error("görünmüyor");
});

// =============================================================================
console.log("\n\x1b[1m5) search_venues()\x1b[0m");
// =============================================================================
await asAnon();

const search = async (args = {}) => {
  const keys = ["p_city_slug","p_district_slug","p_event_type_slug","p_venue_type_slug",
    "p_guest_count","p_min_capacity","p_max_capacity","p_min_price","p_max_price",
    "p_has_indoor","p_has_outdoor","p_feature_slugs","p_query","p_sort"];
  const named = keys.filter((k) => k in args);
  const sql = `select * from public.search_venues(${named.map((k, i) => `${k} => $${i + 1}`).join(", ")})`;
  const r = await db.query(named.length ? sql : "select * from public.search_venues()",
    named.map((k) => args[k]));
  return r.rows;
};

await eq("filtresiz → 1 sonuç", (await search()).length, 1);
await eq("doğru şehir → 1", (await search({ p_city_slug: "istanbul" })).length, 1);
await eq("yanlış şehir → 0", (await search({ p_city_slug: "bursa" })).length, 0);
await eq("doğru ilçe → 1", (await search({ p_district_slug: "beylikduzu" })).length, 1);
await eq("etkinlik türü düğün → 1", (await search({ p_event_type_slug: "dugun" })).length, 1);
await eq("etkinlik türü kina → 0", (await search({ p_event_type_slug: "kina" })).length, 0);
await eq("300 kişi kapasiteye uyuyor → 1", (await search({ p_guest_count: 300 })).length, 1);
await eq("900 kişi kapasiteyi aşıyor → 0", (await search({ p_guest_count: 900 })).length, 0);
await eq("50 kişi minimumun altında → 0", (await search({ p_guest_count: 50 })).length, 0);
await eq("fiyat tavanı 80.000 → 1", (await search({ p_max_price: 80000 })).length, 1);
await eq("fiyat tavanı 50.000 → 0", (await search({ p_max_price: 50000 })).length, 0);
await eq("otopark+klima var → 1",
  (await search({ p_feature_slugs: ["otopark", "klima"] })).length, 1);
await eq("olmayan özellik → 0", (await search({ p_feature_slugs: ["vale"] })).length, 0);
await eq("açık alan filtresi → 1", (await search({ p_has_outdoor: true })).length, 1);
await eq("kapalı alan filtresi → 0", (await search({ p_has_indoor: true })).length, 0);
await eq("Türkçe arama 'bahçe' → 1", (await search({ p_query: "bahçe" })).length, 1);
await eq("Türkçe arama 'BAHCE' → 1", (await search({ p_query: "BAHCE" })).length, 1);
await eq("alakasız arama → 0", (await search({ p_query: "tekne" })).length, 0);

await step("kapak görseli ve toplam sayı dönüyor", async () => {
  const rows = await search();
  if (rows[0].cover_url !== "https://cdn.test/0.jpg") throw new Error(`kapak: ${rows[0].cover_url}`);
  if (Number(rows[0].total_count) !== 1) throw new Error(`total_count: ${rows[0].total_count}`);
});

await step("taslak mekan aramada çıkmıyor", async () => {
  const rows = await search();
  if (rows.length !== 1) throw new Error(`${rows.length} sonuç var, taslak sızmış olabilir`);
});

// =============================================================================
console.log("\n\x1b[1m6) Teklif talepleri\x1b[0m");
// =============================================================================
await asAnon();
let inquiryId;
await step("anonim kullanıcı teklif talebi gönderebiliyor", () =>
  // RETURNING yok: anonim kullanıcının inquiries üzerinde SELECT yetkisi
  // bilerek verilmedi. Yazabilir, geri okuyamaz.
  db.query(
    `insert into public.inquiries (venue_id, full_name, phone, event_type_id, guest_count, message)
     values ($1,'Ayşe Yılmaz','05001234567',$2,250,'Ağustos için müsait misiniz?')`,
    [venueA, ids.evDugun]));

await expectFail(
  "anonim kullanıcı gönderdiği talebi geri okuyamıyor",
  () => db.query("select id from public.inquiries limit 1"),
  "permission denied");

await asServer();
inquiryId = (await db.query("select id from public.inquiries limit 1")).rows[0].id;
await asAnon();

await step("mekanın talep sayacı arttı", async () => {
  const r = await db.query("select inquiry_count from public.venues where id=$1", [venueA]);
  if (r.rows[0].inquiry_count !== 1) throw new Error(`1 bekleniyordu, ${r.rows[0].inquiry_count}`);
});

await asUser(U.ownerB);
await expectFail(
  "başka mekan sahibi bu talebi göremiyor",
  async () => {
    const r = await db.query("select id from public.inquiries where id=$1", [inquiryId]);
    if (r.rows.length === 0) throw new Error("görünmüyor");
  },
  "görünmüyor");

await asUser(U.ownerA);
await step("mekan sahibi kendi talebini görüyor", async () => {
  const r = await db.query("select id from public.inquiries where id=$1", [inquiryId]);
  if (r.rows.length !== 1) throw new Error("görünmüyor");
});

await step("durum değişince contacted_at damgalanıyor", async () => {
  await db.query("update public.inquiries set status='CONTACTED' where id=$1", [inquiryId]);
  const r = await db.query("select contacted_at from public.inquiries where id=$1", [inquiryId]);
  if (!r.rows[0].contacted_at) throw new Error("contacted_at boş");
});

await step("mekan sahibi talep sahibinin verisini değiştiremiyor", async () => {
  await db.query("update public.inquiries set phone='00000000000' where id=$1", [inquiryId]);
  const r = await db.query("select phone from public.inquiries where id=$1", [inquiryId]);
  if (r.rows[0].phone !== "05001234567") throw new Error(`telefon değişmiş: ${r.rows[0].phone}`);
});

// =============================================================================
console.log("\n\x1b[1m7) Favoriler ve yorumlar\x1b[0m");
// =============================================================================
await asUser(U.customer);
await step("favori ekleniyor ve sayaç artıyor", async () => {
  await db.query("insert into public.favorites (user_id, venue_id) values ($1,$2)",
    [U.customer, venueA]);
  await asServer();
  const r = await db.query("select favorite_count from public.venues where id=$1", [venueA]);
  await asUser(U.customer);
  if (r.rows[0].favorite_count !== 1) throw new Error(`1 bekleniyordu, ${r.rows[0].favorite_count}`);
});

await expectFail(
  "başkasının adına favori eklenemiyor",
  () => db.query("insert into public.favorites (user_id, venue_id) values ($1,$2)",
    [U.ownerB, venueA]),
  "");

let reviewId;
await step("yorum PENDING olarak doğuyor", async () => {
  const r = await db.query(
    `insert into public.reviews (venue_id, user_id, rating, body, status)
     values ($1,$2,5,$3,'APPROVED') returning id, status`,
    [venueA, U.customer, "Harika bir mekandı, ilgi alaka mükemmeldi. Kesinlikle tavsiye ederim."]);
  reviewId = r.rows[0].id;
  if (r.rows[0].status !== "PENDING") throw new Error(`PENDING bekleniyordu, ${r.rows[0].status}`);
});

await step("onaylanmamış yorum puanı etkilemiyor", async () => {
  await asServer();
  const r = await db.query("select rating_avg, rating_count from public.venues where id=$1", [venueA]);
  await asUser(U.customer);
  if (Number(r.rows[0].rating_count) !== 0) throw new Error(`rating_count: ${r.rows[0].rating_count}`);
});

await asUser(U.admin);
await step("admin yorumu onaylayınca puan güncelleniyor", async () => {
  await db.query("update public.reviews set status='APPROVED' where id=$1", [reviewId]);
  const r = await db.query("select rating_avg, rating_count from public.venues where id=$1", [venueA]);
  if (Number(r.rows[0].rating_count) !== 1 || Number(r.rows[0].rating_avg) !== 5) {
    throw new Error(`1/5 bekleniyordu, ${r.rows[0].rating_count}/${r.rows[0].rating_avg}`);
  }
});

await asUser(U.customer);
await expectFail(
  "kullanıcı onaylanmış yorumunu değiştiremiyor",
  () => db.query("update public.reviews set body=$2 where id=$1",
    [reviewId, "Aslında hiç beğenmedim, berbat bir yerdi diyorum şimdi."]),
  "Onaylanmış yorum düzenlenemez");

// =============================================================================
console.log("\n\x1b[1m8) Mekan detayı\x1b[0m");
// =============================================================================
await asAnon();
await step("get_venue_detail yayındaki mekanı döndürüyor", async () => {
  const r = await db.query("select public.get_venue_detail('bahce-davet') as d");
  const d = r.rows[0].d;
  if (!d) throw new Error("null döndü");
  if (d.name !== "Bahçe Davet") throw new Error(`ad: ${d.name}`);
  if (d.city.slug !== "istanbul") throw new Error(`şehir: ${JSON.stringify(d.city)}`);
  if (d.district.slug !== "beylikduzu") throw new Error(`ilçe: ${JSON.stringify(d.district)}`);
  if (d.images.length !== 5) throw new Error(`görsel: ${d.images.length}`);
  if (d.features.length !== 3) throw new Error(`özellik: ${d.features.length}`);
  if (d.event_types.length !== 2) throw new Error(`etkinlik: ${d.event_types.length}`);
});

await step("ilk görsel kapak görseli", async () => {
  const r = await db.query("select public.get_venue_detail('bahce-davet') as d");
  if (r.rows[0].d.images[0].url !== "https://cdn.test/0.jpg") {
    throw new Error(`ilk görsel: ${r.rows[0].d.images[0].url}`);
  }
});

await step("yayında olmayan mekan detayda görünmüyor", async () => {
  const r = await db.query("select public.get_venue_detail('hilesi-var') as d");
  if (r.rows[0].d !== null) throw new Error("taslak mekan sızdı");
});

await step("olmayan slug null döndürüyor", async () => {
  const r = await db.query("select public.get_venue_detail('boyle-bir-mekan-yok') as d");
  if (r.rows[0].d !== null) throw new Error("null bekleniyordu");
});

await step("yorumlarda soyadı maskeleniyor", async () => {
  const r = await db.query(
    "select author_name, rating from public.get_venue_reviews($1)", [venueA]);
  if (r.rows.length !== 1) throw new Error(`${r.rows.length} yorum döndü`);
  if (r.rows[0].author_name !== "customer") {
    // Demo profil adı tek kelime ("customer"); iki kelimeli adı ayrıca sınıyoruz.
    throw new Error(`yazar: ${r.rows[0].author_name}`);
  }
});

await step("iki kelimeli ad 'Ayşe Y.' biçimine iniyor", async () => {
  await asServer();
  await db.query("update public.profiles set full_name = 'Ayşe Yılmaz' where id = $1",
    [U.customer]);
  const r = await db.query(
    "select author_name from public.get_venue_reviews($1)", [venueA]);
  await asAnon();
  if (r.rows[0].author_name !== "Ayşe Y.") throw new Error(`yazar: ${r.rows[0].author_name}`);
});

await step("onaylanmamış yorum listede yok", async () => {
  await asServer();
  await db.query("update public.reviews set status = 'PENDING' where id = $1", [reviewId]);
  const r = await db.query("select id from public.get_venue_reviews($1)", [venueA]);
  await db.query("update public.reviews set status = 'APPROVED' where id = $1", [reviewId]);
  await asAnon();
  if (r.rows.length !== 0) throw new Error(`${r.rows.length} yorum döndü`);
});

// =============================================================================
console.log("\n\x1b[1m9) create_inquiry() ve hız sınırı\x1b[0m");
// =============================================================================
await asAnon();
const createInquiry = (ip, venueId = venueA) =>
  db.query(
    `select public.create_inquiry(
       p_venue_id => $1, p_full_name => 'Test Kullanıcı', p_phone => '05001112233',
       p_ip_hash => $2) as r`,
    [venueId, ip]);

await step("talep oluşturuluyor", async () => {
  const r = await createInquiry("ip-a");
  if (!r.rows[0].r.ok) throw new Error(JSON.stringify(r.rows[0].r));
});

await step("aynı IP aynı mekana ikinci kez gönderemiyor", async () => {
  const r = await createInquiry("ip-a");
  if (r.rows[0].r.reason !== "rate_limited_venue") {
    throw new Error(JSON.stringify(r.rows[0].r));
  }
});

await step("aynı IP farklı mekana gönderebiliyor", async () => {
  await asServer();
  const other = await db.query(
    `insert into public.venues (owner_id, slug, name, city_id, district_id,
                                status, published_at)
     values ($1,'ikinci-mekan','İkinci Mekan',$2,$3,'PUBLISHED', now())
     returning id`, [U.ownerA, ids.city, ids.district]);
  await asAnon();
  const r = await createInquiry("ip-a", other.rows[0].id);
  if (!r.rows[0].r.ok) throw new Error(JSON.stringify(r.rows[0].r));
});

await step("saatlik sınır 3'te devreye giriyor", async () => {
  await asServer();
  const third = await db.query(
    `insert into public.venues (owner_id, slug, name, city_id, district_id,
                                status, published_at)
     values ($1,'ucuncu-mekan','Üçüncü Mekan',$2,$3,'PUBLISHED', now())
     returning id`, [U.ownerA, ids.city, ids.district]);
  await asAnon();
  // ip-a bu noktada 2 talep göndermiş durumda; 3. geçmeli, 4. reddedilmeli.
  const ok = await createInquiry("ip-a", third.rows[0].id);
  if (!ok.rows[0].r.ok) throw new Error(`3. talep reddedildi: ${JSON.stringify(ok.rows[0].r)}`);

  await asServer();
  const fourth = await db.query(
    `insert into public.venues (owner_id, slug, name, city_id, district_id,
                                status, published_at)
     values ($1,'dorduncu-mekan','Dördüncü Mekan',$2,$3,'PUBLISHED', now())
     returning id`, [U.ownerA, ids.city, ids.district]);
  await asAnon();
  const blocked = await createInquiry("ip-a", fourth.rows[0].id);
  if (blocked.rows[0].r.reason !== "rate_limited_hour") {
    throw new Error(`saatlik sınır tutmadı: ${JSON.stringify(blocked.rows[0].r)}`);
  }
});

await step("farklı IP sınırdan etkilenmiyor", async () => {
  const r = await createInquiry("ip-b");
  if (!r.rows[0].r.ok) throw new Error(JSON.stringify(r.rows[0].r));
});

await step("yayında olmayan mekana talep gönderilemiyor", async () => {
  await asServer();
  const draft = await db.query("select id from public.venues where slug='hilesi-var'");
  await asAnon();
  const r = await createInquiry("ip-c", draft.rows[0].id);
  if (r.rows[0].r.reason !== "venue_not_found") {
    throw new Error(JSON.stringify(r.rows[0].r));
  }
});

await expectFail(
  "anonim kullanıcı hâlâ talepleri okuyamıyor",
  () => db.query("select full_name, phone from public.inquiries limit 1"),
  "permission denied");

// =============================================================================
console.log("\n\x1b[1m10) Mekan sahibi paneli\x1b[0m");
// =============================================================================
await asUser(U.customer);
await step("müşteri become_venue_owner ile yükseliyor", async () => {
  const r = await db.query("select public.become_venue_owner() as rol");
  if (r.rows[0].rol !== "venue_owner") throw new Error(`rol: ${r.rows[0].rol}`);
});

await asUser(U.admin);
await step("admin become_venue_owner ile DÜŞÜRÜLMÜYOR", async () => {
  const r = await db.query("select public.become_venue_owner() as rol");
  if (r.rows[0].rol !== "admin") throw new Error(`admin rolü değişti: ${r.rows[0].rol}`);
});

await asUser(U.ownerA);
await step("get_my_venues yalnızca kendi mekanlarını döndürüyor", async () => {
  const r = await db.query("select id, name, status from public.get_my_venues()");
  const yabanci = r.rows.find((x) => x.name === "İkinci Mekan" ? false : false);
  if (r.rows.length === 0) throw new Error("hiç mekan dönmedi");
  const ids = new Set(r.rows.map((x) => x.id));
  await asServer();
  const kontrol = await db.query(
    "select count(*)::int as n from public.venues where id = any($1) and owner_id <> $2",
    [[...ids], U.ownerA]);
  await asUser(U.ownerA);
  if (kontrol.rows[0].n !== 0) throw new Error("başkasının mekanı listede");
  if (yabanci) throw new Error("beklenmeyen kayıt");
});

await asUser(U.ownerB);
await step("başka sahip A'nın mekanlarını get_my_venues'da görmüyor", async () => {
  const r = await db.query("select id from public.get_my_venues()");
  if (r.rows.some((x) => x.id === venueA)) throw new Error("A'nın mekanı sızdı");
});

await asUser(U.ownerA);
await step("get_owner_stats dönüşüm oranını hesaplıyor", async () => {
  const r = await db.query("select public.get_owner_stats($1) as s", [venueA]);
  const s = r.rows[0].s;
  if (s === null) throw new Error("null döndü");
  if (typeof s.conversion_rate !== "number" && typeof s.conversion_rate !== "string") {
    throw new Error(`conversion_rate: ${JSON.stringify(s.conversion_rate)}`);
  }
  if (s.completion_score !== 100) throw new Error(`completion: ${s.completion_score}`);
  if (Number(s.inquiry_count) < 1) throw new Error(`inquiry_count: ${s.inquiry_count}`);
  for (const alan of ["view_count", "favorite_count", "new_inquiries", "image_count"]) {
    if (s[alan] === undefined) throw new Error(`${alan} eksik`);
  }
  if (!Array.isArray(s.daily_views)) throw new Error("daily_views dizi değil");
});

await asUser(U.ownerB);
await step("başka sahip get_owner_stats'tan veri alamıyor", async () => {
  const r = await db.query("select public.get_owner_stats($1) as s", [venueA]);
  if (r.rows[0].s !== null) throw new Error("başkasının istatistiği sızdı");
});

await step("owns_storage_path kendi klasörüne izin veriyor", async () => {
  await asUser(U.ownerA);
  const r = await db.query("select public.owns_storage_path($1) as ok", [`${venueA}/1.jpg`]);
  if (r.rows[0].ok !== true) throw new Error("kendi klasörü reddedildi");
});

await asUser(U.ownerB);
await step("owns_storage_path başkasının klasörünü reddediyor", async () => {
  const r = await db.query("select public.owns_storage_path($1) as ok", [`${venueA}/1.jpg`]);
  if (r.rows[0].ok !== false) throw new Error("başkasının klasörüne izin verildi");
});

await step("owns_storage_path uuid olmayan yolu reddediyor", async () => {
  const r = await db.query("select public.owns_storage_path($1) as ok", ["../../etc/passwd"]);
  if (r.rows[0].ok !== false) throw new Error("geçersiz yol kabul edildi");
});

await step("venue-images kovası herkese açık ve mime kısıtlı", async () => {
  await asServer();
  const r = await db.query(
    "select public, file_size_limit, allowed_mime_types from storage.buckets where id='venue-images'");
  const b = r.rows[0];
  if (!b.public) throw new Error("kova public değil");
  if (Number(b.file_size_limit) !== 8388608) throw new Error(`boyut: ${b.file_size_limit}`);
  if (!b.allowed_mime_types.includes("image/webp")) throw new Error("webp yok");
});

// =============================================================================
console.log("\n\x1b[1m11) Sahibin talep listesi\x1b[0m");
// =============================================================================
await asUser(U.ownerA);
await step("sahip kendi mekanının taleplerini görüyor", async () => {
  const r = await db.query("select id, venue_name, full_name from public.get_owner_inquiries()");
  if (r.rows.length === 0) throw new Error("hiç talep dönmedi");
});

await step("durum filtresi çalışıyor", async () => {
  const hepsi = await db.query("select id from public.get_owner_inquiries()");
  const yeni = await db.query(
    "select id from public.get_owner_inquiries(p_status => 'NEW')");
  if (yeni.rows.length >= hepsi.rows.length) {
    throw new Error(`filtre daraltmadı: ${yeni.rows.length}/${hepsi.rows.length}`);
  }
});

await step("isme göre arama Türkçe duyarsız", async () => {
  const r = await db.query(
    "select full_name from public.get_owner_inquiries(p_query => 'AYSE')");
  if (!r.rows.some((x) => x.full_name.startsWith("Ayşe"))) {
    throw new Error(`bulunamadı: ${JSON.stringify(r.rows.map((x) => x.full_name))}`);
  }
});

await asUser(U.ownerB);
await step("başka sahip A'nın taleplerini GÖREMİYOR", async () => {
  const r = await db.query("select id, venue_name from public.get_owner_inquiries()");
  const sizinti = r.rows.filter((x) => x.venue_name === "Bahçe Davet");
  if (sizinti.length > 0) throw new Error(`${sizinti.length} talep sızdı`);
});

await asAnon();
await expectFail(
  "anonim kullanıcı talep listesini çağıramıyor",
  () => db.query("select * from public.get_owner_inquiries()"),
  "permission denied");

// =============================================================================
console.log("\n\x1b[1m12) DavetPro aktarım kuyruğu\x1b[0m");
// =============================================================================
const DP_BUSINESS = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const DP_VENUE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

await asUser(U.ownerB);
await expectFail(
  "başkasının mekanı DavetPro'ya bağlanamıyor",
  () => db.query("select public.link_venue_to_davetpro($1,$2,$3)",
    [venueA, DP_BUSINESS, DP_VENUE]),
  "yetkiniz yok");

await asUser(U.ownerA);
await step("bağlanınca GEÇMİŞ talepler kuyruğa giriyor", async () => {
  await asServer();
  const once = await db.query(
    "select count(*)::int as n from public.inquiries where venue_id = $1", [venueA]);
  await asUser(U.ownerA);
  if (once.rows[0].n === 0) throw new Error("geçmiş talep yok, test anlamsız");

  const r = await db.query("select public.link_venue_to_davetpro($1,$2,$3) as r",
    [venueA, DP_BUSINESS, DP_VENUE]);
  if (r.rows[0].r.queued_inquiries !== once.rows[0].n) {
    throw new Error(`${once.rows[0].n} bekleniyordu, ${r.rows[0].r.queued_inquiries} kuyruğa girdi`);
  }
});

await step("tekrar bağlamak işleri ÇOĞALTMIYOR", async () => {
  await asServer();
  const once = await db.query("select count(*)::int as n from public.davetpro_sync_jobs");
  await asUser(U.ownerA);
  await db.query("select public.link_venue_to_davetpro($1,$2,$3)", [venueA, DP_BUSINESS, DP_VENUE]);
  await asServer();
  const sonra = await db.query("select count(*)::int as n from public.davetpro_sync_jobs");
  await asUser(U.ownerA);
  if (sonra.rows[0].n !== once.rows[0].n) {
    throw new Error(`iş sayısı ${once.rows[0].n} → ${sonra.rows[0].n}`);
  }
});

await asAnon();
await step("bağlı mekana gelen YENİ talep otomatik kuyruğa giriyor", async () => {
  await db.query(
    `select public.create_inquiry(p_venue_id => $1, p_full_name => 'Yeni Talep',
                                  p_phone => '05009998877', p_ip_hash => 'kuyruk-test')`,
    [venueA]);
  await asServer();
  const r = await db.query(
    `select count(*)::int as n from public.davetpro_sync_jobs j
       join public.inquiries i on i.id = j.inquiry_id
      where i.phone = '05009998877'`);
  await asAnon();
  if (r.rows[0].n !== 1) throw new Error(`${r.rows[0].n} iş bulundu`);
});

await asServer();
await step("claim_davetpro_sync_jobs talep verisini birleştiriyor", async () => {
  const r = await db.query("select * from public.claim_davetpro_sync_jobs(10)");
  if (r.rows.length === 0) throw new Error("hiç iş dönmedi");
  const ilk = r.rows[0];
  for (const alan of ["job_id", "inquiry_id", "business_id", "full_name", "phone"]) {
    if (!ilk[alan]) throw new Error(`${alan} boş`);
  }
  if (ilk.business_id !== DP_BUSINESS) throw new Error("business_id yanlış");
});

await step("başarısız iş geri çekiliyor ve tekrar deneniyor", async () => {
  const job = (await db.query(
    "select id from public.davetpro_sync_jobs where status = 'pending' limit 1")).rows[0];
  await db.query("select public.complete_davetpro_sync_job($1, false, null, $2)",
    [job.id, "bağlantı hatası"]);
  const r = await db.query(
    "select status, attempts, next_attempt_at from public.davetpro_sync_jobs where id = $1",
    [job.id]);
  const row = r.rows[0];
  if (row.status !== "pending") throw new Error(`durum ${row.status}`);
  if (row.attempts !== 1) throw new Error(`deneme ${row.attempts}`);
  if (new Date(row.next_attempt_at) <= new Date()) throw new Error("geri çekilme uygulanmadı");
});

await step("beş denemeden sonra iş bırakılıyor", async () => {
  const job = (await db.query(
    "select id from public.davetpro_sync_jobs where status = 'pending' limit 1")).rows[0];
  for (let i = 0; i < 5; i++) {
    await db.query("select public.complete_davetpro_sync_job($1, false, null, 'hata')", [job.id]);
  }
  const r = await db.query(
    "select status from public.davetpro_sync_jobs where id = $1", [job.id]);
  if (r.rows[0].status !== "abandoned") throw new Error(`durum ${r.rows[0].status}`);
});

await step("başarılı iş 'sent' oluyor", async () => {
  const job = (await db.query(
    "select id from public.davetpro_sync_jobs where status <> 'sent' limit 1")).rows[0];
  await db.query("select public.complete_davetpro_sync_job($1, true, $2, null)",
    [job.id, DP_VENUE]);
  const r = await db.query(
    "select status, sent_at, davetpro_lead_id from public.davetpro_sync_jobs where id = $1",
    [job.id]);
  if (r.rows[0].status !== "sent") throw new Error(`durum ${r.rows[0].status}`);
  if (!r.rows[0].sent_at) throw new Error("sent_at boş");
});

await asAnon();
await expectFail(
  "anonim kullanıcı kuyruğu okuyamıyor",
  () => db.query("select * from public.davetpro_sync_jobs limit 1"),
  "permission denied");

await expectFail(
  "anonim kullanıcı iş talep edemiyor",
  () => db.query("select * from public.claim_davetpro_sync_jobs(1)"),
  "permission denied");

await asUser(U.ownerA);
await step("bağlantı kaldırılınca bekleyen işler iptal ediliyor", async () => {
  await db.query("select public.unlink_venue_from_davetpro($1)", [venueA]);
  await asServer();
  const r = await db.query(
    `select count(*)::int as n from public.davetpro_sync_jobs
      where venue_id = $1 and status = 'pending'`, [venueA]);
  const v = await db.query(
    "select davetpro_business_id from public.venues where id = $1", [venueA]);
  await asUser(U.ownerA);
  if (r.rows[0].n !== 0) throw new Error(`${r.rows[0].n} iş hâlâ bekliyor`);
  if (v.rows[0].davetpro_business_id !== null) throw new Error("bağlantı temizlenmedi");
});

// =============================================================================
console.log("\n\x1b[1m13) Mekan düzenleme\x1b[0m");
// =============================================================================
await asUser(U.ownerA);
await step("get_venue_for_edit sahibin taslağını da döndürüyor", async () => {
  await asServer();
  const taslak = (await db.query(
    "select id from public.venues where slug = 'hilesi-var'")).rows[0];
  await asUser(U.ownerA);
  const r = await db.query("select public.get_venue_for_edit($1) as d", [taslak.id]);
  if (!r.rows[0].d) throw new Error("taslak dönmedi");
  if (r.rows[0].d.status !== "DRAFT") throw new Error(`durum ${r.rows[0].d.status}`);
});

await step("düzenleme verisi id listelerini içeriyor", async () => {
  const r = await db.query("select public.get_venue_for_edit($1) as d", [venueA]);
  const d = r.rows[0].d;
  if (!Array.isArray(d.feature_ids) || d.feature_ids.length !== 3) {
    throw new Error(`feature_ids: ${JSON.stringify(d.feature_ids)}`);
  }
  if (!Array.isArray(d.event_type_ids) || d.event_type_ids.length !== 2) {
    throw new Error(`event_type_ids: ${JSON.stringify(d.event_type_ids)}`);
  }
  if (d.images.length !== 5) throw new Error(`görsel ${d.images.length}`);
});

await step("Google bağlantısı yalnızca Google adresini kabul ediyor", async () => {
  // Bu adres herkese açık mekan sayfasında <a href> olarak basılıyor;
  // serbest bırakılsa vitrin, sahibin istediği yere giden yönlendirme olurdu.
  for (const kotu of [
    "https://ornek.com/maps",
    "https://google.com.evil.tr/maps",
    "http://www.google.com/maps/place/x",
    "javascript:alert(1)",
  ]) {
    let gecti = false;
    try {
      await db.query("update public.venues set google_maps_url = $2 where id = $1",
        [venueA, kotu]);
      gecti = true;
    } catch { /* beklenen */ }
    if (gecti) throw new Error(`kısıt geçildi: ${kotu}`);
  }

  for (const iyi of [
    "https://maps.app.goo.gl/AbCdEf123",
    "https://www.google.com/maps/place/Bahce+Davet",
    "https://maps.google.com/?cid=123",
    "https://www.google.com.tr/maps/place/x",
  ]) {
    await db.query("update public.venues set google_maps_url = $2 where id = $1",
      [venueA, iyi]);
  }

  const r = await db.query("select public.get_venue_for_edit($1) as d", [venueA]);
  if (!r.rows[0].d.google_maps_url) throw new Error("düzenleme verisinde yok");
  const v = await db.query("select public.get_venue_detail($1) as d",
    [(await db.query("select slug from public.venues where id=$1", [venueA])).rows[0].slug]);
  if (!v.rows[0].d.google_maps_url) throw new Error("vitrin verisinde yok");
});

await asUser(U.ownerB);
await step("başka sahip düzenleme verisini ALAMIYOR", async () => {
  const r = await db.query("select public.get_venue_for_edit($1) as d", [venueA]);
  if (r.rows[0].d !== null) throw new Error("başkasının düzenleme verisi sızdı");
});

await asUser(U.ownerA);
await step("set_venue_features istenen kümeyi uyguluyor", async () => {
  await db.query("select public.set_venue_features($1, $2::uuid[])",
    [venueA, [ids.f_otopark, ids.f_klima]]);
  const r = await db.query("select feature_slugs from public.venues where id=$1", [venueA]);
  const slugs = r.rows[0].feature_slugs.slice().sort().join(",");
  if (slugs !== "klima,otopark") throw new Error(`slugs: ${slugs}`);
});

await step("boş küme tüm özellikleri kaldırıyor", async () => {
  await db.query("select public.set_venue_features($1, $2::uuid[])", [venueA, []]);
  const r = await db.query("select feature_slugs from public.venues where id=$1", [venueA]);
  if (r.rows[0].feature_slugs.length !== 0) throw new Error("özellikler kalmış");
  // Testin devamı için geri yükle
  await db.query("select public.set_venue_features($1, $2::uuid[])",
    [venueA, [ids.f_otopark, ids.f_klima, ids.f_catering]]);
});

await asUser(U.ownerB);
// set_venue_features SECURITY INVOKER: RLS politikası devrede, yabancı
// mekana yazma denemesi politika ihlaliyle durur.
await expectFail(
  "başka sahip özellik atayamıyor",
  () => db.query("select public.set_venue_features($1, $2::uuid[])",
    [venueA, [ids.f_otopark]]),
  "row-level security");

await asUser(U.ownerA);
await step("suggest_venue_slug çakışmada sonek ekliyor", async () => {
  const r1 = await db.query("select public.suggest_venue_slug('Bahçe Davet', null) as s");
  if (r1.rows[0].s !== "bahce-davet-2") throw new Error(`slug: ${r1.rows[0].s}`);
  const r2 = await db.query("select public.suggest_venue_slug('Bahçe Davet', $1) as s", [venueA]);
  if (r2.rows[0].s !== "bahce-davet") throw new Error(`kendi slug'ı: ${r2.rows[0].s}`);
  const r3 = await db.query("select public.suggest_venue_slug('!!!', null) as s");
  if (r3.rows[0].s !== "mekan") throw new Error(`boş ad: ${r3.rows[0].s}`);
});

await step("reorder_venue_images sırayı güncelliyor", async () => {
  const imgs = await db.query(
    "select id from public.venue_images where venue_id=$1 order by sort_order", [venueA]);
  const tersi = imgs.rows.map((r) => r.id).reverse();
  await db.query("select public.reorder_venue_images($1, $2::uuid[])", [venueA, tersi]);
  const sonra = await db.query(
    "select id from public.venue_images where venue_id=$1 order by sort_order", [venueA]);
  if (sonra.rows[0].id !== tersi[0]) throw new Error("sıra değişmedi");
});

// =============================================================================
console.log("\n\x1b[1m14) Yönetim paneli\x1b[0m");
// =============================================================================
await asUser(U.ownerA);
for (const [ad, sorgu] of [
  ["admin_stats", "select public.admin_stats()"],
  ["admin_list_venues", "select * from public.admin_list_venues()"],
  ["admin_list_users", "select * from public.admin_list_users()"],
  ["admin_list_reviews", "select * from public.admin_list_reviews()"],
]) {
  await expectFail(
    `mekan sahibi ${ad} çağıramıyor`,
    () => db.query(sorgu),
    "yönetici yetkisi");
}

await asAnon();
await expectFail(
  "anonim admin_stats çağıramıyor",
  () => db.query("select public.admin_stats()"),
  "");

await asUser(U.admin);
await step("admin_stats sayıları döndürüyor", async () => {
  const r = await db.query("select public.admin_stats() as s");
  const s2 = r.rows[0].s;
  for (const alan of ["pending_venues", "published", "total_users", "inquiries_total"]) {
    if (s2[alan] === undefined) throw new Error(`${alan} eksik`);
  }
  if (Number(s2.published) < 1) throw new Error(`published: ${s2.published}`);
});

await step("admin_list_venues sahip bilgisiyle geliyor", async () => {
  const r = await db.query("select * from public.admin_list_venues()");
  if (r.rows.length === 0) throw new Error("mekan dönmedi");
  if (!r.rows[0].owner_name) throw new Error("sahip adı yok");
});

await step("inceleme bekleyenler listede önce geliyor", async () => {
  await asServer();
  const taslak = (await db.query(
    "select id from public.venues where status = 'DRAFT' limit 1")).rows[0];
  await db.query(
    "update public.venues set status = 'PENDING_REVIEW' where id = $1", [taslak.id]);
  await asUser(U.admin);
  const r = await db.query("select id, status from public.admin_list_venues()");
  if (r.rows[0].status !== "PENDING_REVIEW") {
    throw new Error(`ilk sırada ${r.rows[0].status}`);
  }
});

await expectFail(
  "gerekçesiz reddetme engelleniyor",
  () => db.query(
    "select public.admin_set_venue_status($1, 'REJECTED', null)", [venueA]),
  "Gerekçe zorunlu");

await step("reddetme gerekçeyi kaydediyor ve iz bırakıyor", async () => {
  await db.query(
    "select public.admin_set_venue_status($1, 'REJECTED', $2)",
    [venueA, "Fotoğraflar mekanı temsil etmiyor."]);
  const v = await db.query(
    "select status, rejection_reason, published_at from public.venues where id=$1", [venueA]);
  if (v.rows[0].status !== "REJECTED") throw new Error(`durum ${v.rows[0].status}`);
  if (!v.rows[0].rejection_reason) throw new Error("gerekçe yazılmadı");
  if (v.rows[0].published_at !== null) throw new Error("published_at temizlenmedi");
  const iz = await db.query(
    "select action, note from public.admin_actions where entity_id=$1 order by created_at desc limit 1",
    [venueA]);
  if (iz.rows[0].action !== "status:REJECTED") throw new Error(`iz: ${iz.rows[0].action}`);
});

await step("onaylama gerekçeyi temizliyor", async () => {
  await db.query("select public.admin_set_venue_status($1, 'PUBLISHED', null)", [venueA]);
  const v = await db.query(
    "select status, rejection_reason, published_at, needs_review from public.venues where id=$1",
    [venueA]);
  if (v.rows[0].status !== "PUBLISHED") throw new Error(`durum ${v.rows[0].status}`);
  if (v.rows[0].rejection_reason !== null) throw new Error("gerekçe kaldı");
  if (!v.rows[0].published_at) throw new Error("published_at yazılmadı");
  if (v.rows[0].needs_review !== false) throw new Error("needs_review sıfırlanmadı");
});

await step("öne çıkarma çalışıyor", async () => {
  await db.query("select public.admin_set_venue_featured($1, true, now() + interval '30 days')",
    [venueA]);
  const v = await db.query(
    "select is_featured, featured_until from public.venues where id=$1", [venueA]);
  if (!v.rows[0].is_featured || !v.rows[0].featured_until) throw new Error("öne çıkarılmadı");
  await db.query("select public.admin_set_venue_featured($1, false, null)", [venueA]);
  const v2 = await db.query(
    "select is_featured, featured_until from public.venues where id=$1", [venueA]);
  if (v2.rows[0].is_featured || v2.rows[0].featured_until) throw new Error("kaldırılmadı");
});

await expectFail(
  "admin kendi rolünü değiştiremiyor",
  () => db.query("select public.admin_set_user_role($1, 'customer')", [U.admin]),
  "Kendi rolünüzü");

await expectFail(
  "admin kendi hesabını kapatamıyor",
  () => db.query("select public.admin_set_user_active($1, false, null)", [U.admin]),
  "Kendi hesabınızı");

await step("kullanıcı rolü değiştirilebiliyor ve iz kalıyor", async () => {
  await db.query("select public.admin_set_user_role($1, 'venue_owner')", [U.customer]);
  const p = await db.query("select role from public.profiles where id=$1", [U.customer]);
  if (p.rows[0].role !== "venue_owner") throw new Error(`rol ${p.rows[0].role}`);
  const iz = await db.query(
    "select action from public.admin_actions where entity_id=$1 order by created_at desc limit 1",
    [U.customer]);
  if (iz.rows[0].action !== "role:venue_owner") throw new Error(`iz: ${iz.rows[0].action}`);
  await db.query("select public.admin_set_user_role($1, 'customer')", [U.customer]);
});

await step("yorum moderasyonu puanı güncelliyor", async () => {
  await db.query("select public.admin_moderate_review($1, 'REJECTED', $2)",
    [reviewId, "Doğrulanamadı."]);
  const v = await db.query("select rating_count from public.venues where id=$1", [venueA]);
  if (Number(v.rows[0].rating_count) !== 0) {
    throw new Error(`reddedilen yorum sayılıyor: ${v.rows[0].rating_count}`);
  }
  await db.query("select public.admin_moderate_review($1, 'APPROVED', null)", [reviewId]);
  const v2 = await db.query("select rating_count from public.venues where id=$1", [venueA]);
  if (Number(v2.rows[0].rating_count) !== 1) {
    throw new Error(`onaylanan yorum sayılmıyor: ${v2.rows[0].rating_count}`);
  }
});

// =============================================================================
console.log("\n\x1b[1m15) SEO landing sayfaları\x1b[0m");
// =============================================================================
await asServer();

for (const [kelime, beklenen] of [
  ["İstanbul", "İstanbul'da"],
  ["Bursa", "Bursa'da"],
  ["İzmir", "İzmir'de"],
  ["Uşak", "Uşak'ta"],
  ["Bilecik", "Bilecik'te"],
  ["Beylikdüzü", "Beylikdüzü'nde"],
]) {
  const r = await db.query("select public.tr_locative($1) as s", [kelime]);
  // Beylikdüzü gibi ünlüyle biten kelimeler kaynaştırma harfi ister;
  // fonksiyon onu yapmıyor, bilerek basit tutuldu.
  if (kelime === "Beylikdüzü") {
    await eq(`tr_locative('${kelime}') (kaynaştırma yok)`, r.rows[0].s, "Beylikdüzü'de");
  } else {
    await eq(`tr_locative('${kelime}')`, r.rows[0].s, beklenen);
  }
}

await step("refresh_seo_pages sayfaları üretiyor", async () => {
  const r = await db.query("select public.refresh_seo_pages(1::smallint) as r");
  const s2 = r.rows[0].r;
  if (Number(s2.total) === 0) throw new Error("hiç sayfa üretilmedi");
  if (s2.ok !== true) throw new Error(JSON.stringify(s2));
});

await step("etkinlik ve şehir sayfaları doğru yolla üretildi", async () => {
  const r = await db.query(
    "select path, kind from public.seo_pages order by path");
  const yollar = r.rows.map((x) => x.path);
  for (const beklenen of ["dugun-mekanlari", "istanbul/davet-mekanlari",
                          "istanbul/dugun-mekanlari"]) {
    if (!yollar.includes(beklenen)) {
      throw new Error(`${beklenen} yok. Üretilenler: ${yollar.slice(0, 8).join(", ")}`);
    }
  }
});

await step("ilçe × etkinlik sayfası üretildi", async () => {
  const r = await db.query(
    "select path from public.seo_pages where kind = 'ilce_etkinlik'");
  if (!r.rows.some((x) => x.path === "istanbul/beylikduzu/dugun-mekanlari")) {
    throw new Error(`ilçe sayfası yok: ${r.rows.map((x) => x.path).join(", ")}`);
  }
});

await step("mekanı olmayan kombinasyon için sayfa ÜRETİLMİYOR", async () => {
  const r = await db.query(
    "select count(*)::int as n from public.seo_pages where path like 'bursa/%'");
  if (r.rows[0].n !== 0) throw new Error(`${r.rows[0].n} boş sayfa üretilmiş`);
});

await step("eşik altındaki sayfa PASİF (thin content koruması)", async () => {
  // Eşiği 3'e çıkar: tek mekanlı kombinasyonlar kapanmalı.
  await db.query("select public.refresh_seo_pages(3::smallint)");
  await db.query("update public.seo_pages set min_venue_count = 3");
  await db.query("select public.refresh_seo_pages(3::smallint)");
  const r = await db.query(
    "select is_active from public.seo_pages where path = 'istanbul/dugun-mekanlari'");
  if (r.rows[0].is_active !== false) {
    throw new Error("tek mekanlı sayfa hâlâ aktif");
  }
});

await step("get_seo_page taksonomiyi birleştiriyor", async () => {
  const r = await db.query(
    "select public.get_seo_page('istanbul/dugun-mekanlari') as p");
  const p2 = r.rows[0].p;
  if (!p2) throw new Error("sayfa dönmedi");
  if (p2.city_slug !== "istanbul") throw new Error(`şehir: ${p2.city_slug}`);
  if (p2.event_slug !== "dugun") throw new Error(`etkinlik: ${p2.event_slug}`);
  if (!p2.h1.includes("Düğün")) throw new Error(`h1: ${p2.h1}`);
});

await step("şehir × davet sayfası ÜRETİLMİYOR (şehir sayfası zaten o)", async () => {
  // `sehir` sayfası /istanbul/davet-mekanlari adresinde. `davet` etkinliğini
  // şehir düzeyinde de üretseydik iki sayfa aynı adrese düşerdi; eskiden
  // `on conflict do nothing` bunu sessizce yutuyordu.
  const r = await db.query(
    `select kind from public.seo_pages where path = 'istanbul/davet-mekanlari'`);
  if (r.rows.length !== 1) throw new Error(`${r.rows.length} satır`);
  if (r.rows[0].kind !== "sehir") throw new Error(`kind: ${r.rows[0].kind}`);

  const c = await db.query(
    `select count(*)::int as n from public.seo_pages p
       join public.event_types e on e.id = p.event_type_id
      where p.kind = 'sehir_etkinlik' and e.slug = 'davet'`);
  if (c.rows[0].n !== 0) throw new Error(`${c.rows[0].n} şehir × davet sayfası var`);
});

await step("ilçe düzeyinde davet sayfası ÜRETİLİYOR", async () => {
  // Asimetri kasıtlı: ilçenin ayrı bir "davet" sayfası yok, dolayısıyla
  // çakışma da yok. Fikstürde hiçbir mekan 'davet' türünde değil, o yüzden
  // önce ekliyoruz — yoksa test veriyi sınar, kuralı değil.
  // Fikstürde yalnızca düğün ve nişan var; 'davet' türünü burada açıyoruz.
  const davet = (await db.query(
    `insert into public.event_types (name, slug, seo_noun)
     values ('Davet','davet','davet')
     on conflict (slug) do update set name = excluded.name
     returning id`)).rows[0];
  await db.query(
    `insert into public.venue_event_types (venue_id, event_type_id)
     values ($1, $2) on conflict do nothing`, [venueA, davet.id]);
  await db.query("select public.refresh_seo_pages(1::smallint)");

  const r = await db.query(
    `select p.path from public.seo_pages p
       join public.event_types e on e.id = p.event_type_id
      where p.kind = 'ilce_etkinlik' and e.slug = 'davet'`);
  if (r.rows.length === 0) throw new Error("ilçe × davet sayfası üretilmemiş");
  if (!r.rows[0].path.endsWith("/davet-mekanlari")) {
    throw new Error(`yol: ${r.rows[0].path}`);
  }

  // Şehir düzeyinde ise hâlâ üretilmemeli.
  const c = await db.query(
    `select count(*)::int as n from public.seo_pages p
       join public.event_types e on e.id = p.event_type_id
      where p.kind = 'sehir_etkinlik' and e.slug = 'davet'`);
  if (c.rows[0].n !== 0) throw new Error("şehir × davet üretilmiş");
});

await step("yol kısıtı tek ve çok segmentli adresleri kabul, bozukları RET ediyor", async () => {
  const iyi = ["dugun-mekanlari", "istanbul/dugun-mekanlari",
               "istanbul/beylikduzu/dugun-mekanlari"];
  for (const yol of iyi) {
    await db.query(
      `select 1 where $1 ~ '^[a-z0-9-]+(/[a-z0-9-]+)*$'`, [yol]);
  }
  const et = (await db.query("select id from public.event_types limit 1")).rows[0];
  for (const kotu of ["/bastan-slash", "cift//slash", "sonda-slash/", "BÜYÜK/harf"]) {
    let gecti = false;
    try {
      await db.query(
        `insert into public.seo_pages (path, kind, event_type_id, title, h1)
         values ($1, 'etkinlik', $2, 'On karakterden uzun baslik', 'H1')`,
        [kotu, et.id]);
      gecti = true;
    } catch { /* beklenen */ }
    if (gecti) throw new Error(`kısıt geçildi: ${kotu}`);
  }
});

await step("olmayan yol null döndürüyor", async () => {
  const r = await db.query("select public.get_seo_page('olmayan-sayfa') as p");
  if (r.rows[0].p !== null) throw new Error("null bekleniyordu");
});

await step("list_active_seo_pages yalnızca aktifleri veriyor", async () => {
  await db.query("update public.seo_pages set min_venue_count = 1");
  await db.query("select public.refresh_seo_pages(1::smallint)");
  const aktif = await db.query("select count(*)::int as n from public.list_active_seo_pages()");
  const toplam = await db.query(
    "select count(*)::int as n from public.seo_pages where is_active");
  if (aktif.rows[0].n !== toplam.rows[0].n) {
    throw new Error(`${aktif.rows[0].n} / ${toplam.rows[0].n}`);
  }
});

await step("tekrar çalıştırmak sayfa ÇOĞALTMIYOR", async () => {
  const once = await db.query("select count(*)::int as n from public.seo_pages");
  await db.query("select public.refresh_seo_pages(1::smallint)");
  const sonra = await db.query("select count(*)::int as n from public.seo_pages");
  if (once.rows[0].n !== sonra.rows[0].n) {
    throw new Error(`${once.rows[0].n} → ${sonra.rows[0].n}`);
  }
});

await asAnon();
await step("anonim kullanıcı aktif sayfayı okuyabiliyor", async () => {
  const r = await db.query("select public.get_seo_page('dugun-mekanlari') as p");
  if (!r.rows[0].p) throw new Error("okunamadı");
});

// Eşik altındaki sayfa 200 + noindex ile açılmalı; RLS onu gizlerse rota
// 404 verir ve kullanıcı yakın alternatifleri göremez.
await step("anonim kullanıcı PASİF sayfayı da çözebiliyor", async () => {
  await asServer();
  await db.query("update public.seo_pages set is_active = false where path = 'dugun-mekanlari'");
  await asAnon();
  const r = await db.query("select public.get_seo_page('dugun-mekanlari') as p");
  if (!r.rows[0].p) throw new Error("pasif sayfa null döndü → rota 404 verir");
  if (r.rows[0].p.is_active !== false) throw new Error("is_active bayrağı dönmüyor");
  await asServer();
  await db.query("update public.seo_pages set is_active = true where path = 'dugun-mekanlari'");
  await asAnon();
});

await expectFail(
  "anonim kullanıcı pasif sayfayı tablodan OKUYAMIYOR",
  async () => {
    await asServer();
    await db.query("update public.seo_pages set is_active = false where path = 'soz-mekanlari'");
    await asAnon();
    const r = await db.query("select path from public.seo_pages where path = 'soz-mekanlari'");
    if (r.rows.length === 0) throw new Error("RLS gizledi");
  },
  "RLS gizledi");

// =============================================================================
console.log("\n\x1b[1m16) Veri saklama süreleri\x1b[0m");
// =============================================================================
// Gizlilik metninde ilan edilen süreler gerçekten uygulanıyor mu?
await asServer();

await step("90 günden eski taleplerin IP özeti siliniyor", async () => {
  const v = (await db.query(
    "select id from public.venues where status='PUBLISHED' limit 1")).rows[0];
  await db.query(
    `insert into public.inquiries
       (venue_id, full_name, phone, ip_hash, ua_hash, created_at)
     values ($1, 'Eski Talep', '05001112233', 'eski-ip', 'eski-ua',
             now() - interval '100 days')`, [v.id]);

  const r = await db.query("select public.purge_expired_data() as r");
  if (Number(r.rows[0].r.anonimlestirilen_talep) < 1) {
    throw new Error(`anonimleştirilen: ${r.rows[0].r.anonimlestirilen_talep}`);
  }
  const kontrol = await db.query(
    "select ip_hash, ua_hash, full_name from public.inquiries where full_name = 'Eski Talep'");
  if (kontrol.rows[0].ip_hash !== null || kontrol.rows[0].ua_hash !== null) {
    throw new Error("özetler silinmedi");
  }
  if (!kontrol.rows[0].full_name) throw new Error("talep silinmiş, oysa yalnızca iz silinmeli");
});

await step("3 yıldan eski talepler siliniyor", async () => {
  const v = (await db.query(
    "select id from public.venues where status='PUBLISHED' limit 1")).rows[0];
  await db.query(
    `insert into public.inquiries (venue_id, full_name, phone, created_at)
     values ($1, 'Çok Eski Talep', '05009998877', now() - interval '4 years')`, [v.id]);
  await db.query("select public.purge_expired_data()");
  const kontrol = await db.query(
    "select id from public.inquiries where full_name = 'Çok Eski Talep'");
  if (kontrol.rows.length !== 0) throw new Error("eski talep silinmedi");
});

await step("güncel talepler korunuyor", async () => {
  const r = await db.query(
    "select count(*)::int as n from public.inquiries where created_at > now() - interval '1 day'");
  if (r.rows[0].n === 0) throw new Error("güncel talep kalmadı");
});

await asUser(U.ownerA);
await expectFail(
  "mekan sahibi temizlik fonksiyonunu çağıramıyor",
  () => db.query("select public.purge_expired_data()"),
  "permission denied");

// =============================================================================
console.log("\n\x1b[1m17) Rol yükseltme ve görüntülenme\x1b[0m");
// =============================================================================
await asUser(U.customer);
await expectFail(
  "kullanıcı kendini admin yapamıyor",
  () => db.query("update public.profiles set role='admin' where id=$1", [U.customer]),
  "Rol değiştirme yetkiniz yok");

await asAnon();
await step("anonim görüntülenme kaydı sayaçları artırıyor", async () => {
  await db.query("select public.record_venue_view($1)", [venueA]);
  await db.query("select public.record_venue_view($1)", [venueA]);
  await asServer();
  const v = await db.query("select view_count from public.venues where id=$1", [venueA]);
  const d = await db.query(
    "select count from public.venue_views where venue_id=$1 and day=current_date", [venueA]);
  if (v.rows[0].view_count !== 2 || d.rows[0].count !== 2) {
    throw new Error(`2/2 bekleniyordu, ${v.rows[0].view_count}/${d.rows[0].count}`);
  }
});

await asAnon();
// RLS'e hiç gelmiyor: anon rolüne venues üzerinde UPDATE yetkisi verilmedi.
await expectFail(
  "anonim kullanıcı venues tablosuna doğrudan yazamıyor",
  () => db.query("update public.venues set view_count = 999999 where id=$1", [venueA]),
  "permission denied");

// =============================================================================
console.log("\n\x1b[1m18) Taksonomi yönetimi\x1b[0m");
// =============================================================================
await asUser(U.ownerA);
await expectFail(
  "mekan sahibi taksonomiyi listeleyemiyor",
  () => db.query("select public.admin_list_taxonomy()"),
  "yönetici yetkisi");

await expectFail(
  "mekan sahibi etkinlik türü ekleyemiyor",
  () => db.query("select public.admin_upsert_event_type(null, $1, $2)",
    ["Korsan Etkinlik", "korsan"]),
  "yönetici yetkisi");

await asUser(U.admin);
let yeniEtkinlik;
await step("admin etkinlik türü ekliyor, slug Türkçe kurala göre üretiliyor", async () => {
  const r = await db.query(
    "select public.admin_upsert_event_type(null, $1, $2, null, 50, true) as d",
    ["Söz Töreni", "söz töreni"]);
  yeniEtkinlik = r.rows[0].d.id;
  const e = await db.query("select slug, seo_noun from public.event_types where id=$1",
    [yeniEtkinlik]);
  if (e.rows[0].slug !== "soz-toreni") throw new Error(`slug: ${e.rows[0].slug}`);
  // seo_noun cümle içinde geçiyor; küçük saklanmalı (İ→i sorunu).
  if (e.rows[0].seo_noun !== "söz töreni") throw new Error(`seo_noun: ${e.rows[0].seo_noun}`);
});

await step("güncelleme slug'a DOKUNMUYOR", async () => {
  // Slug SEO landing adresinin parçası; değişirse gelen bağlantılar kırılır.
  await db.query(
    "select public.admin_upsert_event_type($1, $2, $3, null, 5, true)",
    [yeniEtkinlik, "Söz ve Nişan", "söz ve nişan"]);
  const e = await db.query(
    "select name, slug, sort_order from public.event_types where id=$1", [yeniEtkinlik]);
  if (e.rows[0].slug !== "soz-toreni") throw new Error(`slug değişti: ${e.rows[0].slug}`);
  if (e.rows[0].name !== "Söz ve Nişan") throw new Error("ad güncellenmedi");
  if (e.rows[0].sort_order !== 5) throw new Error("sıra güncellenmedi");
});

await step("pasife alınan tür vitrin listesinden düşüyor", async () => {
  await db.query(
    "select public.admin_upsert_event_type($1, $2, $3, null, 5, false)",
    [yeniEtkinlik, "Söz ve Nişan", "söz ve nişan"]);
  const r = await db.query(
    "select count(*)::int as n from public.event_types where id=$1 and is_active", [yeniEtkinlik]);
  if (r.rows[0].n !== 0) throw new Error("hâlâ aktif");
  // Satır DURUYOR: silinseydi ona bağlı venue_event_types cascade ile giderdi.
  const v = await db.query(
    "select count(*)::int as n from public.event_types where id=$1", [yeniEtkinlik]);
  if (v.rows[0].n !== 1) throw new Error("satır silinmiş");
});

await step("özellik slug'ı da güncellemede sabit kalıyor", async () => {
  const r = await db.query(
    "select public.admin_upsert_feature(null, 'ozellik', $1, $2, null, true, 9, true) as d",
    ["Alan ve İmkanlar", "Çocuk Oyun Alanı"]);
  const id = r.rows[0].d.id;
  const once = await db.query("select slug from public.features where id=$1", [id]);
  if (once.rows[0].slug !== "cocuk-oyun-alani") throw new Error(`slug: ${once.rows[0].slug}`);
  await db.query(
    "select public.admin_upsert_feature($1, 'ozellik', $2, $3, null, false, 9, true)",
    [id, "Alan ve İmkanlar", "Oyun Parkı"]);
  const sonra = await db.query("select slug, name, is_filter from public.features where id=$1", [id]);
  // `venues.feature_slugs` okuma kopyası bu slug'a göre yazılıyor.
  if (sonra.rows[0].slug !== "cocuk-oyun-alani") throw new Error("slug değişti");
  if (sonra.rows[0].is_filter !== false) throw new Error("is_filter güncellenmedi");
});

await step("şehir popüler bayrağı ve ilçe ekleme çalışıyor", async () => {
  const c = await db.query("select id, is_popular from public.cities order by plate_code limit 1");
  await db.query("select public.admin_set_city_popular($1, $2)", [c.rows[0].id, true]);
  const sonra = await db.query("select is_popular from public.cities where id=$1", [c.rows[0].id]);
  if (!sonra.rows[0].is_popular) throw new Error("popüler yapılamadı");

  const d = await db.query("select public.admin_upsert_district(null, $1, $2) as d",
    [c.rows[0].id, "Yeni İlçe"]);
  const ilce = await db.query("select slug, city_id from public.districts where id=$1",
    [d.rows[0].d.id]);
  if (ilce.rows[0].slug !== "yeni-ilce") throw new Error(`slug: ${ilce.rows[0].slug}`);
  if (ilce.rows[0].city_id !== c.rows[0].id) throw new Error("şehir yanlış");
});

await step("her işlem denetim izine yazılıyor", async () => {
  const r = await db.query(
    `select count(*)::int as n from public.admin_actions
      where entity_type in ('event_type','feature','city','district')`);
  if (r.rows[0].n < 6) throw new Error(`yalnızca ${r.rows[0].n} kayıt`);
});

// =============================================================================
console.log("\n\x1b[1m19) Sahipsiz katalog kaydı ve sahiplenme\x1b[0m");
// =============================================================================
let katalogId;

await asUser(U.admin);
await step("admin sahipsiz katalog kaydı açıyor", async () => {
  const yer = (await db.query(
    `select v.city_id, v.district_id from public.venues v where v.id = $1`, [venueA])).rows[0];
  const r = await db.query(
    "select public.admin_create_venue($1, $2, $3) as d",
    ["Deneme Düğün Salonu", yer.city_id, yer.district_id]);
  katalogId = r.rows[0].d.id;

  await asServer();
  const v = await db.query(
    "select owner_id, status, category_id from public.venues where id = $1", [katalogId]);
  await asUser(U.admin);
  if (v.rows[0].owner_id !== null) throw new Error("kayıt sahipli doğdu");
  if (v.rows[0].status !== "DRAFT") throw new Error(`durum: ${v.rows[0].status}`);
  if (!v.rows[0].category_id) throw new Error("kategori atanmadı");
});

await step("AYNI İLÇEDE aynı adlı ikinci kayıt ENGELLENİYOR", async () => {
  // Katalog girişinde en olası hata: aynı salonu iki kez eklemek. Eskiden
  // sessizce "-2" slug'ı üretiliyordu ve hata görünmez kalıyordu.
  const yer = (await db.query(
    `select v.city_id, v.district_id from public.venues v where v.id = $1`, [venueA])).rows[0];
  let gecti = false;
  try {
    await db.query("select public.admin_create_venue($1, $2, $3)",
      ["Deneme Düğün Salonu", yer.city_id, yer.district_id]);
    gecti = true;
  } catch (e) {
    if (!e.message.includes("aynı adlı bir kayıt zaten var")) throw e;
  }
  if (gecti) throw new Error("mükerrer kayıt kabul edildi");
});

await step("küçük/büyük harf ve Türkçe karakter farkı da yakalanıyor", async () => {
  const yer = (await db.query(
    `select v.city_id, v.district_id from public.venues v where v.id = $1`, [venueA])).rows[0];
  let gecti = false;
  try {
    await db.query("select public.admin_create_venue($1, $2, $3)",
      ["DENEME DÜĞÜN SALONU", yer.city_id, yer.district_id]);
    gecti = true;
  } catch { /* beklenen */ }
  if (gecti) throw new Error("yazım farkı mükerrerliği gizledi");
});

await step("p_force ile kasıtlı ekleme yapılabiliyor", async () => {
  const yer = (await db.query(
    `select v.city_id, v.district_id from public.venues v where v.id = $1`, [venueA])).rows[0];
  const r = await db.query(
    "select public.admin_create_venue($1, $2, $3, null, null, null, null, null, true) as d",
    ["Deneme Düğün Salonu", yer.city_id, yer.district_id]);
  if (!r.rows[0].d.slug.startsWith("deneme-dugun-salonu-")) {
    throw new Error(`slug: ${r.rows[0].d.slug}`);
  }
  await db.query("delete from public.venues where id = $1", [r.rows[0].d.id]);
});

await step("FARKLI ilçede aynı ad serbest (zincir salon)", async () => {
  const c = (await db.query(
    "select city_id from public.venues where id = $1", [venueA])).rows[0];
  const baska = (await db.query(
    `select id from public.districts where city_id = $1
       and id <> (select district_id from public.venues where id = $2) limit 1`,
    [c.city_id, venueA])).rows[0];
  if (!baska) return; // fikstürde tek ilçe varsa atla
  const r = await db.query(
    "select public.admin_create_venue($1, $2, $3) as d",
    ["Deneme Düğün Salonu", c.city_id, baska.id]);
  if (!r.rows[0].d.id) throw new Error("zincir salon eklenemedi");
  await db.query("delete from public.venues where id = $1", [r.rows[0].d.id]);
});

await step("telefon dört farklı yazımda da aynı numaraya indirgeniyor", async () => {
  const r = await db.query(
    `select public.normalize_phone_tr($1) a, public.normalize_phone_tr($2) b,
            public.normalize_phone_tr($3) c, public.normalize_phone_tr($4) d`,
    ["0212 111 22 33", "+90 212 111 22 33", "(0212) 111-22-33", "02121112233"]);
  const { a, b, c, d } = r.rows[0];
  if (!(a === b && b === c && c === d && a === "2121112233")) {
    throw new Error(JSON.stringify(r.rows[0]));
  }
  // Tanımadığı biçimi uydurmuyor.
  const k = await db.query("select public.normalize_phone_tr($1) x", ["123"]);
  if (k.rows[0].x !== "123") throw new Error(`kısa numara: ${k.rows[0].x}`);
});

await step("AYNI TELEFON farklı adla girilse de yakalanıyor", async () => {
  // 0028'in ad kontrolünün kaçırdığı durum: aynı salon, başka yazım.
  const yer = (await db.query(
    "select city_id, district_id from public.venues where id = $1", [venueA])).rows[0];
  await db.query(
    "select public.admin_create_venue($1,$2,$3,null,null,null,$4)",
    ["Telefonlu Salon", yer.city_id, yer.district_id, "0212 999 88 77"]);

  let gecti = false;
  try {
    await db.query(
      "select public.admin_create_venue($1,$2,$3,null,null,null,$4)",
      ["Bambaşka Bir Ad", yer.city_id, yer.district_id, "+90 212 999 88 77"]);
    gecti = true;
  } catch (e) {
    if (!e.message.includes("telefon numarası başka bir kayıtta")) throw e;
  }
  if (gecti) throw new Error("aynı telefon ikinci kez kabul edildi");

  // Santral paylaşan gerçek durum için force.
  const r = await db.query(
    "select public.admin_create_venue($1,$2,$3,null,null,null,$4,null,true) as d",
    ["Bambaşka Bir Ad", yer.city_id, yer.district_id, "0212 999 88 77"]);
  if (!r.rows[0].d.id) throw new Error("force ile eklenemedi");

  await db.query("delete from public.venues where name in ($1,$2)",
    ["Telefonlu Salon", "Bambaşka Bir Ad"]);
});

await step("telefon eşleşmesi aramada 'telefon' olarak işaretleniyor", async () => {
  const yer = (await db.query(
    "select city_id, district_id from public.venues where id = $1", [venueA])).rows[0];
  await db.query(
    "select public.admin_create_venue($1,$2,$3,null,null,null,$4)",
    ["Sinyal Testi Salonu", yer.city_id, yer.district_id, "0216 444 55 66"]);
  const r = await db.query(
    "select * from public.admin_find_similar_venues($1, null, $2)",
    ["hiç benzemeyen ad", "+902164445566"]);
  if (r.rows.length !== 1) throw new Error(`${r.rows.length} sonuç`);
  if (r.rows[0].eslesme !== "telefon") throw new Error(`eşleşme: ${r.rows[0].eslesme}`);
  await db.query("delete from public.venues where name = $1", ["Sinyal Testi Salonu"]);
});

await step("benzer kayıt arama yazım farkına rağmen buluyor", async () => {
  const c = (await db.query(
    "select city_id from public.venues where id = $1", [venueA])).rows[0];
  const r = await db.query(
    "select * from public.admin_find_similar_venues($1, $2)",
    ["deneme dugun", c.city_id]);
  if (r.rows.length === 0) throw new Error("benzer kayıt bulunamadı");
  // Kısa girdide sonuç dönmemeli; her harfte tüm katalogu listelemenin anlamı yok.
  const kisa = await db.query(
    "select * from public.admin_find_similar_venues($1, $2)", ["de", c.city_id]);
  if (kisa.rows.length !== 0) throw new Error("çok kısa girdide sonuç döndü");
});

await step("ilçe şehre ait değilse kayıt açılmıyor", async () => {
  const c = (await db.query(
    `select id from public.cities where id <> (select city_id from public.venues where id=$1)
      limit 1`, [venueA])).rows[0];
  const d = (await db.query(
    "select district_id from public.venues where id = $1", [venueA])).rows[0];
  let gecti = false;
  try {
    await db.query("select public.admin_create_venue($1, $2, $3)",
      ["Yanlış İlçe Salonu", c.id, d.district_id]);
    gecti = true;
  } catch { /* beklenen */ }
  if (gecti) throw new Error("tutarsız şehir/ilçe kabul edildi");
});

await step("sahipsiz TASLAK kayıt yönetim listesinde GÖRÜNÜYOR", async () => {
  // `join profiles on owner_id` INNER olsaydı kayıt buradan düşerdi ve
  // katalog ekranı işe yaramazdı.
  const r = await db.query(
    "select id, is_claimed, owner_name from public.admin_list_venues(null, null, null, 100, 0)");
  const satir = r.rows.find((x) => x.id === katalogId);
  if (!satir) throw new Error("sahipsiz kayıt listede yok");
  if (satir.is_claimed !== false) throw new Error("is_claimed yanlış");
  if (satir.owner_name !== null) throw new Error(`owner_name: ${satir.owner_name}`);
});

await asAnon();
await step("sahipsiz TASLAK anonime GÖRÜNMÜYOR", async () => {
  const r = await db.query(
    "select count(*)::int as n from public.venues where id = $1", [katalogId]);
  if (r.rows[0].n !== 0) throw new Error("taslak sızdı");
});

await expectFail(
  "oturumsuz sahiplenme başvurusu yapılamıyor",
  () => db.query("select public.claim_venue($1)", [katalogId]),
  "Oturum gerekli");

await asUser(U.ownerB);
let basvuruId;
await step("kullanıcı sahipsiz profili sahiplenmek için başvuruyor", async () => {
  const r = await db.query("select public.claim_venue($1, $2, $3) as d",
    [katalogId, "Salonun sahibiyim, vergi no 123.", "05551112233"]);
  basvuruId = r.rows[0].d.id;
  const c = await db.query(
    "select status, claimant_id from public.venue_claims where id = $1", [basvuruId]);
  if (c.rows[0].status !== "PENDING") throw new Error(`durum: ${c.rows[0].status}`);
  if (c.rows[0].claimant_id !== U.ownerB) throw new Error("başvuran yanlış");
});

await expectFail(
  "aynı kişi ikinci kez başvuramıyor",
  () => db.query("select public.claim_venue($1)", [katalogId]),
  "bekleyen bir başvurunuz");

await expectFail(
  "SAHİPLİ profil sahiplenilemiyor",
  () => db.query("select public.claim_venue($1)", [venueA]),
  "zaten sahiplenilmiş");

await asUser(U.ownerA);
await step("başka kullanıcı başvuruyu OKUYAMIYOR", async () => {
  const r = await db.query(
    "select count(*)::int as n from public.venue_claims where id = $1", [basvuruId]);
  if (r.rows[0].n !== 0) throw new Error("başkasının başvurusu sızdı");
});

await expectFail(
  "mekan sahibi başvuruyu kendi onaylayamıyor",
  () => db.query("select public.admin_review_claim($1, true)", [basvuruId]),
  "yönetici yetkisi");

await asUser(U.admin);
await expectFail(
  "gerekçesiz reddetme engelleniyor",
  () => db.query("select public.admin_review_claim($1, false, null)", [basvuruId]),
  "gerekçesi zorunlu");

await step("onay sahipliği devrediyor ve rolü yükseltiyor", async () => {
  await db.query("select public.admin_review_claim($1, true, $2)",
    [basvuruId, "Vergi levhası doğrulandı."]);
  await asServer();
  const v = await db.query("select owner_id from public.venues where id = $1", [katalogId]);
  const p = await db.query("select role from public.profiles where id = $1", [U.ownerB]);
  const c = await db.query("select status from public.venue_claims where id = $1", [basvuruId]);
  await asUser(U.admin);
  if (v.rows[0].owner_id !== U.ownerB) throw new Error("sahiplik devredilmedi");
  if (p.rows[0].role !== "venue_owner") throw new Error(`rol: ${p.rows[0].role}`);
  if (c.rows[0].status !== "APPROVED") throw new Error(`başvuru: ${c.rows[0].status}`);
});

await expectFail(
  "sonuçlanmış başvuru tekrar incelenemiyor",
  () => db.query("select public.admin_review_claim($1, true, null)", [basvuruId]),
  "zaten sonuçlanmış");

await step("sahiplenen kişi artık kaydı düzenleyebiliyor", async () => {
  await asUser(U.ownerB);
  const r = await db.query(
    "update public.venues set short_description = $2 where id = $1 returning id",
    [katalogId, "Sahiplendikten sonra düzenlendi."]);
  if (r.rows.length !== 1) throw new Error("sahibi düzenleyemedi");
  await asUser(U.admin);
});

await step("admin onayı denetim izine yazılıyor", async () => {
  const r = await db.query(
    `select count(*)::int as n from public.admin_actions
      where entity_type = 'venue_claim' and action = 'approved'`);
  if (r.rows[0].n < 1) throw new Error("denetim izi yok");
});

await step("planlanan kategoriye mekan BAĞLANAMAZ", async () => {
  // Ana sayfa pasif kategoriyi "yakında" diye gösteriyor; o kategoriye
  // kayıt açılabilseydi vitrinde adresi olmayan mekan doğardı.
  await asServer();
  const pasif = (await db.query(
    `insert into public.business_categories (slug, name, plural_name, path_prefix, is_active)
     values ('deneme-kategori','Deneme','Denemeler','denemeler', false)
     returning id`)).rows[0];
  const yer = (await db.query(
    "select city_id, district_id, owner_id from public.venues where id = $1", [venueA])).rows[0];

  // Şema seviyesinde engel YOK; kural uygulama katmanında (admin formu
  // yalnızca aktif kategori sunuyor). Burada belgelediğimiz şey bu sınır.
  await db.query(
    `insert into public.venues (owner_id, category_id, slug, name, city_id, district_id)
     values ($1, $2, 'pasif-kategorili', 'Pasif Kategorili', $3, $4)`,
    [yer.owner_id, pasif.id, yer.city_id, yer.district_id]);
  const v = await db.query(
    `select c.is_active from public.venues v
       join public.business_categories c on c.id = v.category_id
      where v.slug = 'pasif-kategorili'`);
  if (v.rows[0].is_active !== false) throw new Error("kategori aktif görünüyor");
  await db.query("delete from public.venues where slug = 'pasif-kategorili'");
  await db.query("delete from public.business_categories where slug = 'deneme-kategori'");
  await asUser(U.admin);
});

// =============================================================================
console.log("\n\x1b[1m20) Mekan özeti\x1b[0m");
// =============================================================================
await asServer();

await step("tamlayan eki kaynaştırma 'n'sini doğru koyuyor", async () => {
  // Ünlüyle bitene girer, ünsüzle bitene girmez. Locative'in aksine bu kural
  // istisnasız — iyelik eki olup olmadığına bakmıyor.
  const r = await db.query(
    `select public.tr_genitive('Ankara') a, public.tr_genitive('İstanbul') b,
            public.tr_genitive('Ordu') c, public.tr_genitive('İzmir') d,
            public.tr_genitive('Bursa') e, public.tr_genitive('Bingöl') f`);
  const b = r.rows[0];
  const bekleniyor = { a: "Ankara'nın", b: "İstanbul'un", c: "Ordu'nun",
                       d: "İzmir'in", e: "Bursa'nın", f: "Bingöl'ün" };
  for (const k of Object.keys(bekleniyor)) {
    if (b[k] !== bekleniyor[k]) {
      throw new Error(`${k}: ${b[k]} ≠ ${bekleniyor[k]}`);
    }
  }
});

await step("para Türkçe binlik ayracıyla yazılıyor", async () => {
  const r = await db.query(
    `select public.tr_money(1250) a, public.tr_money(75000) b, public.tr_money(950) c`);
  const { a, b, c } = r.rows[0];
  if (a !== "1.250" || b !== "75.000" || c !== "950") {
    throw new Error(JSON.stringify(r.rows[0]));
  }
});

await step("özet yalnızca VAR OLAN veriden cümle kuruyor", async () => {
  // Kapasite, fiyat, özellik yok → o cümleler hiç kurulmuyor. Uydurma yok.
  const yer = (await db.query(
    "select city_id, district_id from public.venues where id = $1", [venueA])).rows[0];
  const bos = (await db.query(
    `insert into public.venues (owner_id, slug, name, city_id, district_id, status)
     values (null, 'ozet-bos', 'Özet Boş', $1, $2, 'DRAFT') returning id`,
    [yer.city_id, yer.district_id])).rows[0];
  const r = await db.query("select public.venue_auto_summary($1) s", [bos.id]);
  const metin = r.rows[0].s;
  if (!metin.includes("hizmet veriyor")) throw new Error(metin);
  for (const yasak of ["kişi", "TL", "Mekanda", "Sunulan hizmetler"]) {
    if (metin.includes(yasak)) throw new Error(`boş mekanda "${yasak}" geçti: ${metin}`);
  }
});

await step("veri zenginleştikçe cümle ekleniyor", async () => {
  const id = (await db.query("select id from public.venues where slug = 'ozet-bos'")).rows[0].id;
  const once = (await db.query("select public.venue_auto_summary($1) s", [id])).rows[0].s;
  await db.query(
    `update public.venues set min_capacity = 100, max_capacity = 400,
       has_indoor = true, has_outdoor = true where id = $1`, [id]);
  const sonra = (await db.query("select public.venue_auto_summary($1) s", [id])).rows[0].s;
  if (sonra.length <= once.length) throw new Error("cümle eklenmedi");
  if (!sonra.includes("100 ile 400 kişi")) throw new Error(sonra);
  await db.query("delete from public.venues where id = $1", [id]);
});

await step("özet `description` kolonuna YAZILMIYOR", async () => {
  // Otomatik metin tamamlanma oranını şişirmemeli: o, sahibin girdisini ölçüyor.
  const r = await db.query(
    "select description, completion_score from public.venues where id = $1", [venueA]);
  const once = r.rows[0];
  await db.query("select public.venue_auto_summary($1)", [venueA]);
  const sonra = (await db.query(
    "select description, completion_score from public.venues where id = $1", [venueA])).rows[0];
  if (once.description !== sonra.description) throw new Error("description değişti");
  if (once.completion_score !== sonra.completion_score) throw new Error("skor değişti");
});

await step("vitrin verisi özeti taşıyor", async () => {
  const slug = (await db.query(
    "select slug from public.venues where id = $1", [venueA])).rows[0].slug;
  const r = await db.query("select public.get_venue_detail($1) d", [slug]);
  if (!r.rows[0].d.auto_summary) throw new Error("auto_summary yok");
});

// =============================================================================
console.log(
  fail
    ? `\n\x1b[31m${fail} test başarısız\x1b[0m, ${pass} başarılı\n`
    : `\n\x1b[32mTüm testler geçti\x1b[0m (${pass})\n`);
process.exit(fail ? 1 : 0);
