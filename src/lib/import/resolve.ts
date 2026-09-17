import "server-only";
import { parseMapsUrl } from "./parse";

/**
 * Kısa Maps bağlantısını (maps.app.goo.gl/…) çözer.
 *
 * Kısa bağlantıda ad ve koordinat YOK; yönlendirmeyi takip edip uzun adresi
 * almak gerekiyor. Yaptığımız şey kullanıcının verdiği bağlantıyı açmak —
 * sayfa içeriğini okumuyoruz, yalnızca yönlendirmenin bittiği adresi.
 */

const ZAMAN_ASIMI_MS = 8000;
/** Aynı anda kaç bağlantı çözülsün. Google'ı da kendimizi de yormayalım. */
const ES_ZAMANLI = 4;

export interface ResolvedUrl {
  url: string;
  finalUrl: string | null;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  hata: string | null;
}

export async function resolveMapsUrls(urls: string[]): Promise<Map<string, ResolvedUrl>> {
  const sonuc = new Map<string, ResolvedUrl>();
  const tekil = [...new Set(urls)];

  for (let i = 0; i < tekil.length; i += ES_ZAMANLI) {
    const dilim = tekil.slice(i, i + ES_ZAMANLI);
    const cozulenler = await Promise.all(dilim.map((u) => coz(u)));
    for (const c of cozulenler) sonuc.set(c.url, c);
  }
  return sonuc;
}

async function coz(url: string): Promise<ResolvedUrl> {
  // Uzun adreste ad ve koordinat zaten var; ağa çıkmaya gerek yok.
  const yerel = parseMapsUrl(url);
  if (yerel.name && yerel.latitude !== null) {
    return { url, finalUrl: url, ...yerel, hata: null };
  }

  const controller = new AbortController();
  const zamanlayici = setTimeout(() => controller.abort(), ZAMAN_ASIMI_MS);
  try {
    const r = await fetch(url, { redirect: "follow", signal: controller.signal });
    const finalUrl = r.url;
    const cozulmus = parseMapsUrl(finalUrl);
    return {
      url,
      finalUrl,
      ...cozulmus,
      hata:
        cozulmus.name || cozulmus.latitude !== null
          ? null
          : "Bağlantıdan ad ve konum okunamadı.",
    };
  } catch (e) {
    return {
      url,
      finalUrl: null,
      name: null,
      latitude: null,
      longitude: null,
      hata:
        (e as Error).name === "AbortError"
          ? "Bağlantı zaman aşımına uğradı."
          : "Bağlantı çözülemedi.",
    };
  } finally {
    clearTimeout(zamanlayici);
  }
}
