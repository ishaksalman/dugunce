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
console.log("\n\x1b[1m13) Rol yükseltme ve görüntülenme\x1b[0m");
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
console.log(
  fail
    ? `\n\x1b[31m${fail} test başarısız\x1b[0m, ${pass} başarılı\n`
    : `\n\x1b[32mTüm testler geçti\x1b[0m (${pass})\n`);
process.exit(fail ? 1 : 0);
