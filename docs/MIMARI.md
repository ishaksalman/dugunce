# DavetMekani — Mimari ve MVP Planı

> Karar tarihi: 2026-09-08. Bu belge projenin tek referans kaynağıdır.
> Değişiklik yaparken burayı da güncelle.

## 0. Kilitlenen kararlar

| Konu | Karar | Gerekçe |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript strict | DavetPro ile aynı |
| Veritabanı | PostgreSQL (Supabase) | — |
| Erişim katmanı | Supabase client + sıralı SQL migration | Prisma RLS'i bypass eder |
| Auth | Supabase Auth | DavetPro ile aynı IdP → hesap bağlama kolay |
| Storage | Supabase Storage (S3-uyumlu) | Cloudinary/S3 gereksiz |
| UI | Tailwind v4 + shadcn/ui | — |
| Validation | Zod, tek şema client+server | — |
| Supabase projesi | DavetPro'dan **ayrı** | Public SEO trafiği operasyonel DB'ye dokunmasın |

**Prisma/NextAuth neden seçilmedi:** Prisma pooler'a superuser bağlanır ve RLS'i
devre dışı bırakır; yetkilendirme tamamen uygulama katmanına yığılır. Ayrı IdP
(NextAuth) DavetPro ile federation yazmayı gerektirirdi. Karmaşık facet
filtrelemesi ORM yerine tek Postgres RPC + `text[]` + GIN index ile çözülüyor.

**DavetPro konumu:** `~/Desktop/davet/davetio` (package adı `davetpro`).

---

## 1. Katman mimarisi

    app/route      → layout + veri çağrısı, iş mantığı yok
      ↓
    actions / api  → authz guard + zod validation + rate limit
      ↓
    lib/services   → iş mantığı, tek DB erişim noktası
      ↓
    lib/supabase   → server / browser / admin client
      ↓
    PostgreSQL + RLS  → son savunma hattı

### Render stratejisi

| Sayfa | Strateji | Not |
|---|---|---|
| Ana sayfa | ISR `revalidate: 3600` | — |
| SEO landing | ISR + `generateStaticParams` (ilk ~200) | Asıl index yüzeyi |
| Mekan detay | ISR + on-demand `revalidateTag` | Onayda anında tazelenir |
| `/mekanlar?filtre=` | Dynamic, `noindex,follow` | Permütasyon indekslenmesin |
| `/panel`, `/yonetim` | Dynamic, `no-store`, auth-gated | — |

Filtreler URL query param'ı (paylaşılabilir, geri tuşu çalışır).
`router.replace` + skeleton; tam sayfa reload yok.

---

## 2. Klasör yapısı

    src/
      app/
        (public)/
          page.tsx                              # ana sayfa
          mekanlar/page.tsx                     # serbest arama + filtre
          mekanlar/[sehir]/[ilce]/[slug]/page.tsx   # MEKAN DETAY
          [landing]/page.tsx                    # SEO landing, seo_pages'e çözülür
          favorilerim/  mekan-ekle/
          (icerik)/{hakkimizda,iletisim,gizlilik,kullanim-kosullari}/
        (auth)/{giris,kayit,sifre-sifirla,sifre-yenile}/
        (dashboard)/panel/
          page.tsx  mekanim/[[...adim]]/  fotograflar/
          talepler/[id]/  yorumlar/  istatistikler/  ayarlar/
        (admin)/yonetim/
          page.tsx  mekanlar/[id]/  kullanicilar/  talepler/  yorumlar/
          sehirler/  etkinlik-turleri/  mekan-turleri/  ozellikler/
          seo/  reklamlar/
        api/
          venues/route.ts  taxonomy/[kind]/route.ts  inquiries/route.ts
          uploads/sign/route.ts
          integrations/davetpro/{link,webhook}/route.ts   # stub
        auth/callback/route.ts
        sitemap.ts  robots.ts  opengraph-image.tsx  not-found.tsx
      components/
        ui/          # shadcn, elle düzenlenmez
        venue/       VenueCard VenueGallery VenueFeatureGrid VenueMap PriceBlock
        search/      HeroSearch FilterSidebar FilterDrawer SortSelect ActiveFilterChips
        inquiry/     InquiryForm StickyInquiryBar InquiryStatusBadge
        layout/      Header Footer MobileTabBar
        shared/      EmptyState ErrorState Skeletons Pagination ImageDropzone
        seo/         JsonLd Breadcrumbs
      lib/
        supabase/    server.ts client.ts admin.ts middleware.ts
        services/    venues inquiries favorites reviews taxonomy stats seo-pages admin
        schemas/     venue inquiry review auth filters
        seo/         slugify metadata jsonld landing-resolver
        auth/        session guards
        integrations/davetpro.ts        # sadece kontrat + tipler
        rate-limit errors format constants database.types
      hooks/         useFilters useLocalFavorites useSubmitGuard useMediaQuery
      styles/globals.css                # @theme → renk sistemi
    supabase/
      migrations/    0001_init.sql ... (sıralı, mevcutlar düzenlenmez)
      seed/          iller-ilceler.json etkinlik-turleri ozellikler demo-mekanlar
      tests/         schema.test.mjs (PGlite)
    docs/MIMARI.md
    middleware.ts

