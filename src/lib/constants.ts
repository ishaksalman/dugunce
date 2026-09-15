/**
 * Uygulama geneli sabitler. Şehir / ilçe / etkinlik türü gibi *veri*
 * buraya yazılmaz — onlar veritabanından gelir (bkz. lib/services/taxonomy).
 */

export const SITE = {
  name: "Düğünce",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description:
    "Düğün, nişan, kına ve tüm özel günlerin için Türkiye'nin en güzel davet mekanlarını keşfet. Kapasite, fiyat ve hizmetleri karşılaştır, doğrudan teklif al.",

  /**
   * Marka adının ek almış hâlleri.
   *
   * Türkçede ek son sesliye göre değişiyor; metne `{SITE.name}'nı` diye
   * yazmak marka değişince sessizce bozuluyor (DavetMekanı'nı → Düğünce'nı).
   * Ekli kullanımlar bu sabitlerden geçsin ki bir dahaki ada geçişte
   * düzeltilecek tek yer burası olsun.
   */
  ekli: {
    belirtme: "Düğünce'yi",   // …'yi kullanarak
    yonelme: "Düğünce'ye",    // …'ye üye ol
    bulunma: "Düğünce'de",    // …'de yayınla
    cikma: "Düğünce'den",     // …'den çıkar
    tamlayan: "Düğünce'nin",  // …'nin sorumluluğu
  },
} as const;

/** Destek ve KVKK başvuru adresi. Tek yerde tutuluyor. */
export const DESTEK_EPOSTA = "iletisim@dugunce.com";

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
