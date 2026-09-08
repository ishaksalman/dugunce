/**
 * Listeleme filtrelerinin tek kaynağı.
 *
 * URL query param'ı ⇄ tipli filtre nesnesi dönüşümü burada. Aynı şema hem
 * sunucu bileşeninde (searchParams) hem `/api/venues` içinde kullanılıyor,
 * böylece iki yerde iki farklı doğrulama olmuyor.
 */
import { z } from "zod";
import { PAGINATION, SORT_OPTIONS } from "@/lib/constants";

const SORT_VALUES = SORT_OPTIONS.map((o) => o.value) as [string, ...string[]];

/** "a,b,c" → ["a","b","c"] ; boş değerler atılır. */
const csv = z
  .string()
  .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(z.string().regex(/^[a-z0-9-]+$/)).max(30));

const slug = z.string().regex(/^[a-z0-9-]+$/).max(80);

const positiveInt = z.coerce.number().int().positive().max(1_000_000);

/**
 * `z.coerce.boolean()` KULLANILMAZ: Boolean("false") === true olduğu için
 * elle düzenlenmiş `?kapali=false` bağlantısı filtreyi açar.
 */
const flag = z
  .enum(["1", "0", "true", "false"])
  .transform((v) => v === "1" || v === "true");

/**
 * `.nullish()` yerine `.optional()` kullanılıyor: bu şema URL'den okunuyor,
 * form gönderiminden değil — ikinci kez parse edilmesi söz konusu değil.
 */
export const filtersSchema = z.object({
  sehir: slug.optional(),
  ilce: slug.optional(),
  etkinlik: slug.optional(),
  tur: slug.optional(),
  kisi: positiveInt.optional(),
  minKapasite: positiveInt.optional(),
  maxKapasite: positiveInt.optional(),
  minFiyat: z.coerce.number().nonnegative().max(100_000_000).optional(),
  maxFiyat: z.coerce.number().nonnegative().max(100_000_000).optional(),
  kapali: flag.optional(),
  acik: flag.optional(),
  ozellikler: csv.optional(),
  q: z.string().trim().min(2).max(80).optional(),
  siralama: z.enum(SORT_VALUES).default("onerilen"),
  sayfa: z.coerce.number().int().positive().max(500).default(1),
});

export type VenueFilters = z.infer<typeof filtersSchema>;

/** Next.js searchParams → filtreler. Geçersiz değerler sessizce düşer. */
export function parseFilters(
  searchParams: Record<string, string | string[] | undefined>,
): VenueFilters {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v !== undefined && v !== "") flat[key] = v;
  }
  const result = filtersSchema.safeParse(flat);
  if (result.success) return result.data;

  // Tek bir bozuk parametre yüzünden sayfayı 400'e düşürmüyoruz; hatalı
  // alanları atıp kalanla devam ediyoruz. Bot trafiği ve elle düzenlenmiş
  // linkler bunun başlıca kaynağı.
  const clean = { ...flat };
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") delete clean[key];
  }
  return filtersSchema.parse(clean);
}

/** Filtreleri tekrar query string'e çevirir. Varsayılanlar URL'e yazılmaz. */
export function filtersToQuery(
  filters: Partial<VenueFilters>,
): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === "" || value === false) return;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  };
  put("sehir", filters.sehir);
  put("ilce", filters.ilce);
  put("etkinlik", filters.etkinlik);
  put("tur", filters.tur);
  put("kisi", filters.kisi);
  put("minKapasite", filters.minKapasite);
  put("maxKapasite", filters.maxKapasite);
  put("minFiyat", filters.minFiyat);
  put("maxFiyat", filters.maxFiyat);
  put("kapali", filters.kapali);
  put("acik", filters.acik);
  put("ozellikler", filters.ozellikler?.length ? filters.ozellikler : undefined);
  put("q", filters.q);
  if (filters.siralama && filters.siralama !== "onerilen") put("siralama", filters.siralama);
  if (filters.sayfa && filters.sayfa > 1) put("sayfa", filters.sayfa);
  return params;
}

/** Sayfa dışındaki herhangi bir filtre uygulanmış mı? */
export function hasActiveFilters(f: VenueFilters): boolean {
  return Boolean(
    f.sehir || f.ilce || f.etkinlik || f.tur || f.kisi ||
    f.minKapasite || f.maxKapasite || f.minFiyat || f.maxFiyat ||
    f.kapali || f.acik || f.ozellikler?.length || f.q,
  );
}

/**
 * Filtreli sayfalar indekslenmez — sonsuz permütasyon duplicate content
 * üretir. Temiz `/mekanlar` indekslenir.
 */
export function shouldIndex(f: VenueFilters): boolean {
  return !hasActiveFilters(f) && f.sayfa === 1;
}

export const PAGE_SIZE = PAGINATION.pageSize;
