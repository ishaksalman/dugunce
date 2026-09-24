/**
 * dugun.com kazıyıcısının (Apify) çıktısını sürücü ekranının (`/yonetim/ice-aktarma/yeni`)
 * beklediği yük biçimine çevirir. Saf fonksiyon: ağ yok, veritabanı yok.
 *
 * Kaynağın meşruluğuna bu katman karar VERMEZ — o zaten çağıranın sorumluluğu
 * (bkz. lib/import/images.ts). Burada yalnızca alan eşlemesi var.
 *
 * BİLEREK ALINMAYAN alan: description / source_description. Kaynağın
 * pazarlama metni mekan sahibinin KENDİ anlatımı değil; description hâlâ
 * yalnızca wizard'dan gelir (bkz. CLAUDE.md, migration 0040). Kapasite,
 * fiyat, iç/dış mekan ve özellik gibi ÖLÇÜLEBİLİR olgular aktarılınca
 * venue_auto_summary() zaten description boşken devreye giriyor — ayrıca
 * metin taşımaya gerek yok.
 *
 * Özellik/hizmet eşlemesi: kazıyıcının verdiği her bayrak, mevcut
 * taksonomide (`supabase/seed/taksonomi.mjs` → OZELLIKLER) KARŞILIĞI OLAN
 * her yere yazılır (OZELLIK_ESLEME). Karşılığı olmayanlar (ör. dans pisti,
 * açık hava töreni) BİLEREK atlanır — var olmayan bir slug uydurmak yerine
 * boş bırakmak CLAUDE.md'nin "yalnızca var olan veriden" ilkesiyle tutarlı.
 * `alcohol` özel: yalnızca `true` iken "alkol-servisi" yazılır — `false`
 * "alkol yok" bir olgu ama karşılığı olan bir "alkolsüz" slug'ı yok, onu da
 * uydurmuyoruz.
 */

export interface DugunComImage {
  url: string;
  position?: number;
}

/** Kazıyıcının (main.js) `pushData()` ile yazdığı kayıt biçimi — yalnızca kullandığımız alanlar. */
export interface DugunComRecord {
  name?: unknown;
  city?: unknown;
  district?: unknown;
  category?: unknown;
  subcategory?: unknown;
  address?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  phone?: unknown;
  website?: unknown;
  instagram?: unknown;
  google_maps_url?: unknown;
  capacity_min?: unknown;
  capacity_max?: unknown;
  indoor?: unknown;
  outdoor?: unknown;
  food_service?: unknown;
  parking?: unknown;
  valet?: unknown;
  air_conditioning?: unknown;
  stage?: unknown;
  sound_system?: unknown;
  lighting?: unknown;
  catering?: unknown;
  alcohol?: unknown;
  accommodation?: unknown;
  bridal_room?: unknown;
  price?: unknown;
  price_min?: unknown;
  price_max?: unknown;
  price_label?: unknown;
  price_type?: unknown;
  source?: unknown;
  source_url?: unknown;
  scrape_status?: unknown;
  images?: unknown;
}

/** Kazınan özellik anahtarı → mevcut taksonomideki slug. Yalnızca `true` olanlar yazılır. */
const OZELLIK_ESLEME: Record<string, string> = {
  parking: "otopark",
  valet: "vale",
  air_conditioning: "klima",
  stage: "sahne",
  sound_system: "ses-sistemi",
  lighting: "isiklandirma",
  bridal_room: "gelin-odasi",
  catering: "catering",
  accommodation: "konaklama",
  food_service: "yemekli",
};

/** dugun.com'un fiyat tipi → veritabanındaki price_type enum'u. Karşılığı yoksa "belirtilmemis". */
const FIYAT_TIPI_ESLEME: Record<string, string> = {
  per_person: "kisi_basi",
  package: "paket",
};

/**
 * Türkçe karakterleri sadeleştirir — yalnızca anahtar kelime aramak için,
 * gerçek bir slug üretmiyor. `lib/slug.ts`'teki `slugifyTr`'ı BİLEREK
 * kullanmıyoruz: bu dosya standalone Node ile de çalışıyor
 * (`npm run test:parse`, tip sıyırma bayrağıyla, bundler yok) ve o dosya
 * `@/` takma adıyla import ediliyor — orada çözülmüyor. Aynı sebep
 * `lib/slug.ts`'te de yazılı: üç ayrı ortam, üç ayrı kopya.
 */
const TR_HARF: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
  Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u",
};
function sadeMetin(v: string): string {
  return v.replace(/[çğıöşüÇĞİIÖŞÜ]/g, (c) => TR_HARF[c] ?? c).toLowerCase();
}

