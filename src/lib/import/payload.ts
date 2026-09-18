/**
 * Sürücü ekranının girdisi — kaynaktan bağımsız aktarım yükü.
 *
 * Saf fonksiyon: ağ yok, veritabanı yok. Girdinin nereden geldiğini
 * bilmiyor; yalnızca biçimini doğruluyor.
 *
 * Beklenen biçim — bir dizi:
 *
 *   [
 *     {
 *       "name": "Bahçe Davet",              // ZORUNLU
 *       "sourceUrl": "https://…/isletme/12", // devam etmeyi sağlıyor
 *       "phone": "0212 111 22 33",
 *       "address": "…",
 *       "website": "https://…",
 *       "placeId": "ChIJ…",
 *       "mapsUrl": "https://www.google.com/maps/place/…",
 *       "latitude": 41.0003,
 *       "longitude": 28.6450,
 *       "imageUrls": ["https://…/1.jpg", "https://…/2.jpg"]
 *     }
 *   ]
 *
 * Bilinmeyen alanlar sessizce yok sayılıyor: kaynak ne üretirse üretsin
 * fazlalık taşımaya çalışmıyoruz.
 */

export interface PayloadRow {
  satirNo: number;
  name: string | null;
  sourceUrl: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  placeId: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrls: string[];
  /** Ayrıştırma sırasında fark edilen sorun. */
  hata: string | null;
  /** Kaynak adresi daha önce işlenmiş mi — sunucudan doldurulur. */
  islenmis?: boolean;
}

function metin(v: unknown, enFazla = 300): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t.slice(0, enFazla);
}

function sayi(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v >= min && v <= max ? v : null;
}

/** http(s) adresi olmayanı eliyoruz — indirilecek şey bir adres olmalı. */
function adresMi(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v.trim());
}

export function parseImportPayload(
  ham: string,
  enFazla = 50,
): { rows: PayloadRow[]; fazlalik: number; hata: string | null } {
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
  const rows = veri.slice(0, enFazla).map((x, i): PayloadRow => {
    const r = (x ?? {}) as Record<string, unknown>;
    const name = metin(r.name, 120);

    const hamGorseller = Array.isArray(r.imageUrls) ? r.imageUrls : [];
    // Tekrarlayan adresi burada da eliyoruz; sunucu içerik özetiyle ikinci
    // kez eliyor ama boşuna indirmeye gerek yok.
    const imageUrls = [
      ...new Set(
        hamGorseller
          .filter(adresMi)
          .map((u) => u.trim().slice(0, 1000)),
      ),
    ].slice(0, 40);

    const gecersizGorsel = hamGorseller.length - imageUrls.length;

    return {
      satirNo: i + 1,
      name,
      sourceUrl: metin(r.sourceUrl, 600),
      phone: metin(r.phone, 20),
      address: metin(r.address, 300),
      website: metin(r.website, 300),
      placeId: metin(r.placeId, 120),
      mapsUrl: metin(r.mapsUrl, 600),
      latitude: sayi(r.latitude, -90, 90),
      longitude: sayi(r.longitude, -180, 180),
      imageUrls,
      hata: !name
        ? "İşletme adı gerekli."
        : gecersizGorsel > 0
          ? `${gecersizGorsel} görsel adresi geçersiz, atlandı.`
          : null,
    };
  });

  return { rows, fazlalik, hata: null };
}

/** Örnek yük — ekranda yer tutucu olarak gösteriliyor. */
export const ORNEK_YUK = `[
  {
    "name": "Örnek Davet Bahçesi",
    "sourceUrl": "https://ornek.com/isletme/12",
    "phone": "0212 111 22 33",
    "address": "Örnek Mah. Örnek Cd. No:1, Beylikdüzü/İstanbul",
    "website": "https://ornek.com",
    "latitude": 41.0003,
    "longitude": 28.645,
    "imageUrls": [
      "https://ornek.com/galeri/1.jpg",
      "https://ornek.com/galeri/2.jpg"
    ]
  }
]`;
