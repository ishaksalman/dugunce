/**
 * Toplu katalog girişi — satır ayrıştırma.
 *
 * Yönetim Maps'te ilçe ilçe geziyor, bulduğu salonların bağlantılarını bir
 * nota biriktiriyor. Bu modül o notu kayda çevirilebilir satırlara ayırıyor.
 *
 * Saf fonksiyon: ağ yok, veritabanı yok. Bağlantı çözme ve mükerrer kontrolü
 * çağıran tarafta — böylece ayrıştırma mantığı tek başına sınanabiliyor.
 *
 * Satır biçimi (alanlar `;` ile ayrılır — Türkçe adreslerde virgül var):
 *
 *   https://maps.app.goo.gl/xxx
 *   Bahçe Davet; 0212 111 22 33
 *   Bahçe Davet; 0212 111 22 33; https://maps.app.goo.gl/xxx
 *
 * Alan sırası ÖNEMLİ DEĞİL: her parça içeriğine göre tanınıyor. Yapıştırırken
 * sıra tutturmaya çalışmak, elle giriş kadar yavaşlatırdı.
 */

export interface ParsedRow {
  /** Kaynak satır — önizlemede kullanıcıya geri gösteriliyor. */
  ham: string;
  satirNo: number;
  name: string | null;
  phone: string | null;
  mapsUrl: string | null;
  /** Aşağıdakiler yalnızca JSON girdide dolu. */
  address: string | null;
  website: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Google'daki ana kategori — düğün mekanı olmayanları ayıklamak için. */
  kategori: string | null;
  kategoriler: string[];
  kapali: boolean;
  /** Ayrıştırma sırasında fark edilen sorun; satır yine de gösterilir. */
  hata: string | null;
}

const BOS_SATIR = {
  address: null, website: null, placeId: null,
  latitude: null, longitude: null,
  kategori: null, kategoriler: [] as string[], kapali: false,
};

const MAPS_HOST =
  /^https:\/\/((www\.)?google\.[a-z.]{2,6}\/maps|maps\.google\.[a-z.]{2,6}\/|maps\.app\.goo\.gl\/|goo\.gl\/maps\/)/i;

/** En az 7 rakam içeren, harf içermeyen parça telefon sayılıyor. */
function telefonMu(parca: string): boolean {
  if (/[a-zçğıöşü]/i.test(parca)) return false;
  return (parca.match(/[0-9]/g) ?? []).length >= 7;
}

export function isMapsUrl(value: string): boolean {
  return MAPS_HOST.test(value.trim());
}

/**
 * Google Maps adresinden ad ve koordinat çıkarır.
 *
 * `/place/{ad}/…` ad, `data=…!3d{enlem}!4d{boylam}` ise MEKANIN konumu.
 * `@41.08,28.42,10z` kısmı haritanın ortası — mekanın konumu DEĞİL, o yüzden
 * kullanılmıyor. Kısa bağlantıda ikisi de yok; önce çözülmesi gerekiyor.
 */
export function parseMapsUrl(url: string): {
  name: string | null;
  latitude: number | null;
  longitude: number | null;
} {
  let name: string | null = null;
  const placePart = url.split("/place/")[1];
  if (placePart) {
    const ham = placePart.split("/")[0].split("?")[0];
    try {
      const cozulmus = decodeURIComponent(ham).replace(/\+/g, " ").trim();
      if (cozulmus.length >= 2) name = cozulmus;
    } catch {
      // Bozuk yüzde kodlaması: adı boş bırak, satır elle doldurulur.
    }
  }

  const koordinat = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const latitude = koordinat ? Number(koordinat[1]) : null;
  const longitude = koordinat ? Number(koordinat[2]) : null;

  return {
    name,
    latitude: latitude !== null && Math.abs(latitude) <= 90 ? latitude : null,
    longitude: longitude !== null && Math.abs(longitude) <= 180 ? longitude : null,
  };
}

/**
 * Temizlenmiş Maps adresi: oturum ve izleme parametreleri atılır.
 *
 * DİKKAT: yalnızca `/place/…` ve kısa bağlantılarda güvenli. Arama
 * adreslerinde (`/maps/search/?api=1&query=…`) mekan referansı SORGUDA
 * duruyor; orada sorguyu atmak adresi anlamsız kılar. JSON girdide
 * `placeUrlFromId()` kullanılıyor.
 */
export function cleanMapsUrl(url: string): string {
  return url.split("?")[0];
}