**Kural:** Şehir / ilçe / etkinlik türü / özellik listesi hiçbir component
içine gömülmez — hepsi DB'den ve seed dosyalarından gelir.

---

## 3. Veritabanı şeması

### Enum'lar

    user_role      : customer | venue_owner | admin
    venue_status   : DRAFT | PENDING_REVIEW | PUBLISHED | REJECTED | SUSPENDED
    inquiry_status : NEW | CONTACTED | QUOTED | ACCEPTED | REJECTED | CLOSED
    review_status  : PENDING | APPROVED | REJECTED
    price_type     : kisi_basi | paket | gunluk | belirtilmemis
    feature_kind   : ozellik | hizmet
    availability   : musait | opsiyonlu | dolu
    seo_page_kind  : etkinlik | sehir_etkinlik | ilce_etkinlik | sehir

### Taksonomi (admin yönetir)

    cities       (id, name, slug, plate_code, is_popular, sort_order, venue_count)
    districts    (id, city_id→cities, name, slug, venue_count, UNIQUE(city_id, slug))
    event_types  (id, name, slug, seo_noun, icon, sort_order, is_active)
    venue_types  (id, name, slug, sort_order)
    features     (id, kind feature_kind, group_name, name, slug, icon, sort_order)

> `VenueFeature` + `VenueService` bilinçli olarak tek `features` tablosunda
> `kind` alanıyla birleştirildi — mekanizmaları birebir aynı, arayüzde `kind`'a
> göre ayrı gruplanıyor.

### Kullanıcı

    profiles (id→auth.users, full_name, phone, role user_role default 'customer',
              avatar_url, is_active, created_at, updated_at)

Ziyaretçi = kayıt yok. `customer → venue_owner` yükseltmesi mekan oluşturma
akışında otomatik; `admin` sadece elle.

### Çekirdek

    venues (
      id, owner_id→profiles, slug UNIQUE,
      name, city_id, district_id, venue_type_id,
      address, latitude, longitude,
      description, short_description,
      min_capacity, max_capacity,
      starting_price numeric(12,2), price_type, price_note,
      has_indoor, has_outdoor,
      contact_phone, contact_email, website_url, instagram_url,
      status venue_status default 'DRAFT', published_at, rejection_reason,
      is_featured, featured_until,
      view_count, favorite_count, inquiry_count,
      rating_avg numeric(2,1), rating_count,
      completion_score,
      feature_slugs text[]     -- denormalize, trigger ile
      event_type_slugs text[]  -- denormalize, trigger ile
      davetpro_business_id uuid, davetpro_venue_id uuid UNIQUE,
      davetpro_linked_at, sync_source,
      CHECK (max_capacity >= min_capacity)
    )
    venue_images      (id, venue_id, storage_path, url, width, height,
                       blur_hash, alt_text, sort_order, is_cover)
    venue_features    (venue_id, feature_id) PK, note
    venue_event_types (venue_id, event_type_id) PK
    venue_availability(id, venue_id, date, status, note, UNIQUE(venue_id,date))  -- MVP dışı

**İndeksler**

    GIN   venues(feature_slugs), venues(event_type_slugs)
    BTREE venues(status, city_id, district_id)
    BTREE venues(status, starting_price)
    BTREE venues(status, min_capacity, max_capacity)
    BTREE venues(status, is_featured DESC, rating_avg DESC)

### Etkileşim

    inquiries (id, venue_id, user_id NULL, full_name, phone, email,
               event_type_id, event_date, guest_count, message,
               status inquiry_status default 'NEW', source, owner_note,
               contacted_at, ip_hash, ua_hash, created_at)
    favorites (user_id, venue_id) PK, created_at
    reviews   (id, venue_id, user_id, rating 1..5, title, body, event_date,
               status review_status default 'PENDING', admin_note, created_at)
    notifications (id, user_id, type, title, body, link, read_at, created_at)
    venue_views   (venue_id, day date, count) PK(venue_id, day)

> Ham IP loglanmaz — `ip_hash` / `ua_hash` salt'lı hash, sadece rate-limit ve
> spam tespiti için.

