/**
 * Uygulama geneli sabitler. Şehir / ilçe / etkinlik türü gibi *veri*
 * buraya yazılmaz — onlar veritabanından gelir (bkz. lib/services/taxonomy).
 */

export const SITE = {
  name: "DavetMekanı",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description:
    "Düğün, nişan, kına ve tüm özel günlerin için Türkiye'nin en güzel davet mekanlarını keşfet. Kapasite, fiyat ve hizmetleri karşılaştır, doğrudan teklif al.",
} as const;

/** Destek ve KVKK başvuru adresi. Tek yerde tutuluyor. */
export const DESTEK_EPOSTA = "iletisim@davetmekani.com";

/** Listeleme sayfası varsayılanları. */
export const PAGINATION = {
  pageSize: 24,
  maxPageSize: 48,
} as const;

/** Bir SEO landing sayfasının indekslenebilmesi için gereken en az mekan. */
export const SEO_MIN_VENUE_COUNT = 3;

/** Mekan sıralama seçenekleri — arayüz ve API aynı listeyi kullanır. */
export const SORT_OPTIONS = [
  { value: "onerilen", label: "Önerilen" },
  { value: "cok-goruntulenen", label: "En çok görüntülenen" },
  { value: "cok-favorilenen", label: "En çok favorilenen" },
  { value: "fiyat-artan", label: "Fiyat: düşükten yükseğe" },
  { value: "fiyat-azalan", label: "Fiyat: yüksekten düşüğe" },
  { value: "yeni", label: "Yeni eklenenler" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

/** Teklif talebi hız sınırları (bkz. lib/rate-limit). */
export const INQUIRY_RATE_LIMIT = {
  perIpPerHour: 3,
  perVenuePerDayPerIp: 1,
} as const;