/** Place ID'den kanonik mekan adresi. Kısa, kalıcı ve host kısıtını geçiyor. */
export function placeUrlFromId(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

export function parseBulkInput(metin: string, enFazla = 50): {
  rows: ParsedRow[];
  fazlalik: number;
} {
  const satirlar = metin
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("#"));

  const fazlalik = Math.max(0, satirlar.length - enFazla);

  const rows = satirlar.slice(0, enFazla).map((ham, i): ParsedRow => {
    const parcalar = ham.split(";").map((p) => p.trim()).filter(Boolean);

    let name: string | null = null;
    let phone: string | null = null;
    let mapsUrl: string | null = null;
    let hata: string | null = null;

    for (const parca of parcalar) {
      if (/^https?:\/\//i.test(parca)) {
        if (isMapsUrl(parca)) {
          mapsUrl = cleanMapsUrl(parca);
        } else {
          hata = "Yalnızca Google Maps bağlantısı kabul ediliyor.";
        }
      } else if (telefonMu(parca)) {
        phone = parca;
      } else if (name === null) {
        name = parca;
      }
    }

    if (!name && !mapsUrl) {
      hata = hata ?? "Ad ya da Google Maps bağlantısı gerekli.";
    }

    return { ham, satirNo: i + 1, name, phone, mapsUrl, ...BOS_SATIR, hata };
  });

  return { rows, fazlalik };
}

/**
 * Google Places dökümünden (Apify vb.) gelen JSON dizisi.
 *
 * Yalnızca OLGU alanları okunuyor: ad, adres, telefon, koordinat, web sitesi,
 * place_id ve kategori. Google'ın editoryal açıklaması, kullanıcı yorumları
 * ve fotoğraf adresleri BİLEREK alınmıyor — onların telifi bizde değil ve
 * kendi özet metnimiz zaten yapılandırılmış veriden üretiliyor.
 *
 * `city` alanı ilçe adını taşıyor, `state` ili. Apify'ın adlandırması bu.
 */
interface PlacesKaydi {
  title?: unknown;
  address?: unknown;
  phone?: unknown;
  website?: unknown;
  placeId?: unknown;
  url?: unknown;
  categoryName?: unknown;
  categories?: unknown;
  permanentlyClosed?: unknown;
  temporarilyClosed?: unknown;
  location?: unknown;
}

function metin(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export function parsePlacesJson(ham: string, enFazla = 50): {
  rows: ParsedRow[];
  fazlalik: number;
  hata: string | null;
} {
  let veri: unknown;
  try {
    veri = JSON.parse(ham);
  } catch {
    return { rows: [], fazlalik: 0, hata: "JSON okunamadı." };
  }
  if (!Array.isArray(veri)) {
    return { rows: [], fazlalik: 0, hata: "JSON bir dizi olmalı." };
  }

  const fazlalik = Math.max(0, veri.length - enFazla);
  const rows = veri.slice(0, enFazla).map((x, i): ParsedRow => {
    const r = (x ?? {}) as PlacesKaydi;
    const konum = (r.location ?? {}) as { lat?: unknown; lng?: unknown };
    const lat = typeof konum.lat === "number" ? konum.lat : null;
    const lng = typeof konum.lng === "number" ? konum.lng : null;
    const name = metin(r.title);
    const placeId = metin(r.placeId);
    const url = metin(r.url);
    // Apify'ın `url`'i bir ARAMA adresi; mekan referansı sorguda. Kanonik
    // adresi place_id'den kuruyoruz — hem kısa hem kalıcı.
    const mapsUrl = placeId
      ? placeUrlFromId(placeId)
      : url && isMapsUrl(url)
        ? url
        : null;

    const kapali =
      r.permanentlyClosed === true || r.temporarilyClosed === true;

    return {
      ham: name ?? `#${i + 1}`,
      satirNo: i + 1,
      name,
      phone: metin(r.phone),
      mapsUrl,
      address: metin(r.address),
      website: metin(r.website),
      placeId,
      latitude: lat !== null && Math.abs(lat) <= 90 ? lat : null,
      longitude: lng !== null && Math.abs(lng) <= 180 ? lng : null,
      kategori: metin(r.categoryName),
      kategoriler: Array.isArray(r.categories)
        ? r.categories.filter((c): c is string => typeof c === "string")
        : [],
      kapali,
      hata: !name
        ? "Ad okunamadı."
        : kapali
          ? "Google'da kapalı görünüyor."
          : null,
    };
  });

  return { rows, fazlalik, hata: null };
}

/** Girdi JSON mu, satır listesi mi? */
export function jsonMu(metin: string): boolean {
  return metin.trim().startsWith("[");
}