### Gelir modeli ve operasyon (şema şimdi, özellik sonra)

    plans          (id, slug, name, price_monthly, lead_quota, features jsonb, is_active)
    subscriptions  (id, venue_id, plan_id, status, current_period_start/end,
                    provider, provider_ref, cancel_at)
    advertisements (id, slot, title, image_url, target_url, city_id, event_type_id,
                    starts_at, ends_at, is_active, impression_count, click_count)
    admin_actions  (id, actor_id, entity_type, entity_id, action, note, meta jsonb, created_at)
    seo_pages      (id, path UNIQUE, kind seo_page_kind,
                    city_id, district_id, event_type_id,
                    title, meta_description, h1, intro_html, faq jsonb,
                    is_active, min_venue_count default 3, updated_at)

---

## 4. İlişkiler

    auth.users 1─1 profiles
    profiles   1─N venues (owner_id)
    profiles   1─N favorites / inquiries / reviews / notifications

    cities      1─N districts,  1─N venues
    districts   1─N venues
    venue_types 1─N venues

    venues N─N event_types  → venue_event_types
    venues N─N features     → venue_features
    venues 1─N venue_images / venue_availability / inquiries /
               favorites / reviews / venue_views
    venues 1─1 subscriptions (opsiyonel)

    event_types 1─N inquiries
    seo_pages   N─1 cities / districts / event_types  (hepsi nullable)

    venues.davetpro_venue_id ⇢ [DavetPro DB]   FK YOK, opak referans

`feature_slugs[]` / `event_type_slugs[]` yalnızca okuma performansı için
türetilen kopyalardır; kaynak doğruluk her zaman join tablosundadır.
Sayaçlar (`favorite_count`, `inquiry_count`, `rating_avg`, `venue_count`)
trigger ile güncellenir; uygulama kodu elle yazmaz.

---

## 5. Yetkilendirme

Üç katman: `middleware` (route) → `guards` (action/API) → **RLS (DB, son söz)**.

| İşlem | Ziyaretçi | Müşteri | Mekan Sahibi | Admin |
|---|---|---|---|---|
| PUBLISHED mekan okuma | ✅ | ✅ | ✅ | ✅ |
| Kendi DRAFT/PENDING mekanı | — | — | ✅ | ✅ |
| Mekan oluştur / düzenle | — | — | ✅ (kendi) | ✅ |
| Kendini PUBLISHED yapma | — | — | ❌ | ✅ |
| Teklif talebi gönderme | ✅ (rate-limit) | ✅ | ✅ | ✅ |
| Kendi mekanının talepleri | — | — | ✅ | ✅ |
| Kendi talepleri | — | ✅ | ✅ | ✅ |
| Favori | localStorage | ✅ | ✅ | ✅ |
| Yorum yazma | — | ✅ → PENDING | ✅ | ✅ |
| Moderasyon / taksonomi / SEO / reklam | — | — | — | ✅ |

RLS özeti:

    is_admin()            -- security definer, recursion yok
    owns_venue(venue_id)  -- security definer

    venues SELECT : status='PUBLISHED' OR owner_id=auth.uid() OR is_admin()
    venues INSERT : owner_id=auth.uid() AND status='DRAFT'
    venues UPDATE : owner_id=auth.uid() OR is_admin()
    venues DELETE : is_admin()   -- sahip silemez, SUSPENDED yapılır

**Durum geçişini trigger zorlar:** `DRAFT→PENDING_REVIEW` sahibe açık;
`→PUBLISHED / REJECTED / SUSPENDED` yalnızca `is_admin()`.
Yayındaki mekanda kritik alan (isim, şehir, kapasite) değişirse mekan yayında
kalır ama `needs_review` bayrağı admin kuyruğuna düşer.

---

## 6. API

Mutasyonlar Server Action; dışarıdan çağrılması gereken her şey Route Handler.

**Public**

    GET  /api/venues        ?sehir&ilce&etkinlik&tur&minKapasite&maxKapasite
                            &minFiyat&maxFiyat&ozellikler=a,b,c&siralama&sayfa
    GET  /api/venues/:slug
    GET  /api/taxonomy/{cities|districts|event-types|venue-types|features}
    POST /api/inquiries     rate-limit 3/saat/IP-hash, 1/mekan/gün
    POST /api/venues/:id/view   beacon, günlük agregasyon

**Auth:** `GET /auth/callback`, `POST /auth/signout`

**Müşteri (server action):** toggleFavorite · syncLocalFavorites ·
createReview · listMyInquiries · updateProfile

