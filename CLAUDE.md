@AGENTS.md

# Düğünce — geliştirme notları

Türkiye'de düğün, nişan, kına ve davet mekanlarını listeleyen marketplace.
Mimari kararların gerekçeleri için önce `docs/MIMARI.md` oku.

Kardeş ürün **DavetPro** (`~/Desktop/davet/davetpro`) ayrı bir veritabanı ve ayrı bir
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

## Yönetim paneli

- Admin işlemleri doğrudan UPDATE ile YAPILMAZ. `admin_*` fonksiyonları
  değişikliği ve `admin_actions` kaydını tek işlemde yazıyor; denetim izi
  uygulama katmanına bırakılırsa atlanabilir.
- Hepsi baştan `assert_admin()` çağırır — yetkisiz çağıran hata alır,
  sessizce boş sonuç değil.
- **Reddetme ve askıya alma gerekçesiz yapılamaz** (veritabanı zorluyor);
  mekan sahibi ne düzelteceğini bilmeli.
- **Mekan SİLİNMEZ, askıya alınır — tek istisnası geçmişi olmayan katalog
  kaydı** (0035). Toplu giriş yanlış kayıt üretebiliyor ("Turlar", "Kafe");
  onları askıda tutmak katalogda çöp biriktirmek olur. `admin_delete_venue`
  dört koşulu birden arıyor: sahipsiz + hiç yayınlanmamış + teklif talebi yok
  + yorumu yok. Biri bile tutmuyorsa askıya alma kullanılır. Karar
  veritabanında; liste `can_delete` ile bunu yansıtıyor, arayüz kural
  koymuyor. Silme denetim izine ad, slug, telefon ve place_id ile yazılıyor.
- Admin kendi rolünü ve hesap durumunu değiştiremez — son admin sistemden
  kilitlenmesin.
- **Taksonomide SİLME yok, `is_active = false` var.** Etkinlik türü veya
  özellik silmek `venue_event_types` / `venue_features` üzerinden cascade
  edip mekan sahibinin girdiği veriyi götürüyor. İlçede `is_active` bile
  yok — mekan ilçeye bağlı.
- **Taksonomi slug'ı ilk kayıtta üretilir, bir daha DEĞİŞMEZ.** Etkinlik
  türü slug'ı SEO landing adresinin, ilçe slug'ı mekan adresinin parçası;
  özellik slug'ı ise `venues.feature_slugs` okuma kopyasında duruyor.
  `admin_upsert_*` fonksiyonları güncellemede slug kolonuna dokunmuyor.
- İnceleme bekleyen mekan vitrinde görünmüyor; onaylayacak kişi mekanı
  `/yonetim/mekanlar/[id]` ekranından görüyor (`get_venue_for_edit` admin'e
  de açık).

## Test ortamı

`supabase/tests/supabase-stub.sql` GERÇEK Supabase tipleriyle hizalı olmak
zorunda. `auth.users.email` stub'da `text` iken gerçekte `varchar(255)`;
`returns table (... email text ...)` diyen fonksiyonlar testte geçip
üretimde "structure of query does not match function result type" ile
patladı. Yeni bir `auth` kolonu kullanırken tipini gerçeğiyle karşılaştır.

## Katalog kaydı ve sahiplenme

Strateji: yönetim katalogu kendisi doldurur → profil Google'a düşer →
işletme sahibi **sahiplenir** → talep almaya başlar.

- **`venues.owner_id` NULL olabilir** (0025). NULL = sahiplenilmemiş katalog
  kaydı. RLS bunu kendiliğinden doğru ele alıyor: `owner_id = auth.uid()`
  NULL sahiple hiçbir kullanıcıya eşleşmiyor, yani sahipsiz taslağı yalnızca
  admin görüyor ve düzenliyor.
- **Sahipliği yalnızca `admin_review_claim()` verir.** `guard_venue_update`
  ayrıcalıksız çağıranın `owner_id`'sini eski değere sabitliyor.
