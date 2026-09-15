/**
 * Seed uygulayıcısı.
 *
 * Tek bir `q(sql, params) -> { rows }` arayüzü bekler; böylece aynı kod hem
 * PGlite (test) hem gerçek Postgres/Supabase (pg sürücüsü) üzerinde çalışır.
 * Tamamı idempotent: tekrar çalıştırmak veri çoğaltmaz.
 */
import { ILLER } from "./iller.mjs";
import { ILCELER, VARSAYILAN_ILCE } from "./ilceler.mjs";
import { ETKINLIK_TURLERI, MEKAN_TURLERI, OZELLIKLER } from "./taksonomi.mjs";
import { DEMO_MEKANLAR, demoGorseller } from "./demo-mekanlar.mjs";
import { DEMO_YORUMLAR } from "./demo-yorumlar.mjs";

/** Türkçe slug — SQL'deki slugify_tr ile aynı davranmalı. */
export function slugify(input) {
  const map = { "ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","â":"a","î":"i","û":"u",
                "Ç":"c","Ğ":"g","İ":"i","I":"i","Ö":"o","Ş":"s","Ü":"u","Â":"a","Î":"i","Û":"u" };
  return input
    .replace(/[çğıöşüâîûÇĞİIÖŞÜÂÎÛ]/g, (c) => map[c])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export async function seedTaksonomi(q) {
  // --- İller ---------------------------------------------------------------
  for (const il of ILLER) {
    await q(
      `insert into public.cities (name, slug, plate_code, is_popular, sort_order, latitude, longitude)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (plate_code) do update
         set name = excluded.name, slug = excluded.slug,
             is_popular = excluded.is_popular, sort_order = excluded.sort_order`,
      [il.ad, slugify(il.ad), il.plaka, il.populer ?? false, il.sira ?? 999,
       il.lat ?? null, il.lng ?? null]);
  }

  // --- İlçeler -------------------------------------------------------------
  const { rows: sehirler } = await q("select id, plate_code from public.cities");
  const sehirIdByPlaka = Object.fromEntries(sehirler.map((c) => [c.plate_code, c.id]));

  for (const il of ILLER) {
    const ilceler = ILCELER[il.plaka] ?? [VARSAYILAN_ILCE];
    for (const ilce of ilceler) {
      await q(
        `insert into public.districts (city_id, name, slug) values ($1,$2,$3)
         on conflict (city_id, slug) do nothing`,
        [sehirIdByPlaka[il.plaka], ilce, slugify(ilce)]);
    }
  }

  // --- Etkinlik türleri ----------------------------------------------------
  for (const e of ETKINLIK_TURLERI) {
    await q(
      `insert into public.event_types (name, slug, seo_noun, icon, sort_order)
       values ($1,$2,$3,$4,$5)
       on conflict (slug) do update
         set name = excluded.name, seo_noun = excluded.seo_noun,
             icon = excluded.icon, sort_order = excluded.sort_order`,
      [e.ad, e.slug, e.seoAd, e.ikon, e.sira]);
  }

  // --- Mekan türleri -------------------------------------------------------
  for (const t of MEKAN_TURLERI) {
    await q(
      `insert into public.venue_types (name, slug, sort_order) values ($1,$2,$3)
       on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order`,
      [t.ad, t.slug, t.sira]);
  }

  // --- Özellik ve hizmetler ------------------------------------------------
  for (const o of OZELLIKLER) {
    await q(
      `insert into public.features (kind, group_name, name, slug, icon, is_filter, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (slug) do update
         set kind = excluded.kind, group_name = excluded.group_name,
             name = excluded.name, icon = excluded.icon,
             is_filter = excluded.is_filter, sort_order = excluded.sort_order`,
      [o.tur, o.grup, o.ad, o.slug, o.ikon, o.filtrede, o.sira]);
  }

  return {
    il: ILLER.length,
    ilce: (await q("select count(*)::int as n from public.districts")).rows[0].n,
    etkinlikTuru: ETKINLIK_TURLERI.length,
    mekanTuru: MEKAN_TURLERI.length,
    ozellik: OZELLIKLER.length,
  };
}

/**
 * Demo mekanları ekler ve doğrudan PUBLISHED yapar.
 *
 * DİKKAT: `rating_avg` / `rating_count` BURADA YAZILMAZ. Puan yalnızca
 * onaylanmış yorumlardan trigger ile türetilir (0004). Uydurma puan yazmak,
 * detay sayfasında "4,8 (32)" gösterip altında tek yorum olmaması demekti.
 * Yorumu olmayan mekanlar puansız görünür — kartın ve detayın bu durumu da
 * doğru göstermesi gerekiyor.
 * `ownerIds`: önceden oluşturulmuş demo mekan sahibi profil id'leri.
 */
export async function seedDemoMekanlar(q, ownerIds) {
  if (!ownerIds?.length) throw new Error("En az bir mekan sahibi id'si gerekli");

  const { rows: sehirler } = await q("select id, plate_code from public.cities");
  const sehirIdByPlaka = Object.fromEntries(sehirler.map((c) => [c.plate_code, c.id]));
  const { rows: ilceler } = await q("select id, city_id, slug from public.districts");
  const { rows: turler } = await q("select id, slug from public.venue_types");
  const turIdBySlug = Object.fromEntries(turler.map((t) => [t.slug, t.id]));
  const { rows: etkinlikler } = await q("select id, slug from public.event_types");
  const etkinlikIdBySlug = Object.fromEntries(etkinlikler.map((e) => [e.slug, e.id]));
  const { rows: ozellikler } = await q("select id, slug from public.features");
  const ozellikIdBySlug = Object.fromEntries(ozellikler.map((f) => [f.slug, f.id]));

  let eklenen = 0;
  for (const [i, m] of DEMO_MEKANLAR.entries()) {
    const slug = slugify(m.ad);
    const cityId = sehirIdByPlaka[m.plaka];
    const ilceSlug = slugify(m.ilce);
    const district = ilceler.find((d) => d.city_id === cityId && d.slug === ilceSlug);
    if (!district) throw new Error(`İlçe bulunamadı: ${m.ilce} (plaka ${m.plaka})`);

    const mevcut = await q("select id from public.venues where slug = $1", [slug]);
    if (mevcut.rows.length) continue;

    const { rows } = await q(
      `insert into public.venues (
         owner_id, slug, name, city_id, district_id, venue_type_id,
         short_description, description, min_capacity, max_capacity,
         starting_price, price_type, price_note,
         has_indoor, has_outdoor, latitude, longitude,
         contact_phone, contact_email,
         status, published_at, is_featured
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
         'PUBLISHED', now(), $20
       ) returning id`,
      [
        ownerIds[i % ownerIds.length], slug, m.ad, cityId, district.id,
        turIdBySlug[m.tur] ?? null,
        m.kisa, m.aciklama, m.min, m.max, m.fiyat, m.fiyatTipi,
        "Fiyat; davetli sayısı, menü seçimi ve sezona göre değişir. Kesin fiyat için teklif alın.",
        m.kapali, m.acik, m.lat, m.lng,
        "0850 000 00 00", "iletisim@dugunce.test",
        m.oneCikan ?? false,
      ]);
    const venueId = rows[0].id;

    for (const slugE of m.etkinlikler) {
      await q(`insert into public.venue_event_types (venue_id, event_type_id) values ($1,$2)
               on conflict do nothing`, [venueId, etkinlikIdBySlug[slugE]]);
    }
    for (const slugO of m.ozellikler) {
      const fid = ozellikIdBySlug[slugO];
      if (!fid) throw new Error(`Özellik bulunamadı: ${slugO} (${m.ad})`);
      await q(`insert into public.venue_features (venue_id, feature_id) values ($1,$2)
               on conflict do nothing`, [venueId, fid]);
    }
    for (const g of demoGorseller(slug)) {
      await q(
        `insert into public.venue_images
           (venue_id, storage_path, url, width, height, alt_text, sort_order, is_cover)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [venueId, g.storagePath, g.url, g.width, g.height,
         `${m.ad} — ${m.ilce}, ${ILLER.find((x) => x.plaka === m.plaka).ad}`,
         g.sira, g.kapak]);
    }
    eklenen++;
  }
  return { eklenen, toplam: DEMO_MEKANLAR.length };
}

/**
 * Demo yorumları ekler. Her yorum ayrı bir demo müşteri hesabına yazılır
 * (bir kullanıcı bir mekana yalnızca bir yorum yazabiliyor).
 *
 * `createReviewer(index, adSoyad)` çağrısı bir profil id'si döndürmeli;
 * PGlite ve Supabase koşucuları bunu farklı şekilde sağlıyor.
 */
export async function seedDemoYorumlar(q, createReviewer) {
  let eklenen = 0;
  for (const [i, y] of DEMO_YORUMLAR.entries()) {
    const venue = await q("select id from public.venues where slug = $1", [y.mekan]);
    if (!venue.rows.length) throw new Error(`Yorum için mekan yok: ${y.mekan}`);
    const venueId = venue.rows[0].id;

    const userId = await createReviewer(i, y.yazar);
    const mevcut = await q(
      "select 1 from public.reviews where venue_id = $1 and user_id = $2",
      [venueId, userId]);
    if (mevcut.rows.length) continue;

    await q(
      `insert into public.reviews (venue_id, user_id, rating, title, body, status, created_at)
       values ($1,$2,$3,$4,$5,'APPROVED', now() - ($6 || ' days')::interval)`,
      [venueId, userId, y.puan, y.baslik, y.metin, String(7 + i * 11)]);
    eklenen++;
  }
  return { eklenen, toplam: DEMO_YORUMLAR.length };
}
