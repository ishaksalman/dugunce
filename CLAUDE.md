@AGENTS.md

# DavetMekanı — geliştirme notları

Türkiye'de düğün, nişan, kına ve davet mekanlarını listeleyen marketplace.
Mimari kararların gerekçeleri için önce `docs/MIMARI.md` oku.

Kardeş ürün **DavetPro** (`~/Desktop/davet/davetio`) ayrı bir veritabanı ve ayrı bir
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

## Veri erişimi

- Tek temas noktası `src/lib/db/source.ts` → `DataSource` arayüzü, tek
  uygulaması `supabase.ts`. Servis katmanı doğrudan Supabase istemcisi
  çağırmaz.
- Şema testleri (`npm run test:db`) PGlite üzerinde gerçek PostgreSQL
  çalıştırır ve migration'ların KENDİSİNİ sınar. Uygulama kodu oraya
  girmez — orası yetkilendirmenin doğrulandığı yer.
- Sorgu hatası yutulmaz. `?? []` ile devam etmek kullanıcıya "mekan yok"
  demektir; hata varsa `ErrorState` göster.
- **Herkese açık okumalar `createPublicClient()` (çerezsiz) kullanır.**
  Çerez okuyan istemci sayfayı dinamik yapıp statik üretimi/ISR'i öldürüyor —
  ana sayfa ve mekan detayı bizim SEO yüzeyimiz. Oturuma bağlı işler
  (talep oluşturma, favoriler, panel) `createClient()` kullanır.
- `src/lib/database.types.ts` elle yazıldı (Supabase CLI kurulu değil) ve
  yalnızca kullanılan tablo/fonksiyonları kapsıyor. Şema değişince güncelle.
  DİKKAT: `Row` tipleri `Simplify<>` ile sarılı — `interface`'lerin örtük
  index signature'ı olmadığı için supabase-js kısıtını geçemiyorlar ve
  istemci sessizce boş şemaya düşüp tüm RPC argümanlarını `undefined` yapıyor.
- **Zaman damgalarını sınırda normalize et.** PGlite `Date` nesnesi,
  PostgREST ISO string döndürüyor. `<time dateTime={...}>` içinde ham Date
  yerelleştirilmiş metne dönüşüp hydration uyuşmazlığı üretiyor. Yeni bir
  tarih alanı eklerken `normalizeReview` / `normalizeVenueDetail`
  (`types/db.ts`) içine de ekle.

## Bileşen kütüphanesi

shadcn/ui'ın güncel registry'si **Base UI** (Radix değil) üzerine kurulu.
Pratikte iki fark:

- `asChild` YOK, yerine `render` prop'u var: `render={<Link href="…" />}`.
- `render` ile `<a>` verildiğinde `nativeButton={false}` gerekir. Bunu her
  yerde tekrarlamayın — `ButtonLink` (`components/shared/button-link.tsx`)
  kullanın.

## Panel ve yetkilendirme

- `requireRole()` middleware'in yerine geçmez: middleware yalnızca oturum
  arar, rol kontrolü sayfa/layout içindedir. Her ikisi de nazik hata içindir;
  asıl kapı RLS.
- **Sahiplik koşulunu RPC'ye AÇIKÇA yaz.** `venues` politikası yayındaki
  mekanı herkese okutuyor; `get_owner_stats` / `get_owner_inquiries` gibi
  fonksiyonlarda `owner_id = auth.uid()` olmadan rakip verisi sızıyor.
  (Bu hata bir kez yapıldı, test yakaladı.)
- Panel sorguları çerez farkındalıklı `createClient()` kullanır —
  `createPublicClient()` anonim bağlanır ve `auth.uid()` null olur.
- Kullanıcı numaralandırmasına karşı: giriş hatası "e-posta yok" ile "parola
  yanlış" ayrımı yapmaz, parola sıfırlama her durumda aynı mesajı döner.
- `devam` / `next` yönlendirme parametreleri yalnızca `/` ile başlayan ve
  `//` ile başlamayan yolları kabul eder (açık yönlendirme engeli).

## DavetPro entegrasyonu

Kontrat: `docs/DAVETPRO-ENTEGRASYON.md`. İki depo arasındaki sözleşme orada;
bir tarafı değiştirirken önce orayı güncelle.

- **Aktarım kullanıcı akışını asla bloklamaz.** Talep her koşulda buraya
  kaydedilir; DavetPro'ya gönderim `davetpro_sync_jobs` kuyruğundan yürür.