/**
 * Kategori/alt kategori metninden ("Düğün Salonları İstanbul") etkinlik
 * türü çıkarımı. Kazıyıcı ayrı bir etkinlik türü alanı vermiyor — dugun.com
 * kategori sayfası hangi listedeyse metin onu söylüyor. Karşılığı yoksa boş
 * bırakılır, tahmin yürütülmez.
 *
 * "dugun" tek başına yeterli değil: dugun.com'un "Düğün Mekanları" ağacının
 * bazı alt kategorileri metinde "düğün" kelimesini HİÇ geçirmiyor —
 * "Tarihi Mekanlar", "Sosyal Tesisler", "Balo ve Davet Salonları", "Nikah
 * Salonları" — ama hepsi aynı ağacın altında, dugun.com'un kendi menüsünde
 * "İstanbul Düğün Mekanları" başlığı altında listeleniyor. Bunlar BİLEREK
 * ayrı satırlar: genel bir "eşleşme yoksa dugun say" varsayımı yerine, her
 * biri gerçekte görülmüş bir kategori metni (bkz. 0047/0051 içe aktarma
 * turları). Yeni bir alt kategori taranırsa ve burada karşılığı yoksa boş
 * kalır — tahmin yürütülmez, elle eklenir.
 */
const ETKINLIK_ANAHTAR: [string, string][] = [
  ["dugun", "dugun"],
  ["nisan", "nisan"],
  ["kina", "kina"],
  ["tarihi mekan", "dugun"],
  ["sosyal tesis", "dugun"],
  ["balo ve davet", "dugun"],
  ["nikah salon", "dugun"],
];

function etkinlikTurleri(kategori: string | null, altKategori: string | null): string[] {
  const metin = sadeMetin(`${kategori ?? ""} ${altKategori ?? ""}`);
  const bulunan = ETKINLIK_ANAHTAR
    .filter(([anahtar]) => metin.includes(anahtar))
    .map(([, slug]) => slug);
  return [...new Set(bulunan)];
}

/**
 * Kategori/alt kategori metninden MEKAN TÜRÜ çıkarımı — dugun.com'un kendi
 * alt kategori sayfaları (`/dugun-salonlari`, `/kir-dugunu-mekanlari`,
 * `/otel-dugunleri`, `/tekne-dugunleri`...) bizim taksonomimizdeki fiziksel
 * türlerle (`supabase/seed/taksonomi.mjs` → MEKAN_TURLERI) BİREBİR örtüşüyor.
 * Etkinlik türünden farklı olarak bu TEKİL bir seçim — dugun.com her mekanı
 * kendi sistemine göre tek bir alt kategoriye koyuyor, biz de ona güveniyoruz.
 *
 * Sıra ÖNEMLİ: "dugun salon" bileşik ifadesi aranıyor, tek başına "salon"
 * değil — "Nikah Salonları" ve "Balo ve Davet Salonları" da "salon"
 * geçiriyor ama farklı fiziksel türler (birinin taksonomimizde karşılığı
 * yok, "Nikah Salonu" var olmayan bir slug — uydurulmuyor, boş bırakılıyor).
 * Karşılığı olmayan bir kategori (ör. "Sosyal Tesisler", "Tarihi Mekanlar")
 * BİLEREK boş bırakılır, en yakın türe tahminen atanmaz.
 */
const MEKAN_TURU_ANAHTAR: [string, string][] = [
  ["kir dugun", "kir-bahcesi"],
  ["otel", "otel"],
  ["tekne", "tekne"],
  ["balo ve davet salon", "balo-salonu"],
  ["dugun salon", "dugun-salonu"],
];

function mekanTuru(kategori: string | null, altKategori: string | null): string | null {
  const metin = sadeMetin(`${kategori ?? ""} ${altKategori ?? ""}`);
  return MEKAN_TURU_ANAHTAR.find(([anahtar]) => metin.includes(anahtar))?.[1] ?? null;
}