- **`owner_id`'ye bakan JOIN'ler LEFT olmalı.** `admin_list_venues` INNER
  JOIN'liyordu; sahipsiz kayıt yönetim listesinden tamamen düşüyordu ve
  katalog ekranı işlevsiz kalırdı. Testte bu senaryo var.
- **`business_categories` işletmenin NE OLDUĞU**, `venue_types` mekanın alt
  türü (salon/otel/kır). Karıştırma. `path_prefix` kategorinin adres alanı:
  bugün `/mekanlar/…`, ikinci kategoride `/fotografcilar/…`.
- **Planlanan kategoriler PASİF satır olarak duruyor** (0027: fotoğrafçı,
  gelinlik, organizasyon, saç & makyaj, müzik). Ana sayfadaki "Ne arıyorsun?"
  bloğunda "yakında" etiketiyle ve TIKLANAMAZ şekilde görünüyorlar — ölü
  bağlantı üretmiyoruz. Kategoriyi açmak için `is_active = true` yeter;
  liste component'e gömülü değil.
- Kategori seçimi ile etkinlik türü FARKLI katman: kategori işletmenin ne
  olduğu, etkinlik türü mekanın hangi organizasyona uygun olduğu. Ana
  sayfada ikisi ayrı başlık altında.
- Kategori varsayılanı `guard_venue_insert` içinde doldurulur — PostgreSQL
  DEFAULT'ta alt sorguya izin vermiyor.
- **Google Places dökümü (JSON dizisi) doğrudan yapıştırılabilir.** Yalnızca
  OLGU alanları okunur: ad, adres, telefon, koordinat, web sitesi, place_id,
  kategori. Google'ın editoryal açıklaması, kullanıcı yorumları ve fotoğraf
  adresleri BİLEREK alınmaz — telifleri bizde değil. Teste bağlı.
- **Apify'ın `url` alanı ARAMA adresidir**, mekan adresi değil; mekan
  referansı sorguda durur. `cleanMapsUrl()` sorguyu attığı için onda biri de
  aynı işe yaramaz adrese düşüyordu. JSON girdide adres `place_id`'den
  kuruluyor (`placeUrlFromId`).
- **Katalog girişinde mükerrer kayıt ÜÇ sinyalle yakalanır** (0028, 0029, 0032):
  aynı ilçede aynı ad (`slugify_tr()` ile, yazım farkı gizlemesin) VEYA ülke
  genelinde aynı telefon (`normalize_phone_tr()` ile). Farklı ilçede aynı ad
  serbest — zincir salon gerçek bir durum. İkisi de `p_force` ile geçilebilir;
  santral paylaşan mekanlar var, bu yüzden kısıt değil kontrol.
  Eskiden slug'a sessizce `-2` ekleniyordu ve kazara tekrar ekleme görünmezdi.
- **En güçlü sinyal `google_place_id`** (0032). İşletmenin Google'daki
  kanonik kimliği; ad farklı yazılabilir, telefon paylaşılabilir ama
  place_id birebir aynıdır. Google'ın şartları place_id'yi süresiz saklamaya
  AÇIKÇA izin veriyor — puan, yorum ve fotoğraf için aynı şey geçerli değil.
- **`venues.contact_phone_norm` üretilmiş kolondur**, uygulama ASLA yazmaz —
  `feature_slugs` gibi. `normalize_phone_tr()` `0212…`, `+90212…`, `(0212)…`
  yazımlarını 10 haneye indirger; tanımadığı biçimi olduğu gibi bırakır,
  uydurmaz.
- **Sahiplenme çağrısı oturum durumunu SUNUCUDAN sormaz.** Sormak çerez
  okumak, çerez okumak da mekan detayını dinamik yapıp statik üretimi
  öldürmek demek. Oturumsuz kullanıcı formu gönderince sunucu eylemindeki
  `requireUser(devam)` giriş sayfasına yönlendiriyor ve dönüşte mekana
  geri getiriyor.