- **Canlı gönderim ve geçmiş aktarımı AYNI kod yolunu kullanır**
  (`pushLeads` → `/api/integrations/davetmekani/leads`). İki ayrı yol
  yazılırsa biri bozulur ve fark edilmez.
- Idempotency anahtarı `inquiries.id` → DavetPro `leads.external_id`.
  Tekrar gönderim çift kayıt üretmez ve DavetPro tarafında yapılan çalışmayı
  (not, takip tarihi) ezmez.
- Mekan bağlandığında o mekanın **tüm geçmiş talepleri** kuyruğa girer.
- İmza: `HMAC-SHA256(secret, "${timestamp}.${ham gövde}")`, sabit zamanlı
  karşılaştırma, 5 dk replay penceresi. `signature.ts` iki depoda da var —
  birini değiştirirken diğerini unutma.
- **Entegrasyon uç noktaları middleware matcher'ından DIŞARIDA.** Oturumla
  değil imza/cron anahtarıyla kimlik doğruluyorlar; matcher'a girerlerse
  ya HTML yönlendirmesi alırlar ya da her istekte boşuna Supabase auth
  çağrısı yapılır.

## Bileşen tuzakları

- **`"use client"` modülünden sunucu bileşenine düz değer import etme.**
  RSC sınırında gerçek değer değil referans gelir; `Array.includes` gibi
  çağrılar çalışma zamanında patlar. Paylaşılan sabitler tarafsız bir
  modülde durur (ör. `lib/inquiry.ts`).
- **Next 16'da middleware'in yeni adı `proxy.ts`.** `middleware.ts` hâlâ
  çalışıyor (DavetMekanı onu kullanıyor), DavetPro `src/proxy.ts` kullanıyor.
  İkisi de `src/` içinde olmak zorunda — kökte durursa sessizce hiç çalışmaz.
- **Base UI `SelectValue` ham değeri basar.** Türkçe etiket için
  `<SelectValue>{(v) => ETIKET[v]}</SelectValue>` yaz; yoksa kullanıcı
  `fiyat-artan` ya da `REJECTED` görür.

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
- Filtre durumu URL query param'ında tutulur — paylaşılabilir ve geri tuşu
  çalışır. Filtre değişince `router.replace` (push değil): her dokunuş
  geçmişe kayıt eklememeli. Filtre değişimi her zaman `sayfa: 1`'e döner.
- Masaüstünde filtreler anında uygulanır; mobil drawer'da taslak tutulur ve
  "Sonuçları göster"e basınca uygulanır.
- Kartı tıklanabilir yapan `after:inset-0` katmanı, içindeki butonların
  (favori kalbi) üstünde kalır. Böyle butonlara `z-10` verin.
- **Sayfa ISR ile önbelleğe alınıyorsa sayaç sunucudan artırılamaz.**
  Görüntülenme `ViewTracker` → `POST /api/venues/[id]/view` beacon'ı ile
  sayılıyor; sunucu bileşenine taşınırsa yalnızca önbellek ıskaları sayılır.
- `.next/types` (üretim build çıktısı) bayatlarsa yeni rotalar `AppRoutes`
  tipinde görünmez ve `tsc` yanlış hata verir. Çözüm: `rm -rf .next/types`.

## Teklif talepleri

- Talep doğrudan INSERT ile açılmaz; `create_inquiry()` RPC'si üzerinden.
  Hız sınırı için mevcut talepleri saymak gerekiyor ve anonim kullanıcıya
  `inquiries` üzerinde SELECT yetkisi verilmiyor.
- Sınırlar: saatte 3 talep / IP, günde 1 talep / mekan / IP.
- Formda bal küpü alanı (`website`) var; doluysa istek başarılı gibi
  cevaplanır ama kaydedilmez.

## SEO

- İndekslenen tek liste yüzeyi SEO landing sayfalarıdır
  (`/istanbul-dugun-mekanlari`). `/mekanlar?filtre=` her zaman `noindex,follow`.
- Bir landing sayfası en az 3 yayınlanmış mekan yoksa `is_active=false` olur:
  200 döner ama `noindex` alır ve sitemap'e girmez. Boş sayfa üretme.
- Türkçe slug için tek fonksiyon: SQL'de `slugify_tr()`, JS'te
  `supabase/seed/apply.mjs → slugify()`. İkisi aynı sonucu vermeli.