**Mekan sahibi:** createVenue · saveVenueStep · submitVenueForReview ·
`POST /api/uploads/sign` · attachVenueImage / reorderImages / setCoverImage /
deleteVenueImage · setVenueFeatures · setVenueEventTypes ·
updateInquiryStatus · getOwnerDashboardStats

**Admin:** approveVenue · rejectVenue(reason) · suspendVenue · setFeatured ·
moderateReview · upsert{City,District,EventType,VenueType,Feature} ·
upsertSeoPage / toggleSeoPage · upsertAdvertisement ·
listUsers / setUserRole / setUserActive

**Entegrasyon (stub):**

    POST /api/integrations/davetpro/link      { linkCode }
    POST /api/integrations/davetpro/webhook   HMAC + Idempotency-Key
    →    POST {DAVETPRO_URL}/api/integrations/davetmekani/leads

Her endpoint: zod parse → guard → servis → tipli `ActionResult`.
Ham DB hatası istemciye gitmez, `toTurkishError()` ile çevrilir.

---

## 7. Sayfalar

**Public:** `/` · `/mekanlar` · `/{etkinlik}-mekanlari` ·
`/{sehir}-{etkinlik}-mekanlari` · `/{sehir}-{ilce}-{etkinlik}-mekanlari` ·
`/mekanlar/{sehir}/{ilce}/{slug}` · `/favorilerim` · `/mekan-ekle` ·
`/giris` `/kayit` `/sifre-sifirla` `/sifre-yenile` ·
`/hakkimizda` `/iletisim` `/gizlilik` `/kullanim-kosullari` ·
`/sitemap.xml` `/robots.txt`

**Panel:** `/panel` · `/panel/mekanim/[adim]` (9 adım) · `/panel/fotograflar` ·
`/panel/talepler` + `[id]` · `/panel/yorumlar` · `/panel/istatistikler` ·
`/panel/ayarlar`   *(MVP dışı: musaitlik, fiyatlar, uyelik)*

**Yönetim:** `/yonetim` · `mekanlar` + `[id]` · `kullanicilar` · `talepler` ·
`yorumlar` · `sehirler` · `etkinlik-turleri` · `mekan-turleri` · `ozellikler` ·
`seo` · `reklamlar`

Wizard adımları: 1 Temel bilgiler · 2 Konum · 3 Kapasite · 4 Hizmetler ·
5 Fiyatlandırma · 6 Fotoğraflar · 7 Açıklama · 8 Önizleme · 9 Yayına gönder

---

## 8. MVP kapsamı

**V1'e giren:** ana sayfa · listeleme + filtreler + sıralama · mekan detay
(galeri, özellikler, harita, sticky CTA) · mekan sahibi kaydı · 9 adımlı
wizard · fotoğraf yükleme · admin onay/red/öne çıkarma · teklif talebi +
e-posta bildirimi · favoriler (localStorage → hesap devri) · yorumlar (yaz +
admin onayla) · SEO (metadata, JSON-LD, sitemap, seo_pages) · 81 il + ilçe
seed'i · ~25 gerçekçi demo mekan.

**V1 dışı (şema hazır, kod yok):** ödeme/abonelik · müsaitlik takvimi ·
mekan sahibinin teklif oluşturması · mesajlaşma · reklam gösterimi ·
gelişmiş analitik · DavetPro canlı senkron · çoklu dil · karşılaştırma.

**Yapım sırası**

    P0  Kurulum, tasarım sistemi, DB şema + seed + PGlite testleri
    P1  Auth + roller + middleware guard'ları
    P2  MEKAN KEŞFİ   → ana sayfa, listeleme, filtreler, sıralama, kartlar
    P3  MEKAN DETAY   → galeri, özellikler, harita, mobil sticky bar
    P4  TEKLİF TALEBİ → form, rate-limit, kayıt, e-posta
    P5  MEKAN SAHİBİ  → wizard, upload, talep ekranı, istatistik
    P6  ADMIN         → onay kuyruğu, taksonomi, moderasyon
    P7  SEO           → metadata, JSON-LD, sitemap, seo_pages yönetimi
    P8  Favoriler + yorumlar cilası, erişilebilirlik ve performans geçişi

Ayrı bir mock veri katmanı yazılmıyor — P2'den itibaren seed'li gerçek DB.

---

## 9. DavetPro entegrasyonu

**İlke:** iki ayrı veritabanı, iki ayrı deploy, yalnızca HTTP.
Ortak tablo / cross-DB FK / paylaşılan şema **yok**.

Köprü alanları (şimdi ekleniyor, boş duruyor):
`venues.davetpro_business_id`, `venues.davetpro_venue_id UNIQUE`,
`davetpro_linked_at`, `sync_source`.