- **`venues.district_id` hâlâ NOT NULL.** İlçesiz işletme ancak ikinci
  kategori gelince anlam kazanıyor; şimdi nullable yapmak vitrin
  sorgularını LEFT JOIN'e çevirir ve ilçesiz kaydın adresini tanımsız
  bırakır.

## Toplu katalog girişi

`/yonetim/mekanlar/toplu` — bir ilçedeki işletmeleri tek seferde açar.
Kaynak bağımsız: yapıştırılan satırlar Maps bağlantısı, ad ve telefon
içerebilir, **sırası önemli değil** (her parça içeriğine göre tanınır).

- **Önizleme adımı atlanamaz.** Kötü bir yapıştırma 50 çöp kayıt açar ve
  tek tek silmek açmaktan uzun sürer. Önizleme hiçbir şey YAZMAZ.
- **Her satır `admin_create_venue`'den geçer.** Toplu iş diye o kapıyı
  atlamak mükerrer kontrolünü ve denetim izini 50 katına çıkan bir hataya
  çevirirdi. Bir satırın hatası diğerlerini düşürmez, sebebiyle raporlanır.
- **Kısa bağlantı (`maps.app.goo.gl`) sunucuda çözülür** — ad ve koordinat
  ancak uzun adreste var. Sayfa içeriği OKUNMAZ, yalnızca yönlendirmenin
  bittiği adres. Eş zamanlılık 4, zaman aşımı 8 sn.
- **Ayrıştırıcı saf fonksiyon** (`lib/import/parse.ts`) ve kendi testi var
  (`npm run test:parse`) — ağ ve veritabanı olmadan koşuyor.
- **`"use server"` modülü YALNIZCA async fonksiyon dışa aktarabilir.**
  Sabit ya da tip koymak modülün tamamını derlenemez yapıyor ve `tsc` bunu
  GÖRMÜYOR — kural Next'in. Ortak tipler `lib/import/types.ts` içinde.

## İçe aktarma boru hattı

`lib/import/images.ts` + `lib/actions/import-run.ts` — bir işletmeyi kaydıyla
ve görselleriyle birlikte alan, KAYNAKTAN BAĞIMSIZ hat.

- **Kaynağın meşruluğuna bu katman karar VERMEZ.** "Şu adresteki dosyayı al
  ve kaydet" der; o adresi yayınlama hakkının bizde olup olmadığı çağıranın
  sorumluluğu. Meşru kaynaklar: işletmenin kendi verdiği galeri, tamamlama
  bağlantısından yüklenenler, izni alınmış site/hesap.
- **Yeni medya sistemi YOK.** Mevcut `venue-images` kovası, `{venueId}/…`
  yolu ve `venue_images` tablosu kullanılıyor; tarayıcıdan yüklenen fotoğrafla
  buradan gelen aynı yerde duruyor. `owns_storage_path` admin'e zaten izin
  veriyor, sahipsiz kayda yükleme çalışıyor.
- **Görsel hatası kaydı DÜŞÜRMEZ.** 8 görselin 2'si inse kayıt açılır, durum
  `partial` olur. Hiçbiri inmezse `needs_review` — kayıt var, galerisi boş.
- **Eleme ölçütleri:** 8 KB altı (ikon/izleme pikseli), 8 MB üstü, 400 px
  altı kenar, desteklenmeyen tür, içerik özeti eşleşen tekrar. Özet aynı
  zamanda Storage yolu — aynı dosya iki kez yüklenmiyor.
- **`source_url` TEKİL ve `p_force` ile bile geçilmez.** Aynı kaynak
  sayfasının iki kayıt üretmesi karar değil, veri hatası. (Zincir salonun
  aynı telefonu gerçek bir durum, o yüzden telefon force ile geçilebiliyor.)
  Kayıt silinirse adres yeniden işlenebilir — tekillik canlı satıra bakıyor.
- **Mükerrer sinyalleri güçlüden zayıfa:** kaynak adresi → place_id →
  ad+ilçe → telefon → web sitesi.