function metin(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function sayi(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export interface DugunComConvertResult {
  /** `/yonetim/ice-aktarma/yeni` ekranına doğrudan yapıştırılabilecek JSON dizisi. */
  rows: Record<string, unknown>[];
  /** `scrape_status !== "success"` olduğu için atlanan kayıt sayısı. */
  atlanan: number;
}

/**
 * Kazıyıcı çıktısını (bir dizi) sürücü ekranı yüküne çevirir.
 *
 * Yalnızca `scrape_status === "success"` olan kayıtlar alınır — "failed"
 * zaten boş, "needs_review"/"partial" görsel eksikliği anlamına geliyor
 * ama olgular yine de doğru olabilir; onlar da geçer, yalnızca `failed`
 * ve tamamen boş kayıtlar (ad yok) atlanır.
 */
export function dugunComToPayload(records: unknown[]): DugunComConvertResult {
  let atlanan = 0;
  const rows: Record<string, unknown>[] = [];

  for (const raw of records) {
    const r = (raw ?? {}) as DugunComRecord;
    const name = metin(r.name);
    const status = metin(r.scrape_status);

    if (!name || status === "failed") {
      atlanan += 1;
      continue;
    }

    const featureSlugs = Object.entries(OZELLIK_ESLEME)
      .filter(([kazinanAlan]) => r[kazinanAlan as keyof DugunComRecord] === true)
      .map(([, slug]) => slug);
    if (r.alcohol === true) featureSlugs.push("alkol-servisi");

    const eventTypeSlugs = etkinlikTurleri(metin(r.category), metin(r.subcategory));
    const venueTypeSlug = mekanTuru(metin(r.category), metin(r.subcategory));

    const images = Array.isArray(r.images) ? (r.images as DugunComImage[]) : [];
    const imageUrls = [...new Set(
      images.map((i) => (i && typeof i === "object" ? metin(i.url) : null)).filter((u): u is string => u !== null),
    )];

    // Kaynağın metin içinden fiyat çıkarımı bazen "2026 Kış Düğünlerine
    // Özel..." gibi bir YIL'ı da sayı sanıp min/max aralığına sokuyor
    // ("price_min: 2026, price_max: 190000" → sanki 2.026 TL'den başlıyor).
    // Genel bir güvenlik kontrolü: gerçek bir kişi başı/toplam aralığında
    // max, min'in birkaç katını geçmez; 10 kattan fazla fark varsa aralık
    // GÜVENİLMEZ sayılıp yerine kaynağın hesapladığı tekil `price` kullanılır.
    const priceMinRaw = sayi(r.price_min);
    const priceMaxRaw0 = sayi(r.price_max);
    const aralikGecersiz =
      priceMinRaw !== null && priceMaxRaw0 !== null &&
      priceMinRaw > 0 && priceMaxRaw0 / priceMinRaw > 10;

    const startingPrice = aralikGecersiz ? sayi(r.price) : (priceMinRaw ?? sayi(r.price));
    const priceMaxRaw = aralikGecersiz ? null : priceMaxRaw0;

    // Kaynağın price_type tespiti güvenilmiyor: "900 - 1050 TRY" gibi bir
    // aralık "range" olarak işaretleniyor ama bir düğün mekanı için bu tutar
    // toplam kiralama OLAMAZ — bu, kişi başı menü fiyatı. Bu eşiğin altı
    // her zaman kişi başı sayılıyor; kaynağın etiketi ne derse desin.
    const KISI_BASI_ESIK = 5000;
    const priceTypeHam = metin(r.price_type);
    const priceType =
      startingPrice !== null && startingPrice < KISI_BASI_ESIK
        ? "kisi_basi"
        : priceTypeHam
          ? (FIYAT_TIPI_ESLEME[priceTypeHam] ?? "belirtilmemis")
          : null;

    rows.push({
      name,
      sourceUrl: metin(r.source_url),
      // Telefon BİLEREK alınmıyor — kaynağın numarası yerine mevcut/doğrulanmış
      // kaynaklar (ör. Google Places) tercih ediliyor.
      address: metin(r.address),
      // Sürücü ekranı bunu yazmıyor, yalnızca ilçe seçimini OTOMATİK eşlemek
      // için kullanıyor (bkz. import-runner.tsx) — bir şehirde onlarca farklı
      // ilçeye yayılan kayıtlarda ilçeyi elle tek tek seçmek zorunda kalmamak
      // için. Eşleşme bulunamazsa admin elle seçiyor; yanlış tahmin YAZILMAZ.
      district: metin(r.district),
      website: metin(r.website),
      instagram: metin(r.instagram),
      mapsUrl: metin(r.google_maps_url),
      latitude: sayi(r.latitude),
      longitude: sayi(r.longitude),
      imageUrls,
      minCapacity: sayi(r.capacity_min),
      maxCapacity: sayi(r.capacity_max),
      startingPrice,
      priceMax: priceMaxRaw,
      priceType,
      // price_label BİLEREK alınmıyor — dugun.com'un kendi kampanya/indirim
      // metni ("… %30 İndirimle Sadece 980₺!"), bizim olgu vitrinimize değil.
      hasIndoor: r.indoor === true ? true : r.indoor === false ? false : null,
      hasOutdoor: r.outdoor === true ? true : r.outdoor === false ? false : null,
      featureSlugs,
      eventTypeSlugs,
      venueTypeSlug,
    });
  }

  return { rows, atlanan };
}
