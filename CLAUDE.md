@AGENTS.md

# DavetMekanı — geliştirme notları

Türkiye'de düğün, nişan, kına ve davet mekanlarını listeleyen marketplace.
Mimari kararların gerekçeleri için önce `docs/MIMARI.md` oku.

Kardeş ürün **DavetPro** (`~/Desktop/davetio`) ayrı bir veritabanı ve ayrı bir
Supabase projesidir. İki sistem yalnızca HTTP üzerinden konuşur.

## Değişmez kurallar

- **Yetkiyi RLS belirler.** Sunucu eylemlerindeki guard'lar kullanıcıya nazik
  hata vermek içindir. Yeni tablo eklerken: RLS aç + politika yaz + testine
  ekle. `supabase/tests/schema.test.mjs` bir kuralı ihlal edecek senaryoyu
  denemeden o kural yazılmış sayılmaz.

- **Guard trigger'ları `security invoker` OLMAK ZORUNDA.** `security definer`
  içinde `current_user` çağıranı değil fonksiyon sahibini döner; bu durumda
  `is_privileged()` herkes için `true` olur ve bütün guard'lar sessizce devre
  dışı kalır. Sayaç güncelleyen trigger'lar (`refresh_*`) ise `definer`
  kalmalı — anonim kullanıcı `venues` tablosuna yazamıyor.

- **Mekan sahibi kendi mekanını yayına alamaz.** `DRAFT/REJECTED →
  PENDING_REVIEW` tek izinli geçiş, o da tamamlanma oranı %60'ı geçince.
  `PUBLISHED / REJECTED / SUSPENDED` yalnızca admin. Bunu `guard_venue_update`
  zorluyor, politika değil.

- **`feature_slugs` / `event_type_slugs` yalnızca okuma kopyasıdır.** Uygulama
  kodu bu kolonlara ASLA yazmaz; `venue_features` / `venue_event_types`
  tablolarına yazar, trigger kopyayı günceller.

- **Sayaçlara elle yazma.** `favorite_count`, `inquiry_count`, `rating_avg`,
  `venue_count`, `view_count`, `completion_score` — hepsi trigger ile.

- **Para `numeric(12,2)`.** Float yok.

- **Ham IP ve User-Agent loglanmaz.** `inquiries.ip_hash` / `ua_hash` tuzlanmış
  özettir (`IP_HASH_SALT`).

- **Şehir / ilçe / etkinlik türü / özellik listesi component içine gömülmez.**
  Hepsi DB'den gelir; kaynak `supabase/seed/`.

## Şema değiştirirken

1. `supabase/migrations/` altına yeni sıralı dosya ekle — mevcutları düzenleme.
2. `src/lib/database.types.ts` içindeki tipi güncelle.
3. `npm run test:db` — testler PGlite üzerinde gerçek PostgreSQL kullanır.
4. `npm run seed:check` — seed hâlâ uygulanıyor mu.
5. Yeni davranış için `supabase/tests/schema.test.mjs` içine test ekle.

## Renk ve tipografi

- Marka renkleri `src/app/globals.css` içinde tek yerde: `--brand-*`
  (derin petrol, `#1F363C` → `--brand-900`) ve `--sage-*`
  (soft yeşil, `#CDE6C8` → `--sage-200`).
- Component'lerde ham renk YAZILMAZ; yalnızca semantik token
  (`bg-primary`, `text-muted-foreground`, `border-border`…).
- Başlıklar **Fraunces** (`font-heading`, yalnızca h1–h3), gövde ve arayüz
  **Inter**. Her iki fontta da `latin-ext` alt kümesi zorunlu — Türkçe
  karakterler (ı, ğ, ş, İ) orada.
- Sayısal alanlarda (fiyat, kapasite) `.tabular` sınıfı.

## Arayüz

- Metinler Türkçe, tarih `dd.MM.yyyy`, para `₺75.000`.
- Boş / yükleniyor / hata durumlarını atlamadan yaz.
- Mobil öncelikli: sticky "Filtrele", sticky "Teklif Al", kaydırmalı galeri.
- Filtre durumu URL query param'ında tutulur — paylaşılabilir ve geri tuşu çalışır.

## SEO

- İndekslenen tek liste yüzeyi SEO landing sayfalarıdır
  (`/istanbul-dugun-mekanlari`). `/mekanlar?filtre=` her zaman `noindex,follow`.
- Bir landing sayfası en az 3 yayınlanmış mekan yoksa `is_active=false` olur:
  200 döner ama `noindex` alır ve sitemap'e girmez. Boş sayfa üretme.
- Türkçe slug için tek fonksiyon: SQL'de `slugify_tr()`, JS'te
  `supabase/seed/apply.mjs → slugify()`. İkisi aynı sonucu vermeli.