- **Sürücü ekranı `/yonetim/ice-aktarma/yeni`.** Satırları TEK TEK ve sırayla
  çalıştırıyor; toplu tek çağrı yapmamanın sebebi görseller — bir galerinin
  inmesi dakikalar sürebiliyor ve kullanıcının nerede olduğunu görmesi
  gerekiyor. Ekran kaynağın meşruluğunu denetleyemiyor; bunu açıkça yazıyor.
- **`admin_create_venue`'yi türetirken EN SON sürümü temel al.** 0037 bunu
  0032'den türetti, araya giren 0033'ün Google puanı yazımını sessizce
  düşürdü ve ikinci bir 15 parametreli aşırı yükleme üretip çağrıyı belirsiz
  bıraktı. 0038 düzeltti, test ikisini birden sabitliyor.

## Müşteri üyeliği YOK (bilinçli)

MVP'de yalnızca mekan sahibi ve admin hesabı var. Gerekçe: asıl huni
(keşif → detay → teklif talebi) baştan sona anonim çalışıyor ve her hesap
taşınması gereken bir yükümlülük (KVKK, parola sıfırlama, destek).

- **Kayıt yalnızca mekan sahibi için.** `/kayit` her zaman `venue_owner`
  oluşturur; `?tur=` parametresi artık davranışı değiştirmiyor.
- **Favoriler üyeliksiz**, `localStorage`'da. `/favorilerim` oturum
  gerektirmez ve middleware'in KORUMALI listesinde DEĞİLDİR.
- `customer` rolü, `favorites` ve `reviews` tabloları şemada duruyor —
  hiçbir maliyeti yok ve kapıyı açık tutuyor. Hesaba bağlı favori istenirse
  localStorage listesi oraya taşınır.
- **Yorum yazma arayüzü yok.** İleride açık kayıt yerine, teklif talebi
  göndermiş kişiye tek kullanımlık bağlantı ile — daha iyi spam koruması.

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

## Mekan düzenleme (wizard)

- Adımlar `VENUE_STEPS` (`lib/schemas/venue.ts`) içinde; sıra zorunlu değil,
  kullanıcı istediği adıma atlar. Her adım tek başına kaydedilir.
- **`stepCompletion()` yayın eşiği DEĞİL.** O yalnızca "bu adımda işin var mı"
  göstergesi. Yayın eşiği `venue_completion_of()` ile SQL'de (0002) ve
  `guard_venue_update` içinde (0003). İkisini karıştırma; eşik değişirse
  SQL tarafı değişir.
- **Slug yalnızca TASLAKKEN adla birlikte değişir.** Yayındaki mekanın
  adresini değiştirmek gelen bağlantıları ve SEO'yu kırar.
- Fotoğraf tarayıcıdan DOĞRUDAN Storage'a gider; server action yalnızca
  `venue_images` kaydını açar. Sunucudan geçirmek her dosyayı iki kez ağdan
  taşır ve server action gövde limitine takılır.
- Yükleme yolu MUTLAKA `{venueId}/…` ile başlar — Storage politikası (0007)
  yetkiyi ilk klasöre bakarak veriyor.
- Çoklu seçim (özellik/etkinlik) React state'te tutulup eyleme doğrudan
  geçirilir. FormData boş seçimde alanı hiç göndermiyor, "hepsini kaldır"
  kaybolurdu.

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
  çalışıyor (Düğünce onu kullanıyor), DavetPro `src/proxy.ts` kullanıyor.
  İkisi de `src/` içinde olmak zorunda — kökte durursa sessizce hiç çalışmaz.
- **Base UI `SelectValue` ham değeri basar.** Türkçe etiket için
  `<SelectValue>{(v) => ETIKET[v]}</SelectValue>` yaz; yoksa kullanıcı
  `fiyat-artan` ya da `REJECTED` görür.

## Marka adı

Ürünün adı **Düğünce**, alan adı `dugunce.com`. Görünen her yer
`SITE.name` (`lib/constants.ts`) üzerinden geliyor.

