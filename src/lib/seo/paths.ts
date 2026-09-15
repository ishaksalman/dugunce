/**
 * Landing sayfası adreslerinin TEK kaynağı.
 *
 * Bu formül daha önce beş ayrı yerde kopyalanmıştı (ana sayfa, footer, mekan
 * detayı, landing'in iç bağlantı blokları). Adres şeması değişince beşini de
 * bulmak gerekiyordu; biri unutulsa 404 üretiyordu.
 *
 * Şema — şehir bir AD ALANI, kategori onun altında:
 *
 *   /dugun-mekanlari                        etkinlik (ülke geneli)
 *   /istanbul/davet-mekanlari               şehir
 *   /istanbul/dugun-mekanlari               şehir × etkinlik
 *   /istanbul/beylikduzu/dugun-mekanlari    ilçe × etkinlik
 *
 * Kategori genişlediğinde (fotoğrafçı, gelinlik…) `/istanbul/fotografci`
 * doğal olarak buraya oturuyor.
 *
 * DİKKAT: ürettiği yol `seo_pages.path` ile birebir aynı olmak zorunda —
 * rota tabloya bakarak çözüyor, yol ayrıştırmıyor. SQL tarafı
 * `refresh_seo_pages()` (0024).
 */

export interface LandingTarget {
  citySlug?: string | null;
  districtSlug?: string | null;
  eventSlug?: string | null;
}

/** `seo_pages.path` biçimi — baştaki `/` YOK. */
export function landingPath({ citySlug, districtSlug, eventSlug }: LandingTarget): string {
  if (citySlug && districtSlug && eventSlug) {
    return `${citySlug}/${districtSlug}/${eventSlug}-mekanlari`;
  }
  if (citySlug && eventSlug) {
    // `davet` şehir düzeyinde ayrı üretilmiyor; şehir sayfası birebir aynı.
    return `${citySlug}/${eventSlug}-mekanlari`;
  }
  if (citySlug) return `${citySlug}/davet-mekanlari`;
  if (eventSlug) return `${eventSlug}-mekanlari`;
  throw new Error("landingPath: en az bir taksonomi gerekli");
}

/** Gezinebilir adres. `sayfa` 1'den büyükse sayfalama segmenti eklenir. */
export function landingHref(path: string, sayfa = 1): string {
  return sayfa > 1 ? `/${path}/sayfa/${sayfa}` : `/${path}`;
}

/** Kısayol: taksonomiden doğrudan adres. */
export function landingUrl(target: LandingTarget, sayfa = 1): string {
  return landingHref(landingPath(target), sayfa);
}

/**
 * Rota segmentlerini `{ path, sayfa }` olarak çözer.
 *
 * Sayfalama catch-all'ın İÇİNDE ele alınıyor: Next'te catch-all'dan sonra
 * segment tanımlanamıyor, yani `/[...landing]/sayfa/[n]` diye bir rota
 * yazılamıyor. Son iki segment `sayfa` + sayı ise onları ayırıyoruz.
 *
 * Geçersiz sayfa numarasında `sayfa: null` dönüyor — çağıran 404 versin.
 * `acik`, adreste sayfalama segmenti VAR demek: `/…/sayfa/1` kanonik adrese
 * yönlendirilsin diye gerekiyor, aynı içeriğin iki adresi olmasın.
 */
export function parseLandingSegments(
  segments: string[],
): { path: string; sayfa: number | null; acik: boolean } {
  const n = segments.length;
  if (n >= 3 && segments[n - 2] === "sayfa") {
    const ham = segments[n - 1];
    const sayfa = /^[0-9]+$/.test(ham) ? Number.parseInt(ham, 10) : NaN;
    return {
      path: segments.slice(0, n - 2).join("/"),
      sayfa: Number.isFinite(sayfa) && sayfa >= 1 && sayfa <= 500 ? sayfa : null,
      acik: true,
    };
  }
  return { path: segments.join("/"), sayfa: 1, acik: false };
}
