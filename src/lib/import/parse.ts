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
  /** Ayrıştırma sırasında fark edilen sorun; satır yine de gösterilir. */
  hata: string | null;
}

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

/** Temizlenmiş Maps adresi: oturum ve izleme parametreleri atılır. */
export function cleanMapsUrl(url: string): string {
  return url.split("?")[0];
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

    return { ham, satirNo: i + 1, name, phone, mapsUrl, hata };
  });

  return { rows, fazlalik };
}