- **Ek alan kullanımları `SITE.ekli.*` sabitlerinden geçer.** Metne
  `{SITE.name}'nı` yazmak marka değişince sessizce bozuluyor: ek Türkçede
  son sesliye bağlı (DavetMekanı'nı → Düğünce'**yi**).
- **Entegrasyon kontratındaki `davetmekani` adları BİLEREK duruyor** — uç
  nokta yolu, `davetmekani_venue_id`, `iss` ve DavetPro'daki
  `leads.external_source`. Bunlar tanımlayıcı; sonuncusu kayıtlı veri.
  Gerekçe: `docs/DAVETPRO-ENTEGRASYON.md`.
- Depo dizini hâlâ `davetmekani`.

- **Logo `components/shared/wordmark.tsx` içinde satır içi SVG.** Kaynak
  dosyada renk sabit `#1E363D` idi; koyu zeminli yönetim kenar çubuğunda
  görünmez oluyordu. `currentColor`'a çevrildi — bulunduğu yerin metin
  rengini alıyor, tek varlık her zeminde çalışıyor. `<img>` ile bu mümkün
  değil. Ham dosya `public/logo.svg` (OG görseli, e-posta vb. için).

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

## Mekan özeti (otomatik metin)

Katalog kaydı açılır açılmaz detay sayfası dolu görünsün diye
`venue_auto_summary()` (0030/0031) yapılandırılmış veriden Türkçe tanıtım
metni üretiyor.

- **Yalnızca VAR OLAN veriden cümle kurulur.** Kuruluş yılı yok — yazılmaz.
  Müşteri memnuniyeti verisi yok — "misafirler memnun" denmez. Eksik alan
  cümleyi düşürür, uydurmaz.
- **`venues.description` kolonuna YAZILMAZ.** O kolon mekan sahibinin kendi
  anlatımı ve `venue_completion_of()` onu ölçüyor; otomatik metin tamamlanma
  oranını şişirmemeli. Vitrin `description` boşken özeti gösteriyor.
- **İlçe adına ek TAKILMAZ.** `tr_locative` ünlüyle biten ada kaynaştırma
  'n'si koymuyor ("Beylikdüzü'de" yanlış, doğrusu "Beylikdüzü'nde") ve bu
  kural algoritmik değil — sondaki ünlünün iyelik eki olup olmadığına bağlı.
  Bu yüzden kalıp `{şehir tamlayan} {ilçe} ilçesinde`: ek sabit "ilçe"
  sözcüğüne geliyor. Şehirdeki tamlayan eki (`tr_genitive`) ise algoritmik —
  ünlüyle bitene 'n' girer, istisnasız.
- **Para `tr_money()` ile yazılır.** `to_char`'ın `G` ayracı yerel ayara
  bakıp virgül basıyordu (1,250); Türkçede binlik ayracı nokta.
- **plpgsql'de `text[] || 'düz metin'` PATLAR** — literal `unknown` tipte
  kalıp dizi literali sanılıyor ("malformed array literal"). Düz metin
  eklerken `::text` cast'i şart.

## Google puanı (0033/0034)

Vitrinde **sayı** gösteriliyor: puan ve değerlendirme adedi. Yorum
METİNLERİ alınmıyor — sayı olgudur, yorum metni onu yazan kişinin eseridir.

- **Kendi `rating_avg`'imize KARIŞMAZ ve JSON-LD `aggregateRating`'e
  GİRMEZ.** Başkasının puanını kendi işaretlememizde göstermek Google'ın
  yapılandırılmış veri politikasına aykırı. Test bunu doğruluyor.
- **Kaynak ve okunma tarihi her zaman yazılır.**
- **Tazelik kararı SQL'de** (`venue_google_rating_fresh`, 90 gün). Bileşende
  `Date.now()` okumak PRERENDER edilen sayfada build anında donuyordu, puan
  hiç düşmüyordu — üstelik React'in saf render kuralına da aykırıydı (lint
  yakaladı). Sorgu bayat puanı null döndürüyor.
- `google_rating_at` olmadan `google_rating` yazılamaz (kısıt).

## Kaynağın yapılandırılmış olguları (0040/0041)

