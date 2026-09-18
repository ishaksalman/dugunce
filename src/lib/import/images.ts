import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

/**
 * Bir adresten görsel alıp mekanın galerisine ekler.
 *
 * MEVCUT sistemi kullanıyor: `venue-images` kovası, `{venueId}/…` yolu ve
 * `venue_images` tablosu. Yeni bir medya sistemi kurulmuyor — tarayıcıdan
 * yüklenen fotoğrafla bu yoldan gelen fotoğraf aynı yerde duruyor.
 *
 * KAYNAK SORUMLULUĞU ÇAĞIRANDA. Bu modül "şu adresteki dosyayı al ve kaydet"
 * diyor; o adresi yayınlama hakkının bizde olup olmadığına karar vermiyor.
 * Meşru kaynaklar: işletmenin kendi verdiği galeri, tamamlama bağlantısından
 * yüklenenler, izni alınmış site/Instagram.
 */

const KOVA = "venue-images";

/** Tracking pixel ve ikonları elemek için. */
const EN_KUCUK_BAYT = 8 * 1024;
const EN_BUYUK_BAYT = 8 * 1024 * 1024;
/** Bir mekana en fazla — mevcut arayüzdeki sınırla aynı. */
export const EN_FAZLA_GORSEL = 30;

const IZINLI_TIP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export interface ImageIngestResult {
  url: string;
  ok: boolean;
  storagePath?: string;
  /** Neden alınmadı: kullanıcıya ve günlüğe aynı metin gidiyor. */
  hata?: string;
}

export interface IngestSummary {
  toplam: number;
  basarili: number;
  basarisiz: number;
  sonuclar: ImageIngestResult[];
  kapakAyarlandi: boolean;
}

function uzanti(contentType: string | null): string | null {
  if (!contentType) return null;
  return IZINLI_TIP[contentType.split(";")[0].trim().toLowerCase()] ?? null;
}

/**
 * PNG/JPEG/WebP başlığından boyut okur.
 *
 * Neden: 1×1 tracking pixel ve arayüz ikonları content-type olarak geçerli
 * görsel; ayıklamanın tek yolu boyuta bakmak. Tam bir çözücü gerekmiyor,
 * yalnızca ilk birkaç bayt.
 */
function olcu(buf: Buffer): { width: number; height: number } | null {
  // PNG: 8 bayt imza + IHDR
  if (buf.length > 24 && buf.toString("hex", 0, 8) === "89504e470d0a1a0a") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: SOF bloğunu ara
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const isaret = buf[i + 1];
      // SOF0..SOF15 (DHT, DAA, DRI hariç)
      if (isaret >= 0xc0 && isaret <= 0xcf && isaret !== 0xc4 && isaret !== 0xc8 && isaret !== 0xcc) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return null;
  }
  // WebP (VP8X)
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF"
      && buf.toString("ascii", 8, 12) === "WEBP"
      && buf.toString("ascii", 12, 16) === "VP8X") {
    return {
      width: 1 + buf.readUIntLE(24, 3),
      height: 1 + buf.readUIntLE(27, 3),
    };
  }
  return null;
}

const EN_KUCUK_KENAR = 400;

/**
 * Görselleri sırayla alır; biri düşerse diğerleri devam eder.
 *
 * Kısmi başarı bir hata değil: 8 görselin 2'si inse bile mekan açılıyor,
 * düşenler sebebiyle raporlanıyor. Kaydın tamamını çöpe atmak, elde olan
 * veriyi de kaybetmek olurdu.
 */