Bağlama akışı (V2):

    DavetPro › Ayarlar › "DavetMekani'de yayınla"
      → tek kullanımlık linkCode (5 dk TTL, business_id + venue_id taşır)
    DavetMekani › /panel/mekanim › "DavetPro hesabımı bağla" → kod girilir
      → sunucu-sunucu doğrulama (paylaşımlı secret, HMAC)
      → venue.davetpro_venue_id yazılır

Veri akışı — her alanın tek sahibi var:

| Veri | Sahibi | Yön |
|---|---|---|
| Teklif talebi (lead) | DavetMekani | → DavetPro `leads` (`source='web'`) |
| Dolu tarihler | DavetPro | → DavetMekani `venue_availability` |
| Vitrin içeriği (foto, açıklama, fiyat) | DavetMekani | senkron yok |
| Rezervasyon, ödeme, sözleşme | DavetPro | DavetMekani hiç görmez |

Her çağrı `Idempotency-Key` + HMAC + retry-with-backoff. Başarısız senkron
kuyruğa yazılır, kullanıcı akışını bloklamaz.

DavetPro `leads` şeması (`organization_type`, `guest_count`, `event_date`,
`source`) DavetMekani `inquiries` ile birebir eşleşiyor.

MVP'de yalnızca kolonlar + `lib/integrations/davetpro.ts` içinde tipli kontrat
ve `NotImplementedError`. Canlı entegrasyon kodu yazılmıyor.

---

## 10. SEO URL stratejisi

**Temel kural: her içerik için tek kanonik URL.**

| Tip | Kalıp | Örnek | Index |
|---|---|---|---|
| Etkinlik | `/{etkinlik}-mekanlari` | `/dugun-mekanlari` | ✅ |
| Şehir × etkinlik | `/{sehir}-{etkinlik}-mekanlari` | `/istanbul-dugun-mekanlari` | ✅ |
| İlçe × etkinlik | `/{sehir}-{ilce}-{etkinlik}-mekanlari` | `/istanbul-beylikduzu-dugun-mekanlari` | ✅ |
| Mekan detay | `/mekanlar/{sehir}/{ilce}/{slug}` | `/mekanlar/istanbul/beylikduzu/bahce-davet` | ✅ |
| Filtreli arama | `/mekanlar?...` | — | `noindex,follow` |

`/mekanlar/istanbul` gibi ikinci bir şehir formatı yok → `301` ile
`/istanbul-dugun-mekanlari` adresine yönlendirilir.

**Thin content koruması:** bir landing sayfası `seo_pages` içinde ancak
**≥3 yayınlanmış mekan** varsa `is_active=true` olur. Altındakiler 200 döner
(kullanıcı boş sayfa görmesin) ama `noindex` alır, sitemap'e girmez ve
"yakındaki mekanlar" gösterir. Eşik geçilince nightly job ile aktifleşir.

**Türkçe slug:** `ı→i, İ→i, ş→s, ğ→g, ü→u, ö→o, ç→c`
(`Beylikdüzü → beylikduzu`, `Şişli → sisli`). Tek `slugify()`, testli.
Mekan slug çakışmasında `-2` soneki.

**Her sayfada:** title · meta description · canonical · `og:*` +
`twitter:card` · dinamik OG görseli · `BreadcrumbList`.

**JSON-LD**
- Mekan detay → `EventVenue` + `LocalBusiness` (address, geo, photo,
  priceRange, aggregateRating — *yalnızca gerçek onaylı yorum varsa*)
- Landing → `ItemList` + `BreadcrumbList` + `FAQPage` (faq doluysa)
- Ana sayfa → `Organization` + `WebSite` (SearchAction)

**Sitemap:** index + `sitemap-static.xml`, `sitemap-landing.xml`,
`sitemap-venues.xml` (5.000'lik `generateSitemaps` dilimleri),
`lastmod` gerçek `updated_at`'ten.

---

## 11. Tasarım sistemi

Tailwind v4 `@theme` içinde tek semantik token seti:

    --brand-50 … --brand-900          /* ana renk, tek yerde değişir */
    --color-primary: var(--brand-600);
    --color-surface / --color-muted / --color-border
    --color-success / --color-danger

Component'lerde ham hex yok; `bg-primary`, `text-muted-foreground` kullanılır.
Yön: Airbnb sadeliği + sıcak nötr zemin, tek aksan renk, bol beyaz alan,
fotoğraf ön planda. Altın yaldız / script font yok.

Mobil: sticky "Filtrele", sticky "Teklif Al", swipeable galeri, tek elle
kullanılabilir formlar.