Bir kaynak (dugun.com dökümü gibi) yalnızca ad/telefon/adres değil; kapasite,
fiyat aralığı, iç/dış mekan ve özellik (şimdilik yalnızca otopark) gibi
ÖLÇÜLEBİLİR olgular da veriyor. `admin_create_venue` bunları katalog kaydı
açılırken tek işlemde yazıyor.

- **`description`'a ASLA yazılmaz.** Kaynağın pazarlama metni mekan
  sahibinin KENDİ anlatımı değil; `description` hâlâ yalnızca wizard'dan
  gelir ve `venue_completion_of()` onu ölçüyor. Kapasite/fiyat/iç-dış mekan
  yazılınca `venue_auto_summary()` zaten `description` boşken devreye
  giriyor — ayrıca metin taşımaya gerek yok. Test bunu doğruluyor.
- **`price_max` ayrı kolon.** `starting_price` tekil bir sayı ("…'den
  başlayan"); kaynak çoğu zaman ARALIK veriyor. `formatStartingPrice()`
  ikinci parametre verilince "₺75.000 – ₺95.000" biçiminde gösteriyor.
- **Özellik eşlemesi (`lib/import/dugun-com.ts`) BİLEREK dar.** Yalnızca
  `parking → otopark` yazılıyor; kaynağın verdiği diğer bayraklar (vale,
  klima, sahne...) şimdilik eşlenmiyor. Bilinmeyen/pasif slug `admin_create_venue`
  içinde sessizce atlanır, hata vermez — taksonomide karşılığı olmayan bir
  slug uydurmuyoruz.
- **`p_price_type` geçersizse sessizce `belirtilmemis`e düşer.** Enum dışı
  bir değer hataya değil, güvenli varsayılana gider.
- **Dönüştürücü saf fonksiyon** (`lib/import/dugun-com.ts`), kendi testi var
  (`npm run test:parse`). CLI sarmalayıcısı: `npm run donustur:dugun-com --
  girdi.json cikti.json` — Apify dataset export'unu sürücü ekranının
  (`/yonetim/ice-aktarma/yeni`) beklediği yüke çevirir, ağ/veritabanı yok.

## Teklif talepleri

- Talep doğrudan INSERT ile açılmaz; `create_inquiry()` RPC'si üzerinden.
  Hız sınırı için mevcut talepleri saymak gerekiyor ve anonim kullanıcıya
  `inquiries` üzerinde SELECT yetkisi verilmiyor.
- Sınırlar: saatte 3 talep / IP, günde 1 talep / mekan / IP.
- Formda bal küpü alanı (`website`) var; doluysa istek başarılı gibi
  cevaplanır ama kaydedilmez.
- **Sahiplenilmemiş mekana gelen talep admin'e Telegram'dan haber verir**
  (0045, `lib/telegram.ts`, `lib/actions/inquiry.ts`). İşletmeye otomatik
  mesaj ATILMAZ — izinsiz ticari ileti (SMS/WhatsApp/e-posta) KVKK/İYS
  mevzuatına aykırı. İlk temas admin tarafından KİŞİSEL olarak (arayarak)
  kurulur; bir kez onay alındıktan sonra otomatik bildirim serbest kalır.
  `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` boşsa bildirim sessizce atlanır,
  talep akışını hiç etkilemez — best-effort yan etki, ana akışı bloklamaz.

## SEO

- İndekslenen tek liste yüzeyi SEO landing sayfalarıdır
  (`/istanbul/dugun-mekanlari`). `/mekanlar?filtre=` her zaman `noindex,follow`.
- **Landing adresleri İÇ İÇE ve tek kaynaktan üretilir:** `lib/seo/paths.ts`
  → `landingPath()`. Şehir bir ad alanı: `/{sehir}/{etkinlik}-mekanlari`,
  ilçe bir alt segment. Bu formül daha önce beş yerde kopyalanmıştı; adres
  şeması değişince biri unutuluyor ve 404 üretiyordu. Ürettiği yol
  `seo_pages.path` ile BİREBİR aynı olmak zorunda — rota yol ayrıştırmıyor,
  tabloya bakıyor.
- **`sehir` sayfası ile `davet` etkinliğinin şehir sayfası aynı adres.**
  Bu yüzden şehir düzeyinde `davet` ÜRETİLMİYOR (0024). İlçe düzeyinde
  üretiliyor — orada çakışacak bir şey yok. Eskiden bunu
  `on conflict do nothing` sessizce hallediyordu.
- Bir landing sayfası en az 3 yayınlanmış mekan yoksa `is_active=false` olur:
  200 döner ama `noindex` alır ve sitemap'e girmez. Boş sayfa üretme.
- **Landing sayfası `searchParams` KULLANMAZ.** Kullanırsa Next rotayı
  dinamik sayar, `generateStaticParams` işlevsiz kalır ve ana SEO yüzeyimiz
  her istekte sunucuda render edilir. Sayfalama adresin parçası:
  `/istanbul/dugun-mekanlari/sayfa/2` — `noindex, follow` alır, kanoniği
  1. sayfadır.
- **Sayfalama catch-all'ın İÇİNDE çözülüyor** (`parseLandingSegments`).
  Next'te catch-all segmentinden sonra rota tanımlanamıyor, yani
  `/[...landing]/sayfa/[n]` diye bir dosya yazılamaz. Son iki segment
  `sayfa` + sayı ise ayrılıyor.
- **Kök catch-all statik rotaları YUTMAZ.** Next'te öncelik sırası
  statik > dinamik > catch-all; `/giris`, `/mekanlar`, `/panel` kendi
  rotalarına gidiyor. Yeni bir kök sayfa eklerken yine de kontrol et.
- **`get_seo_page` `SECURITY DEFINER` olmak zorunda.** RLS politikası
  anonim kullanıcıya yalnızca aktif sayfaları okutuyor; invoker olsaydı eşik
  altındaki sayfa `null` döner ve rota 404 verirdi (tasarım 200 + noindex).
- `refresh_seo_pages()` yalnızca YENİ satır ekler ve aktifliği eşiğe göre
  günceller — elle düzenlenmiş başlık ve metinleri EZMEZ.
- **`event_types.seo_noun` küçük harfle saklanır.** Cümle içinde doğrudan
  kullanılıyor ("İstanbul'da düğün için…"), başlıkta `tr_capitalize()` ile
  büyütülüyor. Ters yön Türkçede `İ→i` sorununu doğuruyor.
- Türkçe slug için tek fonksiyon: SQL'de `slugify_tr()`, JS'te
  `supabase/seed/apply.mjs → slugify()`. İkisi aynı sonucu vermeli.
- **Mekan detayı `generateStaticParams` OLMADAN önbelleğe ALINMIYOR.**
  `export const revalidate` tek başına yetmiyor; fonksiyon yoksa rota
  prerender-manifest'e girmiyor ve her istek sunucuda render ediliyor.
  Landing sayfaları ve mekan detayı iki SEO yüzeyimiz — build çıktısında
  ikisi de `●` olmalı, `ƒ` görürsen bir şey bozulmuş.
- **Vitrini değiştiren her eylem `revalidateVenuePage()` çağırır**
  (`lib/revalidate.ts`). ISR penceresi 1 saat; askıya alınan mekanın o süre
  boyunca yayında kalmaması buna bağlı.
- **Mekan sahibinin girdiği dış bağlantılar host beyaz listesinden geçer.**
  `google_maps_url` hem Zod'da (`isGoogleMapsUrl`) hem veritabanı kısıtında
  (0022) sınırlı; vitrin herkese açık, serbest bırakılırsa yönlendirme
  yüzeyine dönüşür. Google PUANI kendi `aggregateRating`'imize KARIŞMAZ.
- Sitemap elle yazıldı (`/sitemap.xml` indeks + 3 parça). Next'in
  `generateSitemaps` yardımcısı indeks üretmiyor, robots.txt ise tek adrese
  işaret etmeli.