export async function ingestVenueImages(
  venueId: string,
  urls: string[],
): Promise<IngestSummary> {
  const supabase = await createClient();
  const sonuclar: ImageIngestResult[] = [];

  const { count, error: sayimHata } = await supabase
    .from("venue_images")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId);
  if (sayimHata) {
    return {
      toplam: urls.length, basarili: 0, basarisiz: urls.length,
      sonuclar: urls.map((url) => ({ url, ok: false, hata: "Galeri okunamadı." })),
      kapakAyarlandi: false,
    };
  }

  let sira = count ?? 0;
  const baslangictaBos = sira === 0;
  let kapakAyarlandi = false;

  // Aynı görsel farklı adreslerle gelebiliyor; içerik özetiyle eliyoruz.
  const gorulenOzet = new Set<string>();
  const tekilUrl = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];

  for (const url of tekilUrl) {
    if (sira >= EN_FAZLA_GORSEL) {
      sonuclar.push({ url, ok: false, hata: `En fazla ${EN_FAZLA_GORSEL} görsel.` });
      continue;
    }
    const sonuc = await tekGorsel(supabase, venueId, url, sira, gorulenOzet,
      baslangictaBos && !kapakAyarlandi);
    sonuclar.push(sonuc);
    if (sonuc.ok) {
      if (baslangictaBos && !kapakAyarlandi) kapakAyarlandi = true;
      sira += 1;
    }
  }

  const basarili = sonuclar.filter((s) => s.ok).length;
  return {
    toplam: tekilUrl.length,
    basarili,
    basarisiz: sonuclar.length - basarili,
    sonuclar,
    kapakAyarlandi,
  };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function tekGorsel(
  supabase: Supabase,
  venueId: string,
  url: string,
  sira: number,
  gorulenOzet: Set<string>,
  kapakOlsun: boolean,
): Promise<ImageIngestResult> {
  let buf: Buffer;
  let tip: string | null;

  try {
    const controller = new AbortController();
    const zaman = setTimeout(() => controller.abort(), 15000);
    const r = await fetch(url, { signal: controller.signal, redirect: "follow" });
    clearTimeout(zaman);

    if (!r.ok) return { url, ok: false, hata: `Sunucu ${r.status} döndü.` };
    tip = r.headers.get("content-type");
    const ham = await r.arrayBuffer();
    buf = Buffer.from(ham);
  } catch (e) {
    return {
      url, ok: false,
      hata: (e as Error).name === "AbortError" ? "Zaman aşımı." : "İndirilemedi.",
    };
  }

  const ext = uzanti(tip);
  if (!ext) return { url, ok: false, hata: `Desteklenmeyen tür (${tip ?? "bilinmiyor"}).` };
  if (buf.byteLength < EN_KUCUK_BAYT) {
    return { url, ok: false, hata: "Çok küçük (ikon veya izleme pikseli)." };
  }
  if (buf.byteLength > EN_BUYUK_BAYT) return { url, ok: false, hata: "Çok büyük (8 MB üstü)." };

  const boyut = olcu(buf);
  if (boyut && (boyut.width < EN_KUCUK_KENAR || boyut.height < EN_KUCUK_KENAR)) {
    return { url, ok: false, hata: `Çözünürlük düşük (${boyut.width}×${boyut.height}).` };
  }

  // İçerik özeti: aynı dosya farklı adresten gelirse ikinci kez yüklenmiyor.
  const ozet = createHash("sha256").update(buf).digest("hex").slice(0, 32);
  if (gorulenOzet.has(ozet)) return { url, ok: false, hata: "Aynı görsel zaten alındı." };

  const storagePath = `${venueId}/${ozet}.${ext}`;

  const { data: mevcut } = await supabase
    .from("venue_images")
    .select("id")
    .eq("venue_id", venueId)
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (mevcut) {
    gorulenOzet.add(ozet);
    return { url, ok: false, hata: "Bu görsel galeride zaten var." };
  }

  const { error: yuklemeHata } = await supabase.storage
    .from(KOVA)
    .upload(storagePath, buf, { contentType: tip ?? undefined, upsert: true });
  if (yuklemeHata) return { url, ok: false, hata: `Yüklenemedi: ${yuklemeHata.message}` };

  const { data: publicUrl } = supabase.storage.from(KOVA).getPublicUrl(storagePath);

  const { error: kayitHata } = await supabase.from("venue_images").insert({
    venue_id: venueId,
    storage_path: storagePath,
    url: publicUrl.publicUrl,
    width: boyut?.width ?? null,
    height: boyut?.height ?? null,
    sort_order: sira,
    // Galerideki ilk görsel kapak olur; yönetim sonra değiştirebilir.
    is_cover: kapakOlsun,
  });
  if (kayitHata) {
    // Storage'a yüklendi ama kayıt açılmadı: dosyayı bırakmıyoruz.
    await supabase.storage.from(KOVA).remove([storagePath]);
    return { url, ok: false, hata: "Kayıt açılamadı." };
  }

  gorulenOzet.add(ozet);
  return { url, ok: true, storagePath };
}
